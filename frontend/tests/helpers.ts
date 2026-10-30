import { boardFromKindIds } from '@/core/board'
import type { BoardSnapshot, Tile } from '@/core/types'

const LETTERS: Record<string, string> = {
  A: 'pin-1',
  B: 'pin-2',
  C: 'pin-3',
  D: 'pin-4',
  E: 'pin-5',
  X: 'sou-1',
  Y: 'sou-2',
  Z: 'man-1',
  F: 'flower-spring',
  G: 'flower-summer',
  H: 'flower-plum',
  I: 'flower-orchid',
  J: 'honor-east',
  K: 'honor-south',
  W: 'honor-white',
}

/** Build a board from ASCII rows; `.` means an empty cell, spaces are ignored. */
export function boardFromRows(rows: readonly string[]): BoardSnapshot {
  if (rows.length === 0) throw new Error('board needs at least one row')
  const cleaned = rows.map((row) => row.replace(/\s+/g, ''))
  const cols = cleaned[0].length
  if (cols === 0) throw new Error('board needs at least one column')

  const ids: string[] = []
  for (const [rowIndex, row] of cleaned.entries()) {
    if (row.length !== cols) {
      throw new Error(`row ${rowIndex} has width ${row.length}, expected ${cols}`)
    }
    for (const char of row) {
      if (char === '.') {
        ids.push('')
        continue
      }
      const kindId = LETTERS[char]
      if (!kindId) throw new Error(`unknown cell character: ${char}`)
      ids.push(kindId)
    }
  }
  return boardFromKindIds(rows.length, cols, ids)
}

export function tileAtRowCol(board: BoardSnapshot, row: number, col: number): Tile {
  const tile = board.cells[row * board.cols + col]
  if (!tile) throw new Error(`no tile at ${row},${col}`)
  return tile
}
