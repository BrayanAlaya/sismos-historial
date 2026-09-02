import type { Earthquake, UsgsFeature, UsgsGeoJson } from '../types'

const USGS_FEED =
  'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson'
const USGS_QUERY = 'https://earthquake.usgs.gov/fdsnws/event/1/query'
const USGS_COUNT = 'https://earthquake.usgs.gov/fdsnws/event/1/count'
const HISTORY_MAX_EVENTS = 20_000
const HISTORY_DAYS = 30

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

function historyStartTime(): string {
  const start = new Date()
  start.setUTCDate(start.getUTCDate() - HISTORY_DAYS)
  return start.toISOString()
}

function historyParams(): URLSearchParams {
  return new URLSearchParams({
    eventtype: 'earthquake',
    starttime: historyStartTime(),
  })
}

export async function fetchEarthquakes(): Promise<Earthquake[]> {
  const response = await fetch(USGS_FEED)

  if (!response.ok) {
    throw new Error('No se pudieron cargar los sismos de USGS')
  }

  const data = (await response.json()) as UsgsGeoJson

  return data.features
    .map(mapUsgsFeature)
    .filter((item): item is Earthquake => item != null)
    .sort((a, b) => b.time - a.time)
}

export async function fetchEarthquakeHistory(
  page: number,
  pageSize: number,
  signal?: AbortSignal,
): Promise<Earthquake[]> {
  const offset = (page - 1) * pageSize + 1
  const params = historyParams()
  params.set('format', 'geojson')
  params.set('orderby', 'time')
  params.set('limit', String(pageSize))
  params.set('offset', String(offset))
  params.set('jsonerror', 'true')

  const response = await fetch(`${USGS_QUERY}?${params.toString()}`, { signal })

  if (!response.ok) {
    throw new Error('No se pudo cargar el historial de USGS')
  }

  const data = (await response.json()) as UsgsGeoJson

  return data.features
    .map(mapUsgsFeature)
    .filter((item): item is Earthquake => item != null)
}

export async function fetchEarthquakeHistoryCount(
  signal?: AbortSignal,
): Promise<number> {
  const params = historyParams()
  const response = await fetch(`${USGS_COUNT}?${params.toString()}`, { signal })

  if (!response.ok) {
    throw new Error('No se pudo contar el historial de USGS')
  }

  const text = (await response.text()).trim()
  const count = Number(text)

  if (!Number.isFinite(count)) {
    throw new Error('La cuenta de sismos no es válida')
  }

  return Math.min(count, HISTORY_MAX_EVENTS)
}
