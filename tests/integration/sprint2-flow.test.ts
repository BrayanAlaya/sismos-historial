import { describe, expect, it } from 'vitest'
import { parseEarthquakeFeed } from '../../src/api/earthquakes'
import type { UsgsFeature, UsgsGeoJson } from '../../src/types'
import {
  filterByPeru,
  newSoundQuakeIds,
  priorityRecommendations,
} from '../../src/utils/earthquake'

function feature(
  id: string,
  magnitude: number,
  latitude: number,
  longitude: number,
  place: string,
): UsgsFeature {
  return {
    id,
    properties: {
      mag: magnitude,
      place,
      time: 1_762_000_000_000,
      updated: 1_762_000_100_000,
      url: 'https://earthquake.usgs.gov',
      felt: null,
      cdi: null,
      mmi: null,
      alert: null,
      status: 'automatic',
      tsunami: 0,
      sig: 100,
      magType: 'ml',
      type: 'earthquake',
      title: `M ${magnitude} - ${place}`,
    },
    geometry: {
      type: 'Point',
      coordinates: [longitude, latitude, 30],
    },
  }
}

describe('integración del sprint 2 sobre un feed', () => {
  it('identifica Perú, prioriza la recomendación y suena solo ante el evento nuevo de M 4 o más', () => {
    const feed: UsgsGeoJson = {
      metadata: { generated: 1, title: 'prueba', count: 3 },
      features: [
        feature('cajamarca', 4.8, -7.157, -78.517, '12 km al este de Cajamarca, Peru'),
        feature('leve-peru', 3.1, -12.05, -77.04, 'Lima, Peru'),
        feature('santiago', 5.2, -33.45, -70.67, 'Santiago, Chile'),
        feature('sin-geometria', 6, 0, 0, 'incompleto'),
      ],
    }
    feed.features[3].geometry = null

    const mapped = parseEarthquakeFeed(feed, true)
    expect(mapped).toHaveLength(3)

    const inPeru = filterByPeru(mapped)
    expect(inPeru.map((item) => item.id)).toEqual(['cajamarca', 'leve-peru'])

    const sounded = newSoundQuakeIds(new Set(['leve-peru']), inPeru)
    expect(sounded).toEqual(['cajamarca'])
    expect(priorityRecommendations(inPeru[0].magnitude).join(' ')).toContain(
      'Agáchate',
    )
  })
})
