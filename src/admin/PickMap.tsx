import { useEffect } from 'react'
import { CircleMarker, MapContainer, TileLayer, useMap, useMapEvents } from 'react-leaflet'

type Props = {
  latitude: number | null
  longitude: number | null
  onPick: (latitude: number, longitude: number) => void
}

function ClickToPick({ onPick }: { onPick: Props['onPick'] }) {
  useMapEvents({
    click(event) {
      onPick(
        Math.round(event.latlng.lat * 1e5) / 1e5,
        Math.round(event.latlng.lng * 1e5) / 1e5,
      )
    },
  })
  return null
}

function FollowPoint({
  latitude,
  longitude,
}: {
  latitude: number
  longitude: number
}) {
  const map = useMap()

  useEffect(() => {
    const point: [number, number] = [latitude, longitude]
    if (!map.getBounds().contains(point)) map.panTo(point)
  }, [latitude, longitude, map])

  return null
}

export function PickMap({ latitude, longitude, onPick }: Props) {
  const point =
    latitude != null && longitude != null
      ? ([latitude, longitude] as [number, number])
      : null

  return (
    <MapContainer
      center={point ?? [-7.16, -78.52]}
      zoom={point ? 8 : 5}
      className="admin-map"
      scrollWheelZoom
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <ClickToPick onPick={onPick} />
      {point ? <FollowPoint latitude={point[0]} longitude={point[1]} /> : null}
      {point ? (
        <CircleMarker
          center={point}
          radius={10}
          pathOptions={{ color: '#f59e0b', fillColor: '#f59e0b', fillOpacity: 0.9 }}
        />
      ) : null}
    </MapContainer>
  )
}
