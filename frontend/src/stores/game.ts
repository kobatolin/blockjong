/** Pinia store for local records and settings. Gameplay state stays in GameSession. */
import { defineStore } from 'pinia'
import { MODE_IDS } from '@/core/kinds'
import type { ModeId } from '@/core/types'

export interface ModeRecord {
  bestTimeMs: number | null
  bestMoves: number | null
  wins: number
}

export type Records = Record<ModeId, ModeRecord>

const RECORDS_KEY = 'mahj.records.v1'

function emptyRecord(): ModeRecord {
  return { bestTimeMs: null, bestMoves: null, wins: 0 }
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
        bestMoves:
          typeof value.bestMoves === 'number' && Number.isFinite(value.bestMoves)
            ? value.bestMoves
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
    sound: true,
  }),
  actions: {
    recordWin(mode: ModeId, timeMs: number, moves: number) {
      const current = this.records[mode] ?? emptyRecord()
      const bestTime =
        current.bestTimeMs === null ? timeMs : Math.min(current.bestTimeMs, timeMs)
      const bestMoves =
        current.bestMoves === null ? moves : Math.min(current.bestMoves, moves)
      this.records[mode] = {
        bestTimeMs: bestTime,
        bestMoves: bestMoves,
        wins: current.wins + 1,
      }
      persistRecords(this.records)
    },
    setServerVersion(version: string) {
      this.serverVersion = version
    },
  },
})
