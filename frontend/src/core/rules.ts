/** Pairing and line-of-sight rules. */
import { listTiles, tileAt } from './board'
import { kindOf } from './kinds'
import type { BoardSnapshot, Tile, TilePair } from './types'

export function compatible(a: Tile, b: Tile): boolean {
  if (a.id === b.id) return false
  if (a.kindId === b.kindId) return true

  const kindA = kindOf(a.kindId)
  const kindB = kindOf(b.kindId)
  if (kindA.suit === 'flower' && kindB.suit === 'flower') {
    return kindA.flowerGroup === kindB.flowerGroup
  }
  return false
}

/** Same row or column with every cell in between empty. */
export function visible(board: BoardSnapshot, a: Tile, b: Tile): boolean {
  if (a.id === b.id) return false

  if (a.row === b.row) {
    const low = Math.min(a.col, b.col)
    const high = Math.max(a.col, b.col)
    for (let col = low + 1; col < high; col += 1) {
      if (tileAt(board, a.row, col)) return false
    }
    return true
  }

  if (a.col === b.col) {
    const low = Math.min(a.row, b.row)
    const high = Math.max(a.row, b.row)
    for (let row = low + 1; row < high; row += 1) {
      if (tileAt(board, row, a.col)) return false
    }
    return true
  }

  return false
}

export function manhattan(a: Tile, b: Tile): number {
  return Math.abs(a.row - b.row) + Math.abs(a.col - b.col)
}

export function findVisiblePartners(board: BoardSnapshot, tile: Tile): Tile[] {
  const partners: Tile[] = []

  for (let col = 0; col < board.cols; col += 1) {
    const other = tileAt(board, tile.row, col)
    if (!other || other.id === tile.id) continue
    if (compatible(tile, other) && visible(board, tile, other)) partners.push(other)
  }

  for (let row = 0; row < board.rows; row += 1) {
    if (row === tile.row) continue
    const other = tileAt(board, row, tile.col)
    if (!other || other.id === tile.id) continue
    if (compatible(tile, other) && visible(board, tile, other)) partners.push(other)
  }

  return partners
}

/**
 * Find any legal tap pair. Only the nearest tile in each direction can be
 * visible, so we stop scanning after the first occupied cell.
 */
export function findAnyTap(board: BoardSnapshot): TilePair | null {
  for (const a of listTiles(board)) {
    for (let col = a.col + 1; col < board.cols; col += 1) {
      const b = tileAt(board, a.row, col)
      if (!b) continue
      if (compatible(a, b)) return { a, b }
      break
    }
    for (let row = a.row + 1; row < board.rows; row += 1) {
      const b = tileAt(board, row, a.col)
      if (!b) continue
      if (compatible(a, b)) return { a, b }
      break
    }
  }
  return null
}
