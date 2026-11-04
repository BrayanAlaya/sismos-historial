export const lookbackMs = 6 * 60 * 60 * 1000;
export const locationFreshMs = 7 * 24 * 60 * 60 * 1000;

/**
 * En false, cada sismo avisa una sola vez por usuario, como uno real.
 * En true, la prueba de Cajamarca crearía una alerta nueva en cada revisión.
 */
export const repeatTestAlerts = false;

/** Simulación única: 20 de octubre de 2026, de 17:00 a 17:03 hora de Perú. Después no hay más pruebas. */
export const scheduledTestStartMs = Date.parse("2026-10-20T17:00:00-05:00");
export const scheduledTestWindowMs = 3 * 60 * 1000;
export const scheduledTestQuakeId = "us202610201700";

export function isScheduledTestWindow(now = Date.now()) {
  return now >= scheduledTestStartMs && now < scheduledTestStartMs + scheduledTestWindowMs;
}

export type Quake = {
  id: string;
  magnitude: number;
  place: string;
  time: number;
  latitude: number;
  longitude: number;
  radiusKm: number;
};

export type AlertMatch = {
  user_id: string;
  quake_id: string;
  magnitude: number;
  place: string;
  latitude: number;
  longitude: number;
  distance_km: number;
  quake_time: string;
};

export function radiusKm(magnitude: number) {
  if (magnitude >= 6) return 300;
  if (magnitude >= 5) return 150;
  if (magnitude >= 4) return 80;
  if (magnitude >= 2.5) return 40;
  return 0;
}

export function haversineKm(
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

/** Evento fijo para probar la notificación sin esperar un sismo real en la ciudad. */
export function cajamarcaTestFeature(now = Date.now(), repeat = repeatTestAlerts) {
  return {
    id: repeat ? `test-cajamarca-${now}` : scheduledTestQuakeId,
    properties: {
      mag: 4.8,
      place: "Cajamarca, Cajamarca, Peru",
      time: repeat ? now : scheduledTestStartMs,
    },
    geometry: {
      coordinates: [-78.5176, -7.1569, 30],
    },
  };
}

export function magnitudeTone(magnitude: number) {
  if (magnitude >= 7) return "extremo";
  if (magnitude >= 6) return "muy fuerte";
  if (magnitude >= 5) return "fuerte";
  if (magnitude >= 4) return "moderado";
  if (magnitude >= 3) return "leve";
  return "menor";
}

export function selectAlertableQuakes(
  features: Array<{
    id?: unknown;
    properties?: {
      mag?: unknown;
      place?: unknown;
      time?: unknown;
    };
    geometry?: { coordinates?: unknown } | null;
  }>,
  now = Date.now(),
): Quake[] {
  const cutoff = now - lookbackMs;
  const quakes: Quake[] = [];
  for (const feature of features) {
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
      place: typeof feature.properties?.place === "string"
        ? feature.properties.place
        : "Ubicación no disponible",
      time,
      longitude: Number(coordinates[0]),
      latitude: Number(coordinates[1]),
      radiusKm: radius,
    });
  }
  return quakes;
}

export function isLocationFresh(updatedAt: string, now = Date.now()) {
  const updated = Date.parse(updatedAt);
  if (!Number.isFinite(updated)) return true;
  return updated >= now - locationFreshMs;
}

export function matchAlerts(
  locations: Array<{
    user_id: string;
    latitude: number;
    longitude: number;
    updated_at: string;
  }>,
  quakes: Quake[],
  now = Date.now(),
): AlertMatch[] {
  const alerts: AlertMatch[] = [];
  for (const location of locations) {
    if (!isLocationFresh(location.updated_at, now)) continue;
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
  return alerts;
}

export function filterKnownAlerts<T extends { user_id: string; quake_id: string }>(
  alerts: T[],
  known: Array<{ user_id: string; quake_id: string }>,
): T[] {
  const seen = new Set(known.map((row) => `${row.user_id}:${row.quake_id}`));
  return alerts.filter((alert) => !seen.has(`${alert.user_id}:${alert.quake_id}`));
}

export function formatAlertDistance(distanceKm: number) {
  if (distanceKm < 1) return `a ${Math.round(distanceKm * 1000)} m`;
  return `a ${distanceKm.toFixed(1)} km`;
}

export function alertPushBody(
  magnitude: number,
  distanceKm: number,
  place: string,
) {
  const tone = magnitudeTone(magnitude);
  const distance = formatAlertDistance(distanceKm);
  return `Sismo ${tone} de M ${magnitude.toFixed(1)} ${distance} de ti, en ${place}.`;
}

export type StoredSimulation = {
  id: string;
  magnitude: number;
  place: string;
  time: number;
  latitude: number;
  longitude: number;
  depth: number;
};

/** La prueba entra al feed de alertas solo cuando su hora ya llegó. */
export function simulationsForAlerts(rows: StoredSimulation[], now = Date.now()) {
  return rows
    .filter((row) => row.time <= now)
    .map((row) => ({
      id: row.id,
      properties: {
        mag: row.magnitude,
        place: row.place,
        time: row.time,
      },
      geometry: {
        coordinates: [row.longitude, row.latitude, row.depth],
      },
    }));
}

export function storedSimulationFromRow(row: {
  id: unknown;
  magnitude: unknown;
  place: unknown;
  occurred_at: unknown;
  latitude: unknown;
  longitude: unknown;
  depth_km: unknown;
}): StoredSimulation | null {
  const magnitude = asFinite(row.magnitude);
  const latitude = asFinite(row.latitude);
  const longitude = asFinite(row.longitude);
  const depth = asFinite(row.depth_km);
  const time = typeof row.occurred_at === "string" ? Date.parse(row.occurred_at) : Number.NaN;
  if (
    typeof row.id !== "string" ||
    row.id.length === 0 ||
    typeof row.place !== "string" ||
    magnitude == null ||
    latitude == null ||
    longitude == null ||
    depth == null ||
    !Number.isFinite(time)
  ) {
    return null;
  }
  return {
    id: row.id,
    magnitude,
    place: row.place,
    time,
    latitude,
    longitude,
    depth,
  };
}

function asFinite(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value))) {
    return Number(value);
  }
  return null;
}
