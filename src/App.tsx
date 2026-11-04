import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { fetchEarthquakes } from './api/earthquakes'
import { EarthquakeMap } from './components/EarthquakeMap'
import { EarthquakeModal } from './components/EarthquakeModal'
import { HistoryModal } from './components/HistoryModal'
import { Hud } from './components/Hud'
import type { Earthquake } from './types'
import { playAlertTone } from './utils/alertSound'
import { filterByMinMagnitude, filterByPeru, newSoundQuakeIds } from './utils/earthquake'
import {
  readPeruOnly,
  readSoundEnabled,
  writePeruOnly,
  writeSoundEnabled,
} from './utils/mapPreferences'

const REFRESH_MS = 40_000

export default function App() {
  const [earthquakes, setEarthquakes] = useState<Earthquake[]>([])
  const [selected, setSelected] = useState<Earthquake | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [secondsLeft, setSecondsLeft] = useState(REFRESH_MS / 1000)
  const [minMagnitude, setMinMagnitude] = useState(2.5)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [peruOnly, setPeruOnly] = useState(readPeruOnly)
  const [soundEnabled, setSoundEnabled] = useState(readSoundEnabled)
  const knownQuakeIds = useRef(new Set<string>())
  const feedReady = useRef(false)
  const soundEnabledRef = useRef(soundEnabled)
  soundEnabledRef.current = soundEnabled

  const loadEarthquakes = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true)

    try {
      const data = await fetchEarthquakes()
      const fresh = newSoundQuakeIds(knownQuakeIds.current, data)
      if (feedReady.current && soundEnabledRef.current && fresh.length > 0) {
        playAlertTone()
      }
      for (const item of data) knownQuakeIds.current.add(item.id)
      feedReady.current = true
      setEarthquakes(data)
      setError(null)
      setLastUpdated(new Date())
      setSecondsLeft(REFRESH_MS / 1000)
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Error al actualizar los sismos'
      setError(message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadEarthquakes(false)
    const intervalId = window.setInterval(() => {
      void loadEarthquakes(true)
    }, REFRESH_MS)

    return () => window.clearInterval(intervalId)
  }, [loadEarthquakes])

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setSecondsLeft((current) => Math.max(0, current - 1))
    }, 1000)

    return () => window.clearInterval(intervalId)
  }, [])

  useEffect(() => {
    if (!selected) return

    const updated = earthquakes.find((item) => item.id === selected.id)
    if (updated) setSelected(updated)
  }, [earthquakes, selected])

  const visibleEarthquakes = useMemo(() => {
    const byMagnitude = filterByMinMagnitude(earthquakes, minMagnitude)
    return peruOnly ? filterByPeru(byMagnitude) : byMagnitude
  }, [earthquakes, minMagnitude, peruOnly])

  return (
    <div className="app">
      <EarthquakeMap
        earthquakes={visibleEarthquakes}
        onSelect={setSelected}
      />
      <Hud
        count={visibleEarthquakes.length}
        total={earthquakes.length}
        loading={loading}
        error={error}
        lastUpdated={lastUpdated}
        secondsLeft={secondsLeft}
        minMagnitude={minMagnitude}
        onMinMagnitudeChange={setMinMagnitude}
        peruOnly={peruOnly}
        onPeruOnlyChange={(value) => {
          setPeruOnly(value)
          writePeruOnly(value)
        }}
        soundEnabled={soundEnabled}
        onSoundEnabledChange={(value) => {
          setSoundEnabled(value)
          writeSoundEnabled(value)
        }}
        onOpenHistory={() => setHistoryOpen(true)}
      />
      {historyOpen ? (
        <HistoryModal
          onClose={() => setHistoryOpen(false)}
          onSelect={setSelected}
          closeOnEscape={selected == null}
        />
      ) : null}
      {selected ? (
        <EarthquakeModal
          earthquake={selected}
          onClose={() => setSelected(null)}
        />
      ) : null}
    </div>
  )
}
