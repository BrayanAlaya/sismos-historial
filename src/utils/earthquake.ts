import type { Earthquake } from '../types'

export type DangerLevel = {
  label: string
  color: string
}

export function getDangerLevel(magnitude: number): DangerLevel {
  if (magnitude >= 7) return { label: 'Extremo', color: '#c026d3' }
  if (magnitude >= 6) return { label: 'Muy fuerte', color: '#dc2626' }
  if (magnitude >= 5) return { label: 'Fuerte', color: '#ea580c' }
  if (magnitude >= 4) return { label: 'Moderado', color: '#f59e0b' }
  if (magnitude >= 3) return { label: 'Leve', color: '#eab308' }
  return { label: 'Menor', color: '#22c55e' }
}

export function getMagnitudeColor(magnitude: number): string {
  return getDangerLevel(magnitude).color
}

export function getMarkerSize(magnitude: number): number {
  return Math.min(22, Math.max(8, 7 + magnitude * 2.2))
}

export function formatMagnitude(magnitude: number): string {
  return `M ${magnitude.toFixed(1)}`
}

export function formatDateTime(timestamp: number): string {
  return new Date(timestamp).toLocaleString('es-ES', {
    dateStyle: 'long',
    timeStyle: 'medium',
  })
}

export function formatShortDateTime(timestamp: number): string {
  return new Date(timestamp).toLocaleString('es-ES', {
    dateStyle: 'short',
    timeStyle: 'short',
  })
}

export function filterByMinMagnitude<T extends { magnitude: number }>(
  earthquakes: T[],
  minMagnitude: number,
): T[] {
  return earthquakes.filter((item) => item.magnitude >= minMagnitude)
}

/** Recuadro geográfico de referencia de Perú, de Tumbes a Tacna y de la costa al oriente. */
export const PERU_BOUNDS = {
  minLatitude: -18.35,
  maxLatitude: -0.04,
  minLongitude: -81.33,
  maxLongitude: -68.65,
}

export function isInPeru(latitude: number, longitude: number): boolean {
  return (
    latitude >= PERU_BOUNDS.minLatitude &&
    latitude <= PERU_BOUNDS.maxLatitude &&
    longitude >= PERU_BOUNDS.minLongitude &&
    longitude <= PERU_BOUNDS.maxLongitude
  )
}

export function filterByPeru<T extends { latitude: number; longitude: number }>(
  earthquakes: T[],
): T[] {
  return earthquakes.filter((item) => isInPeru(item.latitude, item.longitude))
}

/** A partir de Moderado el mapa emite un tono, si el usuario no lo silenció. */
export const SOUND_MIN_MAGNITUDE = 4

export function shouldSoundForMagnitude(magnitude: number): boolean {
  return magnitude >= SOUND_MIN_MAGNITUDE
}

export function newSoundQuakeIds(
  previousIds: ReadonlySet<string>,
  earthquakes: Array<{ id: string; magnitude: number }>,
): string[] {
  return earthquakes
    .filter(
      (item) =>
        shouldSoundForMagnitude(item.magnitude) && !previousIds.has(item.id),
    )
    .map((item) => item.id)
}

export function priorityRecommendations(magnitude: number): string[] {
  if (magnitude >= 6) {
    return [
      'Agáchate, cúbrete y sujétate, lejos de ventanas y de lo que pueda caer.',
      'Cuando el movimiento pare, si el edificio está dañado evacúa por las escaleras.',
      'En la costa, si hay aviso de tsunami, aléjate del mar hacia una zona alta.',
    ]
  }
  if (magnitude >= 4) {
    return [
      'Agáchate, cúbrete y sujétate bajo un mueble firme.',
      'Aléjate de ventanas, espejos y estanterías.',
      'No uses escaleras ni el ascensor mientras se mueve el suelo.',
    ]
  }
  return [
    'Mantén la calma y comprueba si el movimiento se hace más fuerte.',
    'Aléjate de objetos que puedan caer.',
    'Ten presentes los pasos de antes, durante y después.',
  ]
}

export function formatRelativeTime(timestamp: number, now = Date.now()): string {
  const diffMs = now - timestamp
  const minutes = Math.floor(diffMs / 60_000)
  if (minutes < 1) return 'hace unos segundos'
  if (minutes < 60) return `hace ${minutes} min`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `hace ${hours} h`
  const days = Math.floor(hours / 24)
  return `hace ${days} d`
}

export function formatCoordinates(latitude: number, longitude: number): string {
  const latDir = latitude >= 0 ? 'N' : 'S'
  const lonDir = longitude >= 0 ? 'E' : 'O'
  return `${Math.abs(latitude).toFixed(3)}° ${latDir}, ${Math.abs(longitude).toFixed(3)}° ${lonDir}`
}

export function isRecent(
  earthquake: Earthquake,
  minutes = 30,
  now = Date.now(),
): boolean {
  return now - earthquake.time < minutes * 60_000
}

export const DANGER_LEGEND: DangerLevel[] = [
  { label: 'Menor < 3', color: '#22c55e' },
  { label: 'Leve 3–4', color: '#eab308' },
  { label: 'Moderado 4–5', color: '#f59e0b' },
  { label: 'Fuerte 5–6', color: '#ea580c' },
  { label: 'Muy fuerte 6–7', color: '#dc2626' },
  { label: 'Extremo ≥ 7', color: '#c026d3' },
]
