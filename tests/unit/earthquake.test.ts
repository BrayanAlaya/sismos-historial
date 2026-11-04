import { describe, expect, it } from 'vitest'
import type { Earthquake } from '../../src/types'
import {
  filterByMinMagnitude,
  filterByPeru,
  formatCoordinates,
  formatMagnitude,
  formatRelativeTime,
  getDangerLevel,
  getMarkerSize,
  isInPeru,
  isRecent,
  newSoundQuakeIds,
  priorityRecommendations,
  shouldSoundForMagnitude,
} from '../../src/utils/earthquake'

const now = Date.UTC(2026, 8, 22, 12, 0, 0)

function quake(magnitude: number, time = now): Earthquake {
  return {
    id: `q-${magnitude}`,
    magnitude,
    place: 'Cajamarca, Peru',
    title: `M ${magnitude}`,
    time,
    updated: time,
    url: 'https://earthquake.usgs.gov',
    felt: null,
    cdi: null,
    mmi: null,
    alert: null,
    status: 'reviewed',
    tsunami: 0,
    significance: 0,
    magType: 'ml',
    type: 'earthquake',
    longitude: -78.517,
    latitude: -7.157,
    depth: 35,
  }
}

describe('nivel de peligro y formato', () => {
  it('clasifica la magnitud con los mismos cortes de la leyenda', () => {
    expect(getDangerLevel(7).label).toBe('Extremo')
    expect(getDangerLevel(6).label).toBe('Muy fuerte')
    expect(getDangerLevel(5).label).toBe('Fuerte')
    expect(getDangerLevel(4).label).toBe('Moderado')
    expect(getDangerLevel(3).label).toBe('Leve')
    expect(getDangerLevel(2.9).label).toBe('Menor')
  })

  it('formatea magnitud, coordenadas y tiempo relativo en español', () => {
    expect(formatMagnitude(4.26)).toBe('M 4.3')
    expect(formatCoordinates(-7.157, -78.517)).toBe('7.157° S, 78.517° O')
    expect(formatRelativeTime(now - 20_000, now)).toBe('hace unos segundos')
    expect(formatRelativeTime(now - 5 * 60_000, now)).toBe('hace 5 min')
    expect(formatRelativeTime(now - 3 * 60 * 60_000, now)).toBe('hace 3 h')
    expect(formatRelativeTime(now - 2 * 24 * 60 * 60_000, now)).toBe('hace 2 d')
  })

  it('limita el tamaño del marcador entre 8 y 22', () => {
    expect(getMarkerSize(0)).toBe(8)
    expect(getMarkerSize(4)).toBeCloseTo(15.8)
    expect(getMarkerSize(9)).toBe(22)
  })
})

describe('filtro del mapa y eventos recientes', () => {
  it('oculta los sismos por debajo de la magnitud mínima', () => {
    const visible = filterByMinMagnitude(
      [quake(2.4), quake(2.5), quake(4.1)],
      2.5,
    )
    expect(visible.map((item) => item.magnitude)).toEqual([2.5, 4.1])
  })

  it('marca como reciente solo lo ocurrido dentro de la ventana', () => {
    expect(isRecent(quake(4, now - 10 * 60_000), 30, now)).toBe(true)
    expect(isRecent(quake(4, now - 31 * 60_000), 30, now)).toBe(false)
  })
})

describe('sismos en Perú, sonido y recomendaciones', () => {
  it('reconoce Cajamarca y Lima, y descarta un punto fuera del recuadro', () => {
    expect(isInPeru(-7.157, -78.517)).toBe(true)
    expect(isInPeru(-12.046, -77.043)).toBe(true)
    expect(isInPeru(-33.45, -70.67)).toBe(false)
    const inPeru = filterByPeru([
      quake(4.2),
      { ...quake(5), latitude: -33.45, longitude: -70.67 },
    ])
    expect(inPeru).toHaveLength(1)
    expect(inPeru[0].place).toBe('Cajamarca, Peru')
  })

  it('suena desde magnitud 4 y solo para identificadores nuevos', () => {
    expect(shouldSoundForMagnitude(3.9)).toBe(false)
    expect(shouldSoundForMagnitude(4)).toBe(true)
    const previous = new Set(['ya-visto'])
    expect(
      newSoundQuakeIds(previous, [
        { id: 'ya-visto', magnitude: 5 },
        { id: 'leve', magnitude: 3 },
        { id: 'nuevo', magnitude: 4.2 },
      ]),
    ).toEqual(['nuevo'])
  })

  it('prioriza la recomendación según el nivel de la magnitud', () => {
    expect(priorityRecommendations(2.5)[0]).toContain('Mantén la calma')
    expect(priorityRecommendations(4.8)[0]).toContain('Agáchate')
    expect(priorityRecommendations(4.8)).toHaveLength(3)
    expect(priorityRecommendations(6.4).join(' ')).toContain('tsunami')
    expect(priorityRecommendations(7)[1]).toContain('escaleras')
  })
})
