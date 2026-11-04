import { describe, expect, it } from 'vitest'
import {
  fetchEarthquakeHistory,
  fetchEarthquakeHistoryCount,
  fetchEarthquakes,
  mapUsgsFeature,
} from '../../src/api/earthquakes'
import { getDangerLevel } from '../../src/utils/earthquake'
import {
  alertPushBody,
  matchAlerts,
  selectAlertableQuakes,
} from '../../supabase/functions/check-nearby-quakes/quake_rules'

describe('criterios de aceptación del producto', () => {
  it('recibe el feed diario de USGS, identifica los eventos válidos y mide el tiempo', async () => {
    const started = performance.now()
    const response = await fetch(
      'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson',
      { headers: { 'User-Agent': 'sismos-aceptacion/1.0' } },
    )
    const latencyMs = Math.round(performance.now() - started)
    expect(response.ok).toBe(true)

    const feed = await response.json()
    const features = feed.features as Array<{
      properties?: { mag?: number | null }
      geometry?: unknown
    }>
    const valid = features.filter(
      (item) => item.geometry != null && typeof item.properties?.mag === 'number',
    )
    const mapped = features
      .map((item) => mapUsgsFeature(item as never))
      .filter((item) => item != null)

    const processingStarted = performance.now()
    features.forEach((item) => mapUsgsFeature(item as never))
    const processingMs = Number((performance.now() - processingStarted).toFixed(2))

    expect(mapped.length).toBe(valid.length)
    expect(mapped.length).toBeGreaterThan(0)
    expect(latencyMs).toBeLessThan(15_000)
    expect(processingMs).toBeLessThan(1_000)
    expect(mapped.every((item) => item.place.length > 0)).toBe(true)
    expect(mapped.every((item) => Number.isFinite(item.latitude))).toBe(true)

  }, 30_000)

  it('la aplicación carga, ordena y permite consultar el historial de 30 días', async () => {
    const loaded = await fetchEarthquakes()
    expect(loaded.length).toBeGreaterThan(0)
    for (let index = 1; index < loaded.length; index += 1) {
      expect(loaded[index - 1].time).toBeGreaterThanOrEqual(loaded[index].time)
    }

    const history = await fetchEarthquakeHistory(1, 5)
    const total = await fetchEarthquakeHistoryCount()
    expect(history.length).toBeGreaterThan(0)
    expect(history.length).toBeLessThanOrEqual(5)
    expect(total).toBeGreaterThan(0)

  }, 30_000)

  it('genera una alerta comprensible para un usuario en Cajamarca dentro del radio', () => {
    const now = Date.now()
    const [quake] = selectAlertableQuakes(
      [
        {
          id: 'aceptacion-cajamarca',
          properties: {
            mag: 4.8,
            place: '12 km al este de Cajamarca, Peru',
            time: now - 60_000,
          },
          geometry: { coordinates: [-78.5, -7.16, 25] },
        },
      ],
      now,
    )
    const [alert] = matchAlerts(
      [
        {
          user_id: 'cajamarca',
          latitude: -7.157,
          longitude: -78.517,
          updated_at: new Date(now).toISOString(),
        },
      ],
      [quake],
      now,
    )

    expect(alert.distance_km).toBeLessThan(80)
    expect(getDangerLevel(alert.magnitude).label).toBe('Moderado')
    const message = alertPushBody(alert.magnitude, alert.distance_km, alert.place)
    expect(message).toContain('M 4.8')
    expect(message).toContain('Cajamarca')
  })
})
