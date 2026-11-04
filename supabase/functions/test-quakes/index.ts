import { createClient } from "jsr:@supabase/supabase-js@2";
import {
  credentialsMatch,
  maxSimulations,
  parseSimulationInput,
  publicQuakeFromRow,
} from "./contract.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) {
    return json({ error: "Faltan las credenciales de Supabase." }, 500);
  }

  const supabase = createClient(supabaseUrl, serviceKey);

  if (request.method === "GET") {
    const { data, error } = await supabase
      .from("simulated_quakes")
      .select("id, magnitude, place, occurred_at, latitude, longitude, depth_km")
      .order("occurred_at", { ascending: false });
    if (error) return json({ error: "No se pudieron leer las pruebas." }, 500);
    const quakes = (data ?? []).flatMap((row) => {
      const quake = publicQuakeFromRow(row);
      return quake ? [quake] : [];
    });
    return json({ quakes });
  }

  if (request.method !== "POST") {
    return json({ error: "Método no permitido." }, 405);
  }

  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (body == null) return json({ error: "El cuerpo no es válido." }, 400);

  const expectedUser = Deno.env.get("TEST_ADMIN_USER") ?? "admin";
  const expectedPassword = Deno.env.get("TEST_ADMIN_PASSWORD") ?? "admin";
  if (!credentialsMatch(body.username, body.password, expectedUser, expectedPassword)) {
    return json({ error: "Usuario o contraseña incorrectos." }, 401);
  }

  const action = body.action === "login" || body.action === "delete" ? body.action : "create";
  if (action === "login") return json({ ok: true });

  if (action === "delete") {
    if (typeof body.id !== "string" || body.id.trim() === "") {
      return json({ error: "Falta el identificador de la prueba." }, 400);
    }
    const { error } = await supabase.from("simulated_quakes").delete().eq("id", body.id);
    if (error) return json({ error: "No se pudo eliminar la prueba." }, 500);
    return json({ ok: true });
  }

  const parsed = parseSimulationInput(body);
  if (!parsed.ok) return json({ error: parsed.error }, 400);

  const { count, error: countError } = await supabase
    .from("simulated_quakes")
    .select("id", { count: "exact", head: true });
  if (countError) return json({ error: "No se pudo guardar la prueba." }, 500);
  if ((count ?? 0) >= maxSimulations) {
    return json({
      error: "Ya hay 30 pruebas. Elimina una para publicar otra.",
    }, 400);
  }

  const id = `sim${Date.now()}`;
  const { error } = await supabase.from("simulated_quakes").insert({
    id,
    magnitude: parsed.value.magnitude,
    place: parsed.value.place,
    occurred_at: new Date(parsed.value.time).toISOString(),
    latitude: parsed.value.latitude,
    longitude: parsed.value.longitude,
    depth_km: parsed.value.depth,
  });
  if (error) return json({ error: "No se pudo guardar la prueba." }, 500);

  if (parsed.value.time <= Date.now()) {
    await notifyNearbyOnce(supabaseUrl, serviceKey);
  }

  return json({
    quake: {
      id,
      magnitude: parsed.value.magnitude,
      place: parsed.value.place,
      time: parsed.value.time,
      latitude: parsed.value.latitude,
      longitude: parsed.value.longitude,
      depth: parsed.value.depth,
    },
  }, 201);
});

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: corsHeaders });
}

async function notifyNearbyOnce(supabaseUrl: string, serviceKey: string) {
  try {
    await fetch(`${supabaseUrl}/functions/v1/check-nearby-quakes`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${serviceKey}`,
        "Content-Type": "application/json",
      },
      body: "{}",
      signal: AbortSignal.timeout(20_000),
    });
  } catch {
    // La revisión de cada minuto vuelve a intentar el envío.
  }
}
