export type Earthquake = {
  id: string
  magnitude: number
  place: string
  title: string
  time: number
  updated: number
  url: string
  felt: number | null
  cdi: number | null
  mmi: number | null
  alert: string | null
  status: string
  tsunami: number
  significance: number
  magType: string
  type: string
  longitude: number
  latitude: number
  depth: number
}

export type UsgsFeature = {
  id: string
  properties: {
    mag: number | null
    place: string | null
    time: number
    updated: number
    url: string
    felt: number | null
    cdi: number | null
    mmi: number | null
    alert: string | null
    status: string
    tsunami: number
    sig: number
    magType: string | null
    type: string | null
    title: string
  }
  geometry: {
    type: string
    coordinates: [number, number, number]
  } | null
}

export type UsgsGeoJson = {
  metadata: {
    generated: number
    title: string
    count: number
  }
  features: UsgsFeature[]
}
