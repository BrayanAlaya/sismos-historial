import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  buildHistorySearchParams,
  capHistoryCount,
  fetchEarthquakeHistory,
  fetchEarthquakeHistoryCount,
  fetchEarthquakes,
  mapUsgsFeature,
  parseEarthquakeFeed,
} from '../../src/api/earthquakes'
import type { UsgsFeature, UsgsGeoJson } from '../../src/types'

function feature(
  overrides: Partial<UsgsFeature> & { geometry?: UsgsFeature['geometry'] } = {},
): UsgsFeature {
  return {
    id: 'us123',
    properties: {
      mag: 5.4,
      place: '10 km al oeste de Cajamarca',
      time: 1_700_000_000_000,
      updated: 1_700_000_100_000,
      url: 'https://earthquake.usgs.gov/earthquakes/eventpage/us123',
      felt: 12,
      cdi: 3.2,
      mmi: 4,
      alert: null,
      status: 'reviewed',
      tsunami: 0,
      sig: 400,
      magType: 'mww',
      type: 'earthquake',
      title: 'M 5.4 - Cajamarca',
    },
    geometry: {
      type: 'Point',
      coordinates: [-78.517, -7.157, 35.2],
    },
    ...overrides,
  }
}

describe('identificación de un evento USGS', () => {
  it('conserva magnitud, lugar, profundidad y coordenadas', () => {
    const earthquake = mapUsgsFeature(feature())
    expect(earthquake).toMatchObject({
      id: 'us123',
      magnitude: 5.4,
      place: '10 km al oeste de Cajamarca',
      depth: 35.2,
      latitude: -7.157,
      longitude: -78.517,
      mmi: 4,
    })
  })

  it('descarta eventos sin geometría o sin magnitud válida', () => {
    expect(mapUsgsFeature(feature({ geometry: null }))).toBeNull()
    expect(
      mapUsgsFeature(
        feature({
          properties: { ...feature().properties, mag: null },
        }),
      ),
    ).toBeNull()
    expect(
      mapUsgsFeature(
        feature({
          properties: { ...feature().properties, mag: Number.NaN },
        }),
      ),
    ).toBeNull()
  })

  it('ordena el feed del día del más reciente al más antiguo', () => {
    const feed: UsgsGeoJson = {
      metadata: { generated: 1, title: 'test', count: 2 },
      features: [
        feature({ id: 'old', properties: { ...feature().properties, time: 10 } }),
        feature({ id: 'new', properties: { ...feature().properties, time: 20 } }),
      ],
    }
    expect(parseEarthquakeFeed(feed, true).map((item) => item.id)).toEqual([
      'new',
      'old',
    ])
  })
})

describe('historial y tolerancia a fallos', () => {
  it('consulta 30 días con paginación en base 1', () => {
    const now = new Date(Date.UTC(2026, 8, 22))
    const params = buildHistorySearchParams(2, 10, now)
    expect(params.get('eventtype')).toBe('earthquake')
    expect(params.get('format')).toBe('geojson')
    expect(params.get('orderby')).toBe('time')
    expect(params.get('limit')).toBe('10')
    expect(params.get('offset')).toBe('11')
    expect(params.get('starttime')).toBe(new Date(Date.UTC(2026, 7, 23)).toISOString())
  })

  it('suma las pruebas vigentes al conteo del historial', async () => {
    const now = new Date('2026-11-03T18:00:00-05:00')
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string) => {
        if (String(input).includes('test-quakes')) {
          return Response.json({
            quakes: [
              {
                id: 'sim1',
                magnitude: 4.8,
                place: 'Prueba sísmica',
                time: now.getTime() - 60_000,
                latitude: -7.15,
                longitude: -78.51,
                depth: 30,
              },
            ],
          })
        }
        return new Response('10', { status: 200 })
      }),
    )

    await expect(fetchEarthquakeHistoryCount(undefined, now)).resolves.toBe(11)
  })

  it('coloca la prueba en su puesto del historial', async () => {
    const now = new Date('2026-11-03T18:00:00-05:00')
    const simTime = now.getTime() - 60_000
    const urls: string[] = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string) => {
        const url = String(input)
        urls.push(url)
        if (url.includes('test-quakes')) {
          return Response.json({
            quakes: [
              {
                id: 'sim1',
                magnitude: 4.8,
                place: 'Prueba sísmica',
                time: simTime,
                latitude: -7.15,
                longitude: -78.51,
                depth: 30,
              },
            ],
          })
        }
        if (url.includes('/count')) return new Response('1', { status: 200 })
        return Response.json({
          metadata: { generated: 1, title: 'test', count: 1 },
          features: [
            feature({
              id: 'real',
              properties: { ...feature().properties, time: simTime + 5_000 },
            }),
          ],
        })
      }),
    )

    const page = await fetchEarthquakeHistory(1, 2, undefined, now)
    expect(page.map((item) => item.id)).toEqual(['real', 'sim1'])
    const query = urls.find((url) => url.includes('/query'))
    expect(query).toContain('limit=1')
    expect(query).toContain('offset=1')
  })

  it('limita el conteo histórico a 20000 eventos', () => {
    expect(capHistoryCount(25000)).toBe(20000)
    expect(capHistoryCount(12)).toBe(12)
  })

  it('informa el error cuando USGS no responde y cuando la cuenta no es válida', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('no', { status: 503 })),
    )
    await expect(fetchEarthquakes()).rejects.toThrow(
      'No se pudieron cargar los sismos de USGS',
    )

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('abc', { status: 200 })),
    )
    await expect(fetchEarthquakeHistoryCount()).rejects.toThrow(
      'La cuenta de sismos no es válida',
    )
  })
})

afterEach(() => {
  vi.unstubAllGlobals()
})
