import { describe, expect, it } from 'vitest'
import {
  alertPushBody,
  filterKnownAlerts,
  formatAlertDistance,
  haversineKm,
  isLocationFresh,
  locationFreshMs,
  lookbackMs,
  cajamarcaTestFeature,
  isScheduledTestWindow,
  matchAlerts,
  radiusKm,
  repeatTestAlerts,
  scheduledTestQuakeId,
  scheduledTestStartMs,
  scheduledTestWindowMs,
  selectAlertableQuakes,
  simulationsForAlerts,
  storedSimulationFromRow,
} from '../../supabase/functions/check-nearby-quakes/quake_rules'

const now = Date.UTC(2026, 8, 22, 12, 0, 0)
const cajamarca = { latitude: -7.157, longitude: -78.517 }

function feature(magnitude: number, time: number, coordinates?: number[]) {
  return {
    id: `q-${magnitude}-${time}`,
    properties: {
      mag: magnitude,
      place: 'cerca de Cajamarca, Peru',
      time,
    },
    geometry: coordinates ? { coordinates } : null,
  }
}

describe('reglas de alerta por proximidad', () => {
  it('agrega un sismo estático en Cajamarca, Cajamarca, Peru para probar la notificación', () => {
    const feature = cajamarcaTestFeature(now)
    const [quake] = selectAlertableQuakes([feature], now)
    const [alert] = matchAlerts(
      [
        {
          user_id: 'cajamarca',
          latitude: -7.1569,
          longitude: -78.5176,
          updated_at: new Date(now).toISOString(),
        },
      ],
      [quake],
      now,
    )

    expect(repeatTestAlerts).toBe(false)
    expect(quake).toMatchObject({
      id: scheduledTestQuakeId,
      magnitude: 4.8,
      place: 'Cajamarca, Cajamarca, Peru',
      latitude: -7.1569,
      longitude: -78.5176,
      radiusKm: 80,
    })
    expect(alert.distance_km).toBe(0)
    expect(alertPushBody(alert.magnitude, alert.distance_km, alert.place)).toBe(
      'Sismo moderado de M 4.8 a 0 m de ti, en Cajamarca, Cajamarca, Peru.',
    )
  })

  it('repite la alerta de prueba y, al desactivar la repetición, avisa una sola vez', () => {
    const first = cajamarcaTestFeature(now, true)
    const second = cajamarcaTestFeature(now + 6_000, true)
    expect(first.id).not.toBe(second.id)

    const repeated = selectAlertableQuakes([second], now + 6_000)
    const pending = filterKnownAlerts(
      matchAlerts(
        [
          {
            user_id: 'cajamarca',
            latitude: -7.1569,
            longitude: -78.5176,
            updated_at: new Date(now).toISOString(),
          },
        ],
        repeated,
        now + 6_000,
      ),
      [{ user_id: 'cajamarca', quake_id: first.id }],
    )
    expect(pending).toHaveLength(1)

    const stable = cajamarcaTestFeature(now, false)
    expect(stable.id).toBe(scheduledTestQuakeId)
    const [once] = selectAlertableQuakes([stable], now)
    const again = filterKnownAlerts(
      matchAlerts(
        [
          {
            user_id: 'cajamarca',
            latitude: -7.1569,
            longitude: -78.5176,
            updated_at: new Date(now).toISOString(),
          },
        ],
        [once],
        now,
      ),
      [{ user_id: 'cajamarca', quake_id: stable.id }],
    )
    expect(again).toEqual([])
  })

  it('solo inyecta el sismo de prueba de 17:00 a 17:03 en Perú', () => {
    expect(isScheduledTestWindow(scheduledTestStartMs)).toBe(true)
    expect(isScheduledTestWindow(scheduledTestStartMs + scheduledTestWindowMs - 1)).toBe(true)
    expect(isScheduledTestWindow(scheduledTestStartMs - 1)).toBe(false)
    expect(isScheduledTestWindow(scheduledTestStartMs + scheduledTestWindowMs)).toBe(false)
  })

  it('asigna el radio según la magnitud y omite los sismos menores a 2.5', () => {
    expect(radiusKm(6)).toBe(300)
    expect(radiusKm(5)).toBe(150)
    expect(radiusKm(4)).toBe(80)
    expect(radiusKm(2.5)).toBe(40)
    expect(radiusKm(2.4)).toBe(0)
  })

  it('calcula una distancia coherente y un mensaje claro', () => {
    expect(haversineKm(0, 0, 0, 1)).toBeGreaterThan(110)
    expect(haversineKm(0, 0, 0, 1)).toBeLessThan(112)
    expect(formatAlertDistance(0.4)).toBe('a 400 m')
    expect(formatAlertDistance(12.34)).toBe('a 12.3 km')
    expect(alertPushBody(4.5, 12.34, 'cerca de Cajamarca, Peru')).toBe(
      'Sismo moderado de M 4.5 a 12.3 km de ti, en cerca de Cajamarca, Peru.',
    )
  })

  it('detecta solo sismos recientes, con geometría y magnitud alertable', () => {
    const selected = selectAlertableQuakes(
      [
        feature(4.2, now - 60_000, [-78.517, -7.157, 30]),
        feature(4.2, now - lookbackMs - 1, [-78.517, -7.157, 30]),
        feature(1.2, now - 60_000, [-78.517, -7.157, 30]),
        feature(4.2, now - 60_000),
      ],
      now,
    )
    expect(selected).toHaveLength(1)
    expect(selected[0]).toMatchObject({
      magnitude: 4.2,
      latitude: -7.157,
      longitude: -78.517,
      radiusKm: 80,
      place: 'cerca de Cajamarca, Peru',
    })
  })

  it('alerta a un usuario dentro del radio y descarta ubicaciones vencidas o ya notificadas', () => {
    expect(isLocationFresh(new Date(now - locationFreshMs + 1000).toISOString(), now)).toBe(true)
    expect(isLocationFresh(new Date(now - locationFreshMs - 1000).toISOString(), now)).toBe(false)

    const [quake] = selectAlertableQuakes(
      [feature(4.6, now - 60_000, [-78.517, -7.157, 20])],
      now,
    )
    const freshUser = {
      user_id: 'user-cerca',
      ...cajamarca,
      updated_at: new Date(now).toISOString(),
    }
    const staleUser = {
      user_id: 'user-viejo',
      ...cajamarca,
      updated_at: new Date(now - locationFreshMs - 1000).toISOString(),
    }
    const farUser = {
      user_id: 'user-lejos',
      latitude: 0,
      longitude: 0,
      updated_at: new Date(now).toISOString(),
    }

    const matches = matchAlerts([freshUser, staleUser, farUser], [quake], now)
    expect(matches.map((item) => item.user_id)).toEqual(['user-cerca'])
    expect(matches[0].distance_km).toBe(0)

    const pending = filterKnownAlerts(matches, [
      { user_id: 'user-cerca', quake_id: quake.id },
    ])
    expect(pending).toEqual([])
  })
})

describe('pruebas publicadas desde la web', () => {
  it('incorpora al feed de alertas solo las pruebas cuya hora ya llegó', () => {
    const now = Date.parse('2026-11-03T18:00:00-05:00')
    const row = storedSimulationFromRow({
      id: 'sim1',
      magnitude: 4.8,
      place: 'Prueba sísmica',
      occurred_at: new Date(now - 60_000).toISOString(),
      latitude: -7.1569,
      longitude: -78.5176,
      depth_km: 30,
    })
    expect(row?.place).toBe('Prueba sísmica')
    expect(storedSimulationFromRow({ ...{
      id: 'sim1',
      magnitude: 4.8,
      place: 'Prueba sísmica',
      occurred_at: 'no-es-fecha',
      latitude: -7,
      longitude: -78,
      depth_km: 30,
    } })).toBeNull()

    const features = simulationsForAlerts(
      [
        row!,
        { ...row!, id: 'sim-futura', time: now + 60_000 },
      ],
      now,
    )
    expect(features.map((item) => item.id)).toEqual(['sim1'])
    const [quake] = selectAlertableQuakes(features, now)
    expect(quake).toMatchObject({
      id: 'sim1',
      latitude: -7.1569,
      longitude: -78.5176,
      magnitude: 4.8,
    })
  })
})
