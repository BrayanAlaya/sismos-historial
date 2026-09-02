import { useEffect } from 'react'
import { latLngBounds } from 'leaflet'
import { MapContainer, TileLayer, ZoomControl, useMap } from 'react-leaflet'
import type { Earthquake } from '../types'
import { EarthquakeMarker } from './EarthquakeMarker'

const WORLD_BOUNDS: [[number, number], [number, number]] = [
  [-85, -180],
  [85, 180],
]

const worldLatLngBounds = latLngBounds(WORLD_BOUNDS)

function MapBoundsLock() {
  const map = useMap()

  useEffect(() => {
    const applyLimits = () => {
      const minZoom = map.getBoundsZoom(worldLatLngBounds, true)
      if (!Number.isFinite(minZoom)) return

      map.setMinZoom(minZoom)
      map.setMaxBounds(worldLatLngBounds)

      if (map.getZoom() < minZoom) {
        map.setZoom(minZoom)
      }
    }

    map.whenReady(applyLimits)
    map.on('resize', applyLimits)

    return () => {
      map.off('resize', applyLimits)
    }
  }, [map])

  return null
}

type Props = {
  earthquakes: Earthquake[]
  onSelect: (earthquake: Earthquake) => void
}

export function EarthquakeMap({ earthquakes, onSelect }: Props) {
  return (
    <MapContainer
      center={[18, 10]}
      zoom={3}
      maxZoom={13}
      maxBounds={WORLD_BOUNDS}
      maxBoundsViscosity={1}
      dragging
      scrollWheelZoom
      className="map"
      zoomControl={false}
      attributionControl
    >
      <MapBoundsLock />
      <ZoomControl position="topright" />
      <TileLayer
        noWrap
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> · Datos <a href="https://earthquake.usgs.gov/">USGS</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {earthquakes.map((earthquake) => (
        <EarthquakeMarker
          key={earthquake.id}
          earthquake={earthquake}
          onSelect={onSelect}
        />
      ))}
    </MapContainer>
  )
}
