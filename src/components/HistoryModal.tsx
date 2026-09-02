import { useEffect, useMemo, useState } from 'react'
import {
  fetchEarthquakeHistory,
  fetchEarthquakeHistoryCount,
} from '../api/earthquakes'
import type { Earthquake } from '../types'
import {
  formatMagnitude,
  formatRelativeTime,
  formatShortDateTime,
  getDangerLevel,
} from '../utils/earthquake'

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100]

type Props = {
  onClose: () => void
  onSelect: (earthquake: Earthquake) => void
  closeOnEscape: boolean
}

export function HistoryModal({ onClose, onSelect, closeOnEscape }: Props) {
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [earthquakes, setEarthquakes] = useState<Earthquake[]>([])
  const [total, setTotal] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const totalCount = total ?? 0
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize) || 1)
  const canGoNext =
    total == null ? earthquakes.length === pageSize : page < totalPages

  useEffect(() => {
    if (!closeOnEscape) return

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [closeOnEscape, onClose])

  useEffect(() => {
    const controller = new AbortController()

    async function loadCount() {
      try {
        const count = await fetchEarthquakeHistoryCount(controller.signal)
        setTotal(count)
      } catch {
        if (controller.signal.aborted) return
      }
    }

    void loadCount()
    return () => controller.abort()
  }, [])

  useEffect(() => {
    const controller = new AbortController()

    async function loadPage() {
      setLoading(true)
      setError(null)

      try {
        const data = await fetchEarthquakeHistory(
          page,
          pageSize,
          controller.signal,
        )
        setEarthquakes(data)
      } catch (err) {
        if (controller.signal.aborted) return
        const message =
          err instanceof Error ? err.message : 'Error al cargar el historial'
        setError(message)
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }

    void loadPage()
    return () => controller.abort()
  }, [page, pageSize])

  useEffect(() => {
    if (total != null && page > totalPages) setPage(totalPages)
  }, [page, total, totalPages])

  const rangeLabel = useMemo(() => {
    if (total == null) {
      if (earthquakes.length === 0) return 'Cargando…'
      const from = (page - 1) * pageSize + 1
      const to = from + earthquakes.length - 1
      return `${from}–${to}`
    }
    if (totalCount === 0) return '0 resultados'
    const from = (page - 1) * pageSize + 1
    const to = Math.min(page * pageSize, totalCount)
    return `${from}–${to} de ${totalCount.toLocaleString('es-ES')}`
  }, [earthquakes.length, page, pageSize, total, totalCount])

  function handlePageSizeChange(value: number) {
    setPageSize(value)
    setPage(1)
  }

  return (
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <article
        className="modal history-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="history-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="modal-header">
          <div>
            <p className="modal-kicker">Catálogo USGS · últimos 30 días</p>
            <h2 id="history-title">Historial de terremotos</h2>
          </div>
          <button className="modal-close" onClick={onClose} aria-label="Cerrar">
            ×
          </button>
        </header>

        <div className="history-toolbar">
          <p className="history-range">{rangeLabel}</p>
          <label className="history-pagesize">
            Items por página
            <select
              value={pageSize}
              onChange={(event) =>
                handlePageSizeChange(Number(event.target.value))
              }
            >
              {PAGE_SIZE_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className={`history-table-wrap${loading ? ' is-loading' : ''}`}>
          {error ? (
            <p className="history-empty">{error}</p>
          ) : earthquakes.length === 0 && !loading ? (
            <p className="history-empty">No hay sismos en esta página.</p>
          ) : (
            <table className="history-table">
              <thead>
                <tr>
                  <th>Mag.</th>
                  <th>Lugar</th>
                  <th>Fecha</th>
                  <th>Profundidad</th>
                  <th>Peligro</th>
                </tr>
              </thead>
              <tbody>
                {earthquakes.map((earthquake) => {
                  const danger = getDangerLevel(earthquake.magnitude)
                  return (
                    <tr
                      key={earthquake.id}
                      onClick={() => onSelect(earthquake)}
                    >
                      <td>
                        <strong style={{ color: danger.color }}>
                          {formatMagnitude(earthquake.magnitude)}
                        </strong>
                      </td>
                      <td>
                        <span className="history-place">{earthquake.place}</span>
                        <small>{formatRelativeTime(earthquake.time)}</small>
                      </td>
                      <td>{formatShortDateTime(earthquake.time)}</td>
                      <td>{earthquake.depth.toFixed(1)} km</td>
                      <td>
                        <span
                          className="danger-badge"
                          style={{
                            background: `${danger.color}22`,
                            color: danger.color,
                          }}
                        >
                          {danger.label}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>

        <footer className="history-pagination">
          <button
            type="button"
            className="history-page-btn"
            disabled={page <= 1 || loading}
            onClick={() => setPage((current) => Math.max(1, current - 1))}
          >
            Anterior
          </button>
          <span className="history-page-indicator">
            Página
            <input
              type="number"
              min={1}
              max={total ?? undefined}
              value={page}
              onChange={(event) => {
                const next = Number(event.target.value)
                if (!Number.isFinite(next) || next < 1) return
                setPage(
                  total == null ? next : Math.min(totalPages, Math.floor(next)),
                )
              }}
            />
            {total != null ? ` de ${totalPages}` : ''}
          </span>
          <button
            type="button"
            className="history-page-btn"
            disabled={!canGoNext || loading}
            onClick={() =>
              setPage((current) =>
                total == null ? current + 1 : Math.min(totalPages, current + 1),
              )
            }
          >
            Siguiente
          </button>
        </footer>
      </article>
    </div>
  )
}
