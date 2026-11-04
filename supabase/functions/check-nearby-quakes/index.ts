import { createClient } from "jsr:@supabase/supabase-js@2";
import {
  filterKnownAlerts,
  alertPushBody,
  matchAlerts,
  selectAlertableQuakes,
  simulationsForAlerts,
  storedSimulationFromRow,
} from "./quake_rules.ts";

const usgsFeedUrl =
  "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson";

Deno.serve(async () => {
  const pass = await checkOnce();
  return Response.json({ passes: [pass] });
});

async function checkOnce() {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) {
    return { error: "Faltan las credenciales de Supabase." };
  }

  const usgs = await fetch(usgsFeedUrl, {
    headers: { "User-Agent": "sismos-alerts/1.0" },
  });
  if (!usgs.ok) {
    return { error: "USGS no respondió." };
  }

  const feed = await usgs.json();
  const features = [...(feed.features ?? [])];

  const supabase = createClient(supabaseUrl, serviceKey);
  const simulated = await readSimulations(supabase);
  features.push(...simulationsForAlerts(simulated));
  const quakes = selectAlertableQuakes(features);
  const { data: locations, error } = await supabase
    .from("user_locations")
    .select("user_id, latitude, longitude, updated_at")
    .eq("location_enabled", true);
  if (error) {
    return { error: error.message };
  }

  const alerts = matchAlerts(locations ?? [], quakes);

  const fresh = await newAlerts(supabase, alerts);
  if (fresh.length > 0) {
    const { error: insertError } = await supabase.from("quake_alerts").insert(fresh);
    if (insertError) {
      return { error: insertError.message };
    }
  }

  const push = await sendQuakePush(supabase, fresh);
  return {
    quakes: quakes.length,
    matches: fresh.length,
    simulations: simulated.length,
    push,
  };
}

async function readSimulations(supabase: ReturnType<typeof createClient>) {
  const { data, error } = await supabase
    .from("simulated_quakes")
    .select("id, magnitude, place, occurred_at, latitude, longitude, depth_km");
  if (error || !data) return [];
  return data.flatMap((row) => {
    const parsed = storedSimulationFromRow(row);
    return parsed ? [parsed] : [];
  });
}

async function newAlerts<T extends { user_id: string; quake_id: string }>(
  supabase: ReturnType<typeof createClient>,
  alerts: T[],
): Promise<T[]> {
  if (alerts.length === 0) return [];
  const userIds = [...new Set(alerts.map((alert) => alert.user_id))];
  const { data, error } = await supabase
    .from("quake_alerts")
    .select("user_id, quake_id")
    .in("user_id", userIds);
  if (error) return alerts;
  return filterKnownAlerts(alerts, data ?? []);
}

async function sendQuakePush(
  supabase: ReturnType<typeof createClient>,
  alerts: Array<{
    user_id: string;
    magnitude: number;
    place: string;
    distance_km: number;
  }>,
) {
  const rawAccount = Deno.env.get("FCM_SERVICE_ACCOUNT");
  if (!rawAccount || alerts.length === 0) {
    return { sent: 0, configured: Boolean(rawAccount) };
  }

  const account = JSON.parse(rawAccount) as {
    project_id: string;
    client_email: string;
    private_key: string;
  };
  const accessToken = await firebaseAccessToken(account);
  const userIds = [...new Set(alerts.map((alert) => alert.user_id))];
  const { data: tokens, error } = await supabase
    .from("device_tokens")
    .select("token, user_id")
    .in("user_id", userIds);
  if (error || !tokens) {
    return { sent: 0, configured: true, tokens: 0, error: error?.message ?? "sin tokens" };
  }

  const byUser = new Map<string, string[]>();
  for (const row of tokens) {
    const list = byUser.get(row.user_id) ?? [];
    list.push(row.token);
    byUser.set(row.user_id, list);
  }

  let sent = 0;
  let failed = 0;
  for (const alert of alerts) {
    for (const token of byUser.get(alert.user_id) ?? []) {
      const delivered = await sendFcm(account.project_id, accessToken, {
        token,
        title: "Sismo cerca de ti",
        body: alertPushBody(alert.magnitude, alert.distance_km, alert.place),
      });
      if (delivered === "sent") sent += 1;
      if (delivered === "failed") failed += 1;
      if (delivered === "invalid") {
        failed += 1;
        await supabase.from("device_tokens").delete().eq("token", token);
      }
    }
  }
  return { sent, failed, configured: true, tokens: tokens.length };
}

async function sendFcm(
  projectId: string,
  accessToken: string,
  message: { token: string; title: string; body: string },
) {
  const response = await fetch(
    `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: {
          token: message.token,
          notification: { title: message.title, body: message.body },
          data: { open: "safety_tips" },
          android: {
            priority: "HIGH",
            notification: { channel_id: "quake_alerts" },
          },
        },
      }),
    },
  );
  if (response.ok) return "sent";
  if (response.status === 404) return "invalid";
  const body = await response.text();
  if (body.includes("UNREGISTERED") || body.includes("NOT_FOUND")) return "invalid";
  return "failed";
}

async function firebaseAccessToken(account: { client_email: string; private_key: string }) {
  const now = Math.floor(Date.now() / 1000);
  const header = base64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = base64Url(JSON.stringify({
    iss: account.client_email,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  }));
  const unsigned = `${header}.${claim}`;
  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToDer(account.private_key),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(unsigned),
  );
  const assertion = `${unsigned}.${base64Url(signature)}`;
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });
  const json = await response.json();
  if (!response.ok || typeof json.access_token !== "string") {
    throw new Error("No se pudo autorizar el envío con Firebase.");
  }
  return json.access_token;
}

function pemToDer(pem: string) {
  const body = pem
    .replace("-----BEGIN PRIVATE KEY-----", "")
    .replace("-----END PRIVATE KEY-----", "")
    .replace(/\s/g, "");
  const binary = atob(body);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

function base64Url(value: string | ArrayBuffer) {
  const bytes = typeof value === "string" ? new TextEncoder().encode(value) : new Uint8Array(value);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}
