import { DANGER_LEGEND } from '../utils/earthquake'

type Props = {
  count: number
  total: number
  loading: boolean
  error: string | null
  lastUpdated: Date | null
  secondsLeft: number
  minMagnitude: number
  onMinMagnitudeChange: (value: number) => void
  onOpenHistory: () => void
}

export function Hud({
  count,
  total,
  loading,
  error,
  lastUpdated,
  secondsLeft,
  minMagnitude,
  onMinMagnitudeChange,
  onOpenHistory,
}: Props) {
  const updatedText = lastUpdated
    ? lastUpdated.toLocaleTimeString('es-ES', { hour12: false })
    : '—'

  return (
    <>
      <header className="hud hud-top">
        <div>
          <p className="hud-kicker">USGS · tiempo real</p>
          <h1>Sismos en el mundo</h1>
        </div>
        <div className="hud-actions">
          <button type="button" className="hud-button" onClick={onOpenHistory}>
            Historial
          </button>
          <div className="hud-status">
            <span className={`live-dot${loading ? ' is-loading' : ''}`} />
            <div>
              <strong>
                {loading && total === 0
                  ? 'Cargando sismos…'
                  : `${count} sismos visibles`}
              </strong>
              <p>
                {total} en las últimas 24 h · próxima act. {secondsLeft}s
              </p>
            </div>
          </div>
        </div>
      </header>

      <aside className="hud hud-left">
        <label className="filter">
          <span>Magnitud mínima: {minMagnitude.toFixed(1)}</span>
          <input
            type="range"
            min={0}
            max={7}
            step={0.5}
            value={minMagnitude}
            onChange={(event) =>
              onMinMagnitudeChange(Number(event.target.value))
            }
          />
        </label>
        <p className="hud-updated">Última actualización: {updatedText}</p>
        {error ? <p className="hud-error">{error}</p> : null}
      </aside>

      <aside className="hud hud-legend">
        <p className="hud-kicker">Peligrosidad</p>
        <ul>
          {DANGER_LEGEND.map((item) => (
            <li key={item.label}>
              <span style={{ background: item.color }} />
              {item.label}
            </li>
          ))}
        </ul>
        <p className="hud-hint">Arrastra el mapa · clic en un punto para ver detalles</p>
      </aside>
    </>
  )
}
