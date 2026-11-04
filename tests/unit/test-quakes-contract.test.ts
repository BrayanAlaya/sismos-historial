import { describe, expect, it } from 'vitest'
import {
  credentialsMatch,
  parseSimulationInput,
  publicQuakeFromRow,
} from '../../supabase/functions/test-quakes/contract'

const now = Date.parse('2026-11-03T18:00:00-05:00')

describe('contrato de pruebas sísmicas', () => {
  it('acepta la cuenta temporal y rechaza otra', () => {
    expect(credentialsMatch('admin', 'admin', 'admin', 'admin')).toBe(true)
    expect(credentialsMatch('admin', 'otra', 'admin', 'admin')).toBe(false)
    expect(credentialsMatch(1, 'admin', 'admin', 'admin')).toBe(false)
  })

  it('normaliza fecha, coordenadas y magnitud', () => {
    const parsed = parseSimulationInput(
      {
        latitude: '-7.15694',
        longitude: -78.51764,
        time: new Date(now - 60_000).toISOString(),
        place: '  Cajamarca   prueba  ',
      },
      now,
    )
    expect(parsed).toEqual({
      ok: true,
      value: {
        latitude: -7.15694,
        longitude: -78.51764,
        magnitude: 4.8,
        depth: 30,
        time: now - 60_000,
        place: 'Cajamarca prueba',
      },
    })
  })

  it('rechaza una hora fuera de rango y una fila incompleta', () => {
    const parsed = parseSimulationInput(
      { latitude: -7, longitude: -78, time: now + 25 * 60 * 60 * 1000 },
      now,
    )
    expect(parsed.ok).toBe(false)
    expect(
      publicQuakeFromRow({
        id: 'sim1',
        magnitude: 4.8,
        place: 'Prueba sísmica',
        occurred_at: new Date(now).toISOString(),
        latitude: -7.15,
        longitude: -78.51,
        depth_km: 30,
      })?.id,
    ).toBe('sim1')
    expect(
      publicQuakeFromRow({
        id: '',
        magnitude: 4.8,
        place: 'Prueba sísmica',
        occurred_at: new Date(now).toISOString(),
        latitude: -7.15,
        longitude: -78.51,
        depth_km: 30,
      }),
    ).toBeNull()
  })
})
