export const defaultMagnitude = 4.8;
export const defaultDepthKm = 30;
export const defaultPlace = "Prueba sísmica";
export const maxFutureMs = 24 * 60 * 60 * 1000;
export const historyDays = 30;
export const maxSimulations = 30;

export type SimulationInput = {
  magnitude: number;
  place: string;
  time: number;
  latitude: number;
  longitude: number;
  depth: number;
};

export type PublicQuake = {
  id: string;
  magnitude: number;
  place: string;
  time: number;
  latitude: number;
  longitude: number;
  depth: number;
};

export function credentialsMatch(
  username: unknown,
  password: unknown,
  expectedUser: string,
  expectedPassword: string,
): boolean {
  return typeof username === "string" &&
    typeof password === "string" &&
    username === expectedUser &&
    password === expectedPassword;
}

export function parseSimulationInput(
  body: Record<string, unknown>,
  now = Date.now(),
): { ok: true; value: SimulationInput } | { ok: false; error: string } {
  const latitude = asNumber(body.latitude);
  const longitude = asNumber(body.longitude);
  if (latitude == null || latitude < -90 || latitude > 90) {
    return { ok: false, error: "La latitud debe estar entre -90 y 90." };
  }
  if (longitude == null || longitude < -180 || longitude > 180) {
    return { ok: false, error: "La longitud debe estar entre -180 y 180." };
  }

  const magnitude = body.magnitude == null || body.magnitude === ""
    ? defaultMagnitude
    : asNumber(body.magnitude);
  if (magnitude == null || magnitude < 0.1 || magnitude > 10) {
    return { ok: false, error: "La magnitud debe estar entre 0.1 y 10." };
  }

  const depth = body.depth == null || body.depth === ""
    ? defaultDepthKm
    : asNumber(body.depth);
  if (depth == null || depth < 0 || depth > 800) {
    return { ok: false, error: "La profundidad debe estar entre 0 y 800 km." };
  }

  const time = asTime(body.time);
  if (time == null) {
    return { ok: false, error: "La fecha y la hora no son válidas." };
  }
  if (time > now + maxFutureMs) {
    return { ok: false, error: "La hora no puede pasar de las próximas 24 horas." };
  }

  const start = new Date(now);
  start.setUTCDate(start.getUTCDate() - historyDays);
  if (time < start.getTime()) {
    return { ok: false, error: "La prueba tiene que caer dentro de los últimos 30 días." };
  }

  return {
    ok: true,
    value: {
      magnitude: roundTo(magnitude, 1),
      place: asPlace(body.place) ?? defaultPlace,
      time,
      latitude: roundTo(latitude, 5),
      longitude: roundTo(longitude, 5),
      depth: roundTo(depth, 1),
    },
  };
}

export function publicQuakeFromRow(row: {
  id: unknown;
  magnitude: unknown;
  place: unknown;
  occurred_at: unknown;
  latitude: unknown;
  longitude: unknown;
  depth_km: unknown;
}): PublicQuake | null {
  const magnitude = asNumber(row.magnitude);
  const latitude = asNumber(row.latitude);
  const longitude = asNumber(row.longitude);
  const depth = asNumber(row.depth_km);
  const time = typeof row.occurred_at === "string" ? Date.parse(row.occurred_at) : Number.NaN;
  if (
    typeof row.id !== "string" ||
    row.id.length === 0 ||
    typeof row.place !== "string" ||
    row.place.length === 0 ||
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

function roundTo(value: number, digits: number) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function asNumber(value: unknown): number | null {
  const number = typeof value === "number"
    ? value
    : typeof value === "string" && value.trim() !== ""
    ? Number(value)
    : Number.NaN;
  return Number.isFinite(number) ? number : null;
}

function asTime(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function asPlace(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const place = value.trim().replace(/\s+/g, " ");
  if (place.length === 0) return null;
  return place.slice(0, 140);
}
