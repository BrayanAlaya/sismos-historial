import { createClient } from "jsr:@supabase/supabase-js@2";

const usgsFeedUrl =
  "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson";
const lookbackMs = 6 * 60 * 60 * 1000;
const locationFreshMs = 7 * 24 * 60 * 60 * 1000;
const checkIntervalMs = 6_000;
const runBudgetMs = 54_000;

type Quake = {
  id: string;
  magnitude: number;
  place: string;
  time: number;
  latitude: number;
  longitude: number;
  radiusKm: number;
};

function radiusKm(magnitude: number) {
  if (magnitude >= 6) return 300;
  if (magnitude >= 5) return 150;
  if (magnitude >= 4) return 80;
  if (magnitude >= 2.5) return 40;
  return 0;
}

function haversineKm(
  latitudeA: number,
  longitudeA: number,
  latitudeB: number,
  longitudeB: number,
) {
  const earthKm = 6371;
  const toRad = (degrees: number) => (degrees * Math.PI) / 180;
  const dLat = toRad(latitudeB - latitudeA);
  const dLon = toRad(longitudeB - longitudeA);
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(latitudeA)) * Math.cos(toRad(latitudeB)) *
      Math.sin(dLon / 2) ** 2;
  return 2 * earthKm * Math.asin(Math.sqrt(a));
}

Deno.serve(async () => {
  const started = Date.now();
  const passes = [];
  while (true) {
    passes.push(await checkOnce());
    if (Date.now() - started + checkIntervalMs >= runBudgetMs) break;
    await new Promise((resolve) => setTimeout(resolve, checkIntervalMs));
  }
  return Response.json({ intervalSeconds: 6, passes });
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
  const cutoff = Date.now() - lookbackMs;
  const quakes: Quake[] = [];
  for (const feature of feed.features ?? []) {
    const magnitude = feature?.properties?.mag;
    const coordinates = feature?.geometry?.coordinates;
    const time = feature?.properties?.time;
    if (typeof magnitude !== "number" || typeof time !== "number") continue;
    if (!Array.isArray(coordinates) || coordinates.length < 2) continue;
    const radius = radiusKm(magnitude);
    if (time < cutoff || radius === 0) continue;
    quakes.push({
      id: String(feature.id),
      magnitude,
      place: feature.properties.place ?? "Ubicación no disponible",
      time,
      longitude: Number(coordinates[0]),
      latitude: Number(coordinates[1]),
      radiusKm: radius,
    });
  }

  const supabase = createClient(supabaseUrl, serviceKey);
  const { data: locations, error } = await supabase
    .from("user_locations")
    .select("user_id, latitude, longitude, updated_at")
    .eq("location_enabled", true);
  if (error) {
    return { error: error.message };
  }

  const freshAfter = Date.now() - locationFreshMs;
  const alerts = [];
  for (const location of locations ?? []) {
    const updated = Date.parse(location.updated_at);
    if (Number.isFinite(updated) && updated < freshAfter) continue;
    for (const quake of quakes) {
      const distance = haversineKm(
        location.latitude,
        location.longitude,
        quake.latitude,
        quake.longitude,
      );
      if (distance > quake.radiusKm) continue;
      alerts.push({
        user_id: location.user_id,
        quake_id: quake.id,
        magnitude: quake.magnitude,
        place: quake.place,
        latitude: quake.latitude,
        longitude: quake.longitude,
        distance_km: Math.round(distance * 10) / 10,
        quake_time: new Date(quake.time).toISOString(),
      });
    }
  }

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
    push,
  };
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
  const known = new Set((data ?? []).map((row) => `${row.user_id}:${row.quake_id}`));
  return alerts.filter((alert) => !known.has(`${alert.user_id}:${alert.quake_id}`));
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
  if (error || !tokens) return { sent: 0, configured: true };

  const byUser = new Map<string, string[]>();
  for (const row of tokens) {
    const list = byUser.get(row.user_id) ?? [];
    list.push(row.token);
    byUser.set(row.user_id, list);
  }

  let sent = 0;
  for (const alert of alerts) {
    const distance = alert.distance_km < 1
      ? `a ${Math.round(alert.distance_km * 1000)} m`
      : `a ${alert.distance_km.toFixed(1)} km`;
    for (const token of byUser.get(alert.user_id) ?? []) {
      const delivered = await sendFcm(account.project_id, accessToken, {
        token,
        title: "Sismo cerca de ti",
        body: `M ${alert.magnitude.toFixed(1)} ${distance}. ${alert.place}`,
      });
      if (delivered === "sent") sent += 1;
      if (delivered === "invalid") {
        await supabase.from("device_tokens").delete().eq("token", token);
      }
    }
  }
  return { sent, configured: true };
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
