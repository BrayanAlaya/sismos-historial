import { useEffect, useState } from 'react'
import {
  deleteTestQuake,
  listPublishedQuakes,
  loginTestAdmin,
  publishTestQuake,
  simulationInputError,
  simulationVisibility,
  TestAdminError,
  type SimulatedQuake,
} from '../api/simulations'
import { formatCoordinates, formatDateTime, formatMagnitude } from '../utils/earthquake'
import { PickMap } from './PickMap'

type Credentials = {
  username: string
  password: string
}

const visibilityLabel = {
  programada: 'Programada: aparece al llegar la hora',
  mapa: 'En el mapa y en el historial',
  historial: 'Solo en el historial',
  fuera: 'Fuera de los últimos 30 días',
} as const

function pad(value: number) {
  return String(value).padStart(2, '0')
}

function todayInput(now = new Date()) {
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

function timeInput(now = new Date()) {
  return `${pad(now.getHours())}:${pad(now.getMinutes())}`
}

function parseCoordinate(value: string, min: number, max: number) {
  const number = Number(value)
  if (!Number.isFinite(number) || number < min || number > max) return null
  return number
}

export default function AdminApp() {
  const [credentials, setCredentials] = useState<Credentials | null>(null)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loginError, setLoginError] = useState<string | null>(null)
  const [loggingIn, setLoggingIn] = useState(false)

  if (!credentials) {
    return (
      <main className="admin-page">
        <form
          className="admin-card admin-login"
          onSubmit={(event) => {
            event.preventDefault()
            setLoggingIn(true)
            setLoginError(null)
            void loginTestAdmin(username.trim(), password)
              .then(() => setCredentials({ username: username.trim(), password }))
              .catch((error: unknown) => {
                setLoginError(
                  error instanceof TestAdminError
                    ? error.message
                    : 'No se pudo iniciar sesión.',
                )
              })
              .finally(() => setLoggingIn(false))
          }}
        >
          <div className="admin-intro">
            <p className="hud-kicker">Cuenta de prueba</p>
            <h1>Publicar un sismo</h1>
            <p className="admin-lead">
              Entra para incrustar un sismo de prueba en la respuesta de USGS. El mapa,
              el historial y la aplicación móvil lo tratan como un registro real.
            </p>
          </div>
          <label>
            Usuario
            <input
              name="username"
              autoComplete="username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              required
            />
          </label>
          <label>
            Contraseña
            <input
              name="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </label>
          {loginError ? <p className="admin-error">{loginError}</p> : null}
          <button type="submit" className="hud-button" disabled={loggingIn}>
            {loggingIn ? 'Entrando…' : 'Entrar'}
          </button>
          <a className="admin-back" href="/">
            Volver al mapa
          </a>
        </form>
      </main>
    )
  }

  return (
    <Publisher
      credentials={credentials}
      onLogout={() => {
        setPassword('')
        setCredentials(null)
      }}
    />
  )
}

function Publisher({
  credentials,
  onLogout,
}: {
  credentials: Credentials
  onLogout: () => void
}) {
  const [date, setDate] = useState(() => todayInput())
  const [time, setTime] = useState(() => timeInput())
  const [latitude, setLatitude] = useState('-7.1569')
  const [longitude, setLongitude] = useState('-78.5176')
  const [magnitude, setMagnitude] = useState('4.8')
  const [depth, setDepth] = useState('30')
  const [place, setPlace] = useState('Prueba sísmica')
  const [quakes, setQuakes] = useState<SimulatedQuake[]>([])
  const [listError, setListError] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [loadingList, setLoadingList] = useState(true)

  async function reload() {
    setLoadingList(true)
    try {
      setQuakes(await listPublishedQuakes())
      setListError(null)
    } catch (error) {
      setListError(
        error instanceof TestAdminError
          ? error.message
          : 'No se pudieron cargar las pruebas.',
      )
    } finally {
      setLoadingList(false)
    }
  }

  useEffect(() => {
    void reload()
  }, [])

  const latitudeNumber = parseCoordinate(latitude, -90, 90)
  const longitudeNumber = parseCoordinate(longitude, -180, 180)

  return (
    <main className="admin-page">
      <header className="admin-top">
        <div>
          <p className="hud-kicker">USGS · prueba</p>
          <h1>Sismo de prueba</h1>
        </div>
        <div className="admin-top-actions">
          <a className="hud-button" href="/">
            Ver mapa
          </a>
          <button type="button" className="admin-ghost" onClick={onLogout}>
            Salir
          </button>
        </div>
      </header>

      <section className="admin-layout">
        <form
          className="admin-card"
          onSubmit={(event) => {
            event.preventDefault()
            setFormError(null)
            setNotice(null)
            const occurredAt = new Date(`${date}T${time}`).getTime()
            const draft = {
              latitude: Number(latitude),
              longitude: Number(longitude),
              magnitude: Number(magnitude),
              depth: Number(depth),
              time: occurredAt,
            }
            const message = simulationInputError(draft)
            if (message) {
              setFormError(message)
              return
            }
            setSaving(true)
            void publishTestQuake(credentials, { ...draft, place: place.trim() })
              .then(async () => {
                setNotice(
                  'Prueba publicada. El mapa y la app la verán en la próxima actualización.',
                )
                await reload()
              })
              .catch((error: unknown) => {
                setFormError(
                  error instanceof TestAdminError
                    ? error.message
                    : 'No se pudo publicar la prueba.',
                )
              })
              .finally(() => setSaving(false))
          }}
        >
          <div className="admin-fields">
            <label>
              Fecha
              <input
                type="date"
                value={date}
                onChange={(event) => setDate(event.target.value)}
                required
              />
            </label>
            <label>
              Hora
              <input
                type="time"
                value={time}
                onChange={(event) => setTime(event.target.value)}
                required
              />
            </label>
            <label>
              Latitud
              <input
                inputMode="decimal"
                value={latitude}
                onChange={(event) => setLatitude(event.target.value)}
                required
              />
            </label>
            <label>
              Longitud
              <input
                inputMode="decimal"
                value={longitude}
                onChange={(event) => setLongitude(event.target.value)}
                required
              />
            </label>
            <label>
              Magnitud
              <input
                inputMode="decimal"
                min={0.1}
                max={10}
                step={0.1}
                value={magnitude}
                onChange={(event) => setMagnitude(event.target.value)}
                required
              />
            </label>
            <label>
              Profundidad (km)
              <input
                inputMode="decimal"
                min={0}
                max={800}
                step={0.1}
                value={depth}
                onChange={(event) => setDepth(event.target.value)}
                required
              />
            </label>
          </div>
          <label>
            Lugar
            <input
              value={place}
              maxLength={140}
              onChange={(event) => setPlace(event.target.value)}
              required
            />
          </label>
          <p className="admin-lead">
            Si la hora está dentro de las últimas 24 horas, el sismo entra al mapa. Si
            está dentro de los últimos 30 días, entra al historial. Una magnitud de
            2.5 o más también puede avisar a quien esté cerca.
          </p>
          {formError ? <p className="admin-error">{formError}</p> : null}
          {notice ? <p className="admin-notice">{notice}</p> : null}
          <button type="submit" className="hud-button" disabled={saving}>
            {saving ? 'Publicando…' : 'Publicar prueba'}
          </button>
        </form>

        <div className="admin-card admin-map-card">
          <p className="admin-lead">Haz clic en el mapa para elegir las coordenadas.</p>
          <PickMap
            latitude={latitudeNumber}
            longitude={longitudeNumber}
            onPick={(nextLatitude, nextLongitude) => {
              setLatitude(String(nextLatitude))
              setLongitude(String(nextLongitude))
            }}
          />
        </div>
      </section>

      <section className="admin-card">
        <h2>Pruebas publicadas</h2>
        {listError ? <p className="admin-error">{listError}</p> : null}
        {loadingList ? <p className="admin-lead">Cargando pruebas…</p> : null}
        {!loadingList && quakes.length === 0 ? (
          <p className="admin-lead">Todavía no hay pruebas publicadas.</p>
        ) : null}
        {quakes.length > 0 ? (
          <ul className="admin-list">
            {quakes.map((quake) => {
              const visibility = simulationVisibility(quake.time)
              return (
                <li key={quake.id}>
                  <div>
                    <strong>
                      {formatMagnitude(quake.magnitude)} · {quake.place}
                    </strong>
                    <p>
                      {formatDateTime(quake.time)} ·{' '}
                      {formatCoordinates(quake.latitude, quake.longitude)} ·{' '}
                      {quake.depth.toFixed(1)} km
                    </p>
                    <p className={`admin-badge admin-badge--${visibility}`}>
                      {visibilityLabel[visibility]}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="admin-danger"
                    onClick={() => {
                      if (!window.confirm('¿Quitar esta prueba del mapa y del historial?')) {
                        return
                      }
                      setNotice(null)
                      void deleteTestQuake(credentials, quake.id)
                        .then(reload)
                        .catch((error: unknown) => {
                          setListError(
                            error instanceof TestAdminError
                              ? error.message
                              : 'No se pudo eliminar la prueba.',
                          )
                        })
                    }}
                  >
                    Quitar
                  </button>
                </li>
              )
            })}
          </ul>
        ) : null}
      </section>
    </main>
  )
}
