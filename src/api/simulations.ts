import { supabaseAnonKey, testQuakesUrl } from '../config/supabase'
import type { UsgsFeature } from '../types'

export const feedWindowMs = 24 * 60 * 60 * 1000
export const maxFutureMs = 24 * 60 * 60 * 1000
export const historyDays = 30

export type SimulatedQuake = {
  id: string
  magnitude: number
  place: string
  time: number
  latitude: number
  longitude: number
  depth: number
}

export type SimulationVisibility = 'programada' | 'mapa' | 'historial' | 'fuera'

export class TestAdminError extends Error {}

export function historyWindowStartMs(now = Date.now()): number {
  const start = new Date(now)
  start.setUTCDate(start.getUTCDate() - historyDays)
  return start.getTime()
}

export function isInFeedWindow(time: number, now = Date.now()): boolean {
  return time <= now && now - time <= feedWindowMs
}

export function isInHistoryWindow(time: number, now = Date.now()): boolean {
  return time <= now && time >= historyWindowStartMs(now)
}

export function simulationVisibility(
  time: number,
  now = Date.now(),
): SimulationVisibility {
  if (time > now) return 'programada'
  if (isInFeedWindow(time, now)) return 'mapa'
  if (isInHistoryWindow(time, now)) return 'historial'
  return 'fuera'
}

export function simulationInputError(
  input: {
    latitude: number
    longitude: number
    magnitude: number
    depth: number
    time: number
  },
  now = Date.now(),
): string | null {
  if (!Number.isFinite(input.latitude) || input.latitude < -90 || input.latitude > 90) {
    return 'La latitud debe estar entre -90 y 90.'
  }
  if (
    !Number.isFinite(input.longitude) ||
    input.longitude < -180 ||
    input.longitude > 180
  ) {
    return 'La longitud debe estar entre -180 y 180.'
  }
  if (!Number.isFinite(input.magnitude) || input.magnitude < 0.1 || input.magnitude > 10) {
    return 'La magnitud debe estar entre 0.1 y 10.'
  }
  if (!Number.isFinite(input.depth) || input.depth < 0 || input.depth > 800) {
    return 'La profundidad debe estar entre 0 y 800 km.'
  }
  if (!Number.isFinite(input.time)) return 'La fecha y la hora no son válidas.'
  if (input.time > now + maxFutureMs) {
    return 'La hora no puede pasar de las próximas 24 horas.'
  }
  if (input.time < historyWindowStartMs(now)) {
    return 'La prueba tiene que caer dentro de los últimos 30 días.'
  }
  return null
}

export function parseSimulatedQuake(value: unknown): SimulatedQuake | null {
  if (value == null || typeof value !== 'object') return null
  const row = value as Record<string, unknown>
  const { id, magnitude, place, time, latitude, longitude, depth } = row
  if (typeof id !== 'string' || id.length === 0) return null
  if (typeof magnitude !== 'number' || !Number.isFinite(magnitude)) return null
  if (typeof place !== 'string' || place.length === 0) return null
  if (typeof time !== 'number' || !Number.isFinite(time)) return null
  if (typeof latitude !== 'number' || latitude < -90 || latitude > 90) return null
  if (typeof longitude !== 'number' || longitude < -180 || longitude > 180) return null
  if (typeof depth !== 'number' || !Number.isFinite(depth)) return null
  return { id, magnitude, place, time, latitude, longitude, depth }
}

export function simulationToFeature(sim: SimulatedQuake): UsgsFeature {
  const magnitude = Math.round(sim.magnitude * 10) / 10
  return {
    id: sim.id,
    properties: {
      mag: magnitude,
      place: sim.place,
      time: sim.time,
      updated: sim.time,
      url: '',
      felt: null,
      cdi: null,
      mmi: null,
      alert: null,
      status: 'automatic',
      tsunami: 0,
      sig: Math.round(magnitude * magnitude * 15),
      magType: 'ml',
      type: 'earthquake',
      title: `M ${magnitude.toFixed(1)} - ${sim.place}`,
    },
    geometry: {
      type: 'Point',
      coordinates: [sim.longitude, sim.latitude, sim.depth],
    },
  }
}

export function injectFeedSimulations(
  features: UsgsFeature[],
  simulations: SimulatedQuake[],
  now = Date.now(),
): UsgsFeature[] {
  const present = new Set(features.map((feature) => feature.id))
  const extras = simulations
    .filter((sim) => isInFeedWindow(sim.time, now) && !present.has(sim.id))
    .map(simulationToFeature)
  if (extras.length === 0) return features
  return [...extras, ...features]
}

export function simulationIndex(
  sim: { id: string; time: number },
  simulations: { id: string; time: number }[],
  usgsNewer: number,
): number {
  const ahead = simulations.filter((other) => {
    if (other.id === sim.id) return false
    if (other.time !== sim.time) return other.time > sim.time
    return other.id < sim.id
  }).length
  return usgsNewer + ahead
}

export function usgsSliceForPage(
  page: number,
  pageSize: number,
  indexes: number[],
): { offset: number; limit: number } {
  const start = (page - 1) * pageSize
  const end = start + pageSize
  const before = indexes.filter((index) => index < start).length
  const onPage = indexes.filter((index) => index >= start && index < end).length
  return {
    offset: Math.max(1, start - before + 1),
    limit: Math.max(0, pageSize - onPage),
  }
}

export function assembleHistoryPage<T extends { id: string }>(
  usgs: T[],
  simulated: T[],
  indexes: Map<string, number>,
  page: number,
  pageSize: number,
): T[] {
  const start = (page - 1) * pageSize
  const end = start + pageSize
  const onPage = simulated
    .filter((item) => {
      const index = indexes.get(item.id)
      return index != null && index >= start && index < end
    })
    .sort((a, b) => indexes.get(a.id)! - indexes.get(b.id)!)

  const items: T[] = []
  let usgsCursor = 0
  let simCursor = 0
  for (let index = start; index < end; index += 1) {
    const nextSim = onPage[simCursor]
    if (nextSim && indexes.get(nextSim.id) === index) {
      items.push(nextSim)
      simCursor += 1
      continue
    }
    const nextUsgs = usgs[usgsCursor]
    if (!nextUsgs) break
    items.push(nextUsgs)
    usgsCursor += 1
  }
  return items
}

export async function fetchSimulatedQuakes(
  signal?: AbortSignal,
): Promise<SimulatedQuake[]> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 8_000)
  const onAbort = () => controller.abort()
  signal?.addEventListener('abort', onAbort)

  try {
    if (signal?.aborted) throw signal.reason
    const response = await fetch(testQuakesUrl, {
      signal: controller.signal,
      headers: supabaseHeaders(),
    })
    if (!response.ok) return []
    const data = (await response.json()) as { quakes?: unknown }
    if (!Array.isArray(data.quakes)) return []
    return data.quakes.flatMap((item) => {
      const parsed = parseSimulatedQuake(item)
      return parsed ? [parsed] : []
    })
  } catch (error) {
    if (signal?.aborted) throw error
    return []
  } finally {
    clearTimeout(timer)
    signal?.removeEventListener('abort', onAbort)
  }
}

export async function loginTestAdmin(username: string, password: string) {
  await adminRequest({ action: 'login', username, password })
}

export async function publishTestQuake(
  credentials: { username: string; password: string },
  quake: {
    latitude: number
    longitude: number
    magnitude: number
    depth: number
    place: string
    time: number
  },
): Promise<SimulatedQuake> {
  const data = (await adminRequest({
    action: 'create',
    username: credentials.username,
    password: credentials.password,
    ...quake,
  })) as { quake?: unknown }
  const parsed = parseSimulatedQuake(data.quake)
  if (!parsed) throw new TestAdminError('La prueba se guardó, pero la respuesta no es válida.')
  return parsed
}

export async function deleteTestQuake(
  credentials: { username: string; password: string },
  id: string,
) {
  await adminRequest({
    action: 'delete',
    username: credentials.username,
    password: credentials.password,
    id,
  })
}

export async function listPublishedQuakes(): Promise<SimulatedQuake[]> {
  let response: Response
  try {
    response = await fetch(testQuakesUrl, { headers: supabaseHeaders() })
  } catch {
    throw new TestAdminError('No se pudo contactar el servicio de pruebas.')
  }
  const data = (await response.json().catch(() => null)) as { quakes?: unknown; error?: string } | null
  if (!response.ok) {
    throw new TestAdminError(data?.error ?? 'No se pudieron cargar las pruebas publicadas.')
  }
  if (!Array.isArray(data?.quakes)) return []
  return data.quakes.flatMap((item) => {
    const parsed = parseSimulatedQuake(item)
    return parsed ? [parsed] : []
  })
}

async function adminRequest(body: unknown): Promise<unknown> {
  let response: Response
  try {
    response = await fetch(testQuakesUrl, {
      method: 'POST',
      headers: supabaseHeaders(true),
      body: JSON.stringify(body),
    })
  } catch {
    throw new TestAdminError('No se pudo contactar el servicio de pruebas.')
  }

  const data = (await response.json().catch(() => null)) as { error?: string } | null
  if (!response.ok) {
    throw new TestAdminError(data?.error ?? 'No se pudo completar la operación.')
  }
  return data
}

function supabaseHeaders(json = false): HeadersInit {
  return {
    apikey: supabaseAnonKey,
    Authorization: `Bearer ${supabaseAnonKey}`,
    ...(json ? { 'Content-Type': 'application/json' } : {}),
  }
}
