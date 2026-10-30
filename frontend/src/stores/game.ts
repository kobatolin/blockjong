/** Pinia store for local records and settings. Gameplay state stays in GameSession. */
import { defineStore } from 'pinia'
import { MODE_IDS } from '@/core/kinds'
import type { ModeId } from '@/core/types'

export interface ModeRecord {
  bestTimeMs: number | null
  wins: number
}

export type Records = Record<ModeId, ModeRecord>

export type Quality = 'auto' | 'high' | 'medium' | 'low'
export type MotionPreference = 'auto' | 'reduced'

export interface GameSettings {
  sound: boolean
  quality: Quality
  motion: MotionPreference
  lightIntensity: number
  lightTemperature: number
  tileRoughness: number
  tileReflectivity: number
}

const RECORDS_KEY = 'mahj.records.v1'
const SETTINGS_KEY = 'mahj.settings.v1'

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function defaultSettings(): GameSettings {
  return {
    sound: true,
    quality: 'auto',
    motion: 'auto',
    lightIntensity: 0.9,
    lightTemperature: 4300,
    tileRoughness: 0.68,
    tileReflectivity: 0.18,
  }
}

function loadSettings(): GameSettings {
  const settings = defaultSettings()
  try {
    const raw = globalThis.localStorage?.getItem(SETTINGS_KEY)
    if (!raw) return settings
    const parsed = JSON.parse(raw) as Partial<GameSettings>
    if (typeof parsed.sound === 'boolean') settings.sound = parsed.sound
    if (
      parsed.quality === 'auto' ||
      parsed.quality === 'high' ||
      parsed.quality === 'medium' ||
      parsed.quality === 'low'
    ) {
      settings.quality = parsed.quality
    }
    if (parsed.motion === 'auto' || parsed.motion === 'reduced') {
      settings.motion = parsed.motion
    }
    const number = (
      value: unknown,
      fallback: number,
      min: number,
      max: number,
    ): number =>
      typeof value === 'number' && Number.isFinite(value)
        ? clamp(value, min, max)
        : fallback
    settings.lightIntensity = number(parsed.lightIntensity, settings.lightIntensity, 0.35, 1.8)
    settings.lightTemperature = number(
      parsed.lightTemperature,
      settings.lightTemperature,
      2700,
      6500,
    )
    settings.tileRoughness = number(parsed.tileRoughness, settings.tileRoughness, 0.18, 0.95)
    settings.tileReflectivity = number(
      parsed.tileReflectivity,
      settings.tileReflectivity,
      0,
      1.2,
    )
  } catch {
    // ignore corrupt storage
  }
  return settings
}

function persistSettings(settings: GameSettings): void {
  try {
    globalThis.localStorage?.setItem(SETTINGS_KEY, JSON.stringify(settings))
  } catch {
    // storage may be unavailable/private mode
  }
}

function emptyRecord(): ModeRecord {
  return { bestTimeMs: null, wins: 0 }
}

function emptyRecords(): Records {
  return {
    easy: emptyRecord(),
    medium: emptyRecord(),
    full: emptyRecord(),
  }
}

function loadRecords(): Records {
  const records = emptyRecords()
  try {
    const raw = globalThis.localStorage?.getItem(RECORDS_KEY)
    if (!raw) return records
    const parsed = JSON.parse(raw) as Partial<Record<ModeId, Partial<ModeRecord>>>
    for (const mode of MODE_IDS) {
      const value = parsed[mode]
      if (!value) continue
      records[mode] = {
        bestTimeMs:
          typeof value.bestTimeMs === 'number' && Number.isFinite(value.bestTimeMs)
            ? value.bestTimeMs
            : null,
        wins: typeof value.wins === 'number' ? value.wins : 0,
      }
    }
  } catch {
    // ignore corrupt storage
  }
  return records
}

function persistRecords(records: Records): void {
  try {
    globalThis.localStorage?.setItem(RECORDS_KEY, JSON.stringify(records))
  } catch {
    // storage may be unavailable/private mode
  }
}

export const useGameStore = defineStore('game', {
  state: () => ({
    records: loadRecords(),
    serverVersion: '',
    ...loadSettings(),
  }),
  actions: {
    recordWin(mode: ModeId, timeMs: number) {
      const current = this.records[mode] ?? emptyRecord()
      const bestTime =
        current.bestTimeMs === null ? timeMs : Math.min(current.bestTimeMs, timeMs)
      this.records[mode] = {
        bestTimeMs: bestTime,
        wins: current.wins + 1,
      }
      persistRecords(this.records)
    },
    setServerVersion(version: string) {
      this.serverVersion = version
    },
    persistCurrent() {
      persistSettings({
        sound: this.sound,
        quality: this.quality,
        motion: this.motion,
        lightIntensity: this.lightIntensity,
        lightTemperature: this.lightTemperature,
        tileRoughness: this.tileRoughness,
        tileReflectivity: this.tileReflectivity,
      })
    },
    setSound(value: boolean) {
      this.sound = value
      this.persistCurrent()
    },
    setQuality(value: Quality) {
      this.quality = value
      this.persistCurrent()
    },
    setMotion(value: MotionPreference) {
      this.motion = value
      this.persistCurrent()
    },
    setLightIntensity(value: number) {
      this.lightIntensity = Math.min(1.8, Math.max(0.35, value))
      this.persistCurrent()
    },
    setLightTemperature(value: number) {
      this.lightTemperature = Math.min(6500, Math.max(2700, Math.round(value)))
      this.persistCurrent()
    },
    setTileRoughness(value: number) {
      this.tileRoughness = Math.min(0.95, Math.max(0.18, value))
      this.persistCurrent()
    },
    setTileReflectivity(value: number) {
      this.tileReflectivity = Math.min(1.2, Math.max(0, value))
      this.persistCurrent()
    },
    resetAppearance() {
      const defaults = defaultSettings()
      this.lightIntensity = defaults.lightIntensity
      this.lightTemperature = defaults.lightTemperature
      this.tileRoughness = defaults.tileRoughness
      this.tileReflectivity = defaults.tileReflectivity
      this.persistCurrent()
    },
  },
})
