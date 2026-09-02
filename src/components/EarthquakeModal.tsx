import { useEffect } from 'react'
import type { Earthquake } from '../types'
import {
  formatCoordinates,
  formatDateTime,
  formatMagnitude,
  formatRelativeTime,
  getDangerLevel,
} from '../utils/earthquake'

type Props = {
  earthquake: Earthquake
  onClose: () => void
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="modal-row">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  )
}

export function EarthquakeModal({ earthquake, onClose }: Props) {
  const danger = getDangerLevel(earthquake.magnitude)

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  const feltText =
    earthquake.felt != null
      ? `${earthquake.felt.toLocaleString('es-ES')} reportes`
      : 'Sin reportes'

  const intensityText =
    earthquake.mmi != null ? earthquake.mmi.toFixed(1) : 'No disponible'

  const communityIntensity =
    earthquake.cdi != null ? earthquake.cdi.toFixed(1) : 'No disponible'

  return (
    <div
      className="modal-backdrop modal-backdrop--detail"
      onClick={onClose}
      role="presentation"
    >
      <article
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="earthquake-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="modal-header">
          <div>
            <p className="modal-kicker">Detalle del sismo</p>
            <h2 id="earthquake-title">{earthquake.place}</h2>
          </div>
          <button className="modal-close" onClick={onClose} aria-label="Cerrar">
            ×
          </button>
        </header>

        <div className="modal-hero">
          <div>
            <span className="modal-mag" style={{ color: danger.color }}>
              {formatMagnitude(earthquake.magnitude)}
            </span>
            <span className="modal-mag-type">{earthquake.magType}</span>
          </div>
          <span
            className="danger-badge"
            style={{ background: `${danger.color}22`, color: danger.color }}
          >
            {danger.label}
          </span>
        </div>

        {earthquake.tsunami === 1 ? (
          <p className="tsunami-alert">Alerta de tsunami asociada a este evento</p>
        ) : null}

        <dl className="modal-grid">
          <InfoRow label="Hace" value={formatRelativeTime(earthquake.time)} />
          <InfoRow label="Fecha y hora" value={formatDateTime(earthquake.time)} />
          <InfoRow
            label="Profundidad"
            value={`${earthquake.depth.toFixed(1)} km`}
          />
          <InfoRow
            label="Coordenadas"
            value={formatCoordinates(earthquake.latitude, earthquake.longitude)}
          />
          <InfoRow label="Tipo" value={earthquake.type} />
          <InfoRow label="Estado" value={earthquake.status} />
          <InfoRow label="Personas que lo sintieron" value={feltText} />
          <InfoRow label="Intensidad MMI" value={intensityText} />
          <InfoRow label="Intensidad comunitaria" value={communityIntensity} />
          <InfoRow
            label="Alerta USGS"
            value={earthquake.alert ?? 'Sin alerta'}
          />
          <InfoRow
            label="Significancia"
            value={String(earthquake.significance)}
          />
          <InfoRow label="ID USGS" value={earthquake.id} />
        </dl>

        <a
          className="modal-link"
          href={earthquake.url}
          target="_blank"
          rel="noreferrer"
        >
          Ver ficha completa en USGS
        </a>
      </article>
    </div>
  )
}
