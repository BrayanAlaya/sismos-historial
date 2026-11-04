const PERU_KEY = 'sismos.peruOnly'
const SOUND_KEY = 'sismos.soundEnabled'

function readFlag(key: string, fallback: boolean): boolean {
  try {
    const value = localStorage.getItem(key)
    if (value == null) return fallback
    return value === '1'
  } catch {
    return fallback
  }
}

function writeFlag(key: string, value: boolean): void {
  try {
    localStorage.setItem(key, value ? '1' : '0')
  } catch {
    // El navegador puede bloquear el almacenamiento en modo privado.
  }
}

export function readPeruOnly(): boolean {
  return readFlag(PERU_KEY, false)
}

export function writePeruOnly(value: boolean): void {
  writeFlag(PERU_KEY, value)
}

export function readSoundEnabled(): boolean {
  return readFlag(SOUND_KEY, true)
}

export function writeSoundEnabled(value: boolean): void {
  writeFlag(SOUND_KEY, value)
}
