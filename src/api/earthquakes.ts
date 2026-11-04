import type { Earthquake, UsgsFeature, UsgsGeoJson } from '../types'
import {
  assembleHistoryPage,
  fetchSimulatedQuakes,
  historyWindowStartMs,
  injectFeedSimulations,
  isInHistoryWindow,
  simulationIndex,
  simulationToFeature,
  usgsSliceForPage,
} from './simulations'

const USGS_FEED =
  'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson'
const USGS_QUERY = 'https://earthquake.usgs.gov/fdsnws/event/1/query'
const USGS_COUNT = 'https://earthquake.usgs.gov/fdsnws/event/1/count'
const HISTORY_MAX_EVENTS = 20_000

export function mapUsgsFeature(feature: UsgsFeature): Earthquake | null {
  const magnitude = feature.properties.mag

  if (
    feature.geometry == null ||
    magnitude == null ||
    !Number.isFinite(magnitude)
  ) {
    return null
  }

  const [longitude, latitude, depth] = feature.geometry.coordinates
  const { properties } = feature

  return {
    id: feature.id,
    magnitude,
    place: properties.place ?? 'Ubicación no disponible',
    title: properties.title,
    time: properties.time,
    updated: properties.updated,
    url: properties.url,
    felt: properties.felt,
    cdi: properties.cdi,
    mmi: properties.mmi,
    alert: properties.alert,
    status: properties.status,
    tsunami: properties.tsunami,
    significance: properties.sig,
    magType: properties.magType ?? '—',
    type: properties.type ?? 'earthquake',
    longitude,
    latitude,
    depth,
  }
}

export function historyStartTime(now = new Date()): string {
  return new Date(historyWindowStartMs(now.getTime())).toISOString()
}

export function buildHistorySearchParams(
  page: number,
  pageSize: number,
  now = new Date(),
): URLSearchParams {
  const offset = (page - 1) * pageSize + 1
  return new URLSearchParams({
    eventtype: 'earthquake',
    starttime: historyStartTime(now),
    format: 'geojson',
    orderby: 'time',
    limit: String(pageSize),
    offset: String(offset),
    jsonerror: 'true',
  })
}

function historyParams(now = new Date()): URLSearchParams {
  return new URLSearchParams({
    eventtype: 'earthquake',
    starttime: historyStartTime(now),
  })
}

export function parseEarthquakeFeed(
  data: UsgsGeoJson,
  sortByTime = false,
): Earthquake[] {
  const items = data.features
    .map(mapUsgsFeature)
    .filter((item): item is Earthquake => item != null)

  if (sortByTime) {
    items.sort((a, b) => b.time - a.time)
  }

  return items
}

export function capHistoryCount(count: number): number {
  return Math.min(count, HISTORY_MAX_EVENTS)
}

export async function fetchEarthquakes(): Promise<Earthquake[]> {
  const [response, simulations] = await Promise.all([
    fetch(USGS_FEED),
    fetchSimulatedQuakes(),
  ])

  if (!response.ok) {
    throw new Error('No se pudieron cargar los sismos de USGS')
  }

  const data = (await response.json()) as UsgsGeoJson
  data.features = injectFeedSimulations(data.features, simulations)

  return parseEarthquakeFeed(data, true)
}

export async function fetchEarthquakeHistory(
  page: number,
  pageSize: number,
  signal?: AbortSignal,
  now = new Date(),
): Promise<Earthquake[]> {
  const clock = now.getTime()
  const simulations = (await fetchSimulatedQuakes(signal)).filter((sim) =>
    isInHistoryWindow(sim.time, clock),
  )
  const params = buildHistorySearchParams(page, pageSize, now)
  let indexes = new Map<string, number>()

  if (simulations.length > 0) {
    const newerCounts = await Promise.all(
      simulations.map((sim) => countEventsAfter(sim.time, signal)),
    )
    indexes = new Map(
      simulations.map((sim, index) => [
        sim.id,
        simulationIndex(sim, simulations, newerCounts[index] ?? 0),
      ]),
    )
    const slice = usgsSliceForPage(page, pageSize, [...indexes.values()])
    params.set('offset', String(slice.offset))
    params.set('limit', String(slice.limit))
  }

  const limit = Number(params.get('limit'))
  let usgsQuakes: Earthquake[] = []
  if (limit > 0) {
    const response = await fetch(`${USGS_QUERY}?${params.toString()}`, { signal })
    if (!response.ok) {
      throw new Error('No se pudo cargar el historial de USGS')
    }
    const data = (await response.json()) as UsgsGeoJson
    const blocked = new Set(simulations.map((sim) => sim.id))
    usgsQuakes = parseEarthquakeFeed(data).filter((item) => !blocked.has(item.id))
  }

  if (simulations.length === 0) return usgsQuakes

  const simulatedQuakes = simulations
    .map((sim) => mapUsgsFeature(simulationToFeature(sim)))
    .filter((item): item is Earthquake => item != null)

  return assembleHistoryPage(usgsQuakes, simulatedQuakes, indexes, page, pageSize)
}

export async function fetchEarthquakeHistoryCount(
  signal?: AbortSignal,
  now = new Date(),
): Promise<number> {
  const params = historyParams(now)
  const [response, simulations] = await Promise.all([
    fetch(`${USGS_COUNT}?${params.toString()}`, { signal }),
    fetchSimulatedQuakes(signal),
  ])

  if (!response.ok) {
    throw new Error('No se pudo contar el historial de USGS')
  }

  const text = (await response.text()).trim()
  const count = Number(text)

  if (!Number.isFinite(count)) {
    throw new Error('La cuenta de sismos no es válida')
  }

  const extra = simulations.filter((sim) => isInHistoryWindow(sim.time, now.getTime())).length
  return capHistoryCount(count + extra)
}

async function countEventsAfter(timeMs: number, signal?: AbortSignal): Promise<number> {
  const params = new URLSearchParams({
    eventtype: 'earthquake',
    starttime: new Date(timeMs + 1).toISOString(),
  })
  const response = await fetch(`${USGS_COUNT}?${params.toString()}`, { signal })
  if (!response.ok) {
    throw new Error('No se pudo ubicar la prueba en el historial')
  }
  const count = Number((await response.text()).trim())
  if (!Number.isFinite(count)) {
    throw new Error('No se pudo ubicar la prueba en el historial')
  }
  return count
}
