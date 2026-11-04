import { describe, expect, it } from 'vitest'
import {
  assembleHistoryPage,
  historyWindowStartMs,
  injectFeedSimulations,
  isInFeedWindow,
  isInHistoryWindow,
  simulationIndex,
  simulationInputError,
  usgsSliceForPage,
  type SimulatedQuake,
} from '../../src/api/simulations'
import type { UsgsFeature } from '../../src/types'

const now = Date.parse('2026-11-03T18:00:00-05:00')

function sim(id: string, time: number): SimulatedQuake {
  return {
    id,
    magnitude: 4.8,
    place: 'Prueba sísmica',
    time,
    latitude: -7.1569,
    longitude: -78.5176,
    depth: 30,
  }
}

describe('ventana de una prueba sísmica', () => {
  it('entra al mapa solo durante las 24 horas posteriores a su hora', () => {
    expect(isInFeedWindow(now - 60_000, now)).toBe(true)
    expect(isInFeedWindow(now + 60_000, now)).toBe(false)
    expect(isInFeedWindow(now - 25 * 60 * 60 * 1000, now)).toBe(false)
    expect(isInHistoryWindow(now - 3 * 24 * 60 * 60 * 1000, now)).toBe(true)
    expect(isInHistoryWindow(historyWindowStartMs(now) - 1, now)).toBe(false)
  })

  it('rechaza coordenadas o una hora fuera de los últimos 30 días', () => {
    expect(
      simulationInputError({
        latitude: -7.15,
        longitude: -78.51,
        magnitude: 4.8,
        depth: 30,
        time: now,
      }, now),
    ).toBeNull()
    expect(
      simulationInputError({
        latitude: 120,
        longitude: -78.51,
        magnitude: 4.8,
        depth: 30,
        time: now,
      }, now),
    ).toBe('La latitud debe estar entre -90 y 90.')
  })

  it('incrusta en el feed la prueba reciente y omite la futura', () => {
    const feature = {
      id: 'us1',
      properties: {
        mag: 3,
        place: 'Chile',
        time: now - 120_000,
        updated: now,
        url: '',
        felt: null,
        cdi: null,
        mmi: null,
        alert: null,
        status: 'automatic',
        tsunami: 0,
        sig: 100,
        magType: 'ml',
        type: 'earthquake',
        title: 'M 3.0 - Chile',
      },
      geometry: { type: 'Point', coordinates: [-70, -33, 20] as [number, number, number] },
    } satisfies UsgsFeature
    const feed = [feature]
    const withRecent = injectFeedSimulations(
      feed,
      [sim('sim-nueva', now - 60_000), sim('sim-futura', now + 60_000)],
      now,
    )
    expect(withRecent.map((item) => item.id)).toEqual(['sim-nueva', 'us1'])
    expect(injectFeedSimulations(feed, [sim('sim-vieja', now - 26 * 60 * 60 * 1000)], now)).toBe(feed)
  })

  it('reserva el puesto cronológico dentro de la página del historial', () => {
    const newer = { id: 'real-nuevo', time: now }
    const prueba = { id: 'sim1', time: now - 60_000 }
    const index = simulationIndex(prueba, [prueba], 1)
    expect(index).toBe(1)
    expect(usgsSliceForPage(1, 2, [index])).toEqual({ offset: 1, limit: 1 })
    expect(usgsSliceForPage(2, 2, [index])).toEqual({ offset: 2, limit: 2 })

    const page = assembleHistoryPage(
      [newer],
      [prueba],
      new Map([['sim1', index]]),
      1,
      2,
    )
    expect(page.map((item) => item.id)).toEqual(['real-nuevo', 'sim1'])
  })
})
