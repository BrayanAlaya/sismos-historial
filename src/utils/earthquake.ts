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

export function formatRelativeTime(timestamp: number): string {
  const diffMs = Date.now() - timestamp
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

export function isRecent(earthquake: Earthquake, minutes = 30): boolean {
  return Date.now() - earthquake.time < minutes * 60_000
}

export const DANGER_LEGEND: DangerLevel[] = [
  { label: 'Menor < 3', color: '#22c55e' },
  { label: 'Leve 3–4', color: '#eab308' },
  { label: 'Moderado 4–5', color: '#f59e0b' },
  { label: 'Fuerte 5–6', color: '#ea580c' },
  { label: 'Muy fuerte 6–7', color: '#dc2626' },
  { label: 'Extremo ≥ 7', color: '#c026d3' },
]
