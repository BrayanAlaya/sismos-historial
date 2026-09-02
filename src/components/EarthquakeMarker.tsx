import { divIcon } from 'leaflet'
import { Marker } from 'react-leaflet'
import type { Earthquake } from '../types'
import {
  formatMagnitude,
  getMagnitudeColor,
  getMarkerSize,
  isRecent,
} from '../utils/earthquake'

type Props = {
  earthquake: Earthquake
  onSelect: (earthquake: Earthquake) => void
}

export function EarthquakeMarker({ earthquake, onSelect }: Props) {
  const color = getMagnitudeColor(earthquake.magnitude)
  const size = getMarkerSize(earthquake.magnitude)
  const recent = isRecent(earthquake)
  const label = formatMagnitude(earthquake.magnitude)

  const icon = divIcon({
    className: 'eq-icon',
    html: `
      <div class="eq-marker${recent ? ' eq-marker--recent' : ''}">
        <span class="eq-label">${label}</span>
        <span class="eq-dot" style="width:${size}px;height:${size}px;background:${color};box-shadow:0 0 12px ${color}"></span>
      </div>
    `,
    iconSize: [84, 46],
    iconAnchor: [42, 40],
  })

  return (
    <Marker
      position={[earthquake.latitude, earthquake.longitude]}
      icon={icon}
      eventHandlers={{
        click: () => onSelect(earthquake),
      }}
    />
  )
}
