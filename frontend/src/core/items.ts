/** Item rules: a limited number of single-tile moves per game. */
import { inBounds, tileAt } from './board'
import type { BoardSnapshot, Tile } from './types'

/** Uses per game; restarting or switching boards resets the counter. */
export const ITEM_USES_PER_GAME = 3

export interface CellRef {
  row: number
  col: number
}

const NEIGHBORS: ReadonlyArray<readonly [number, number]> = [
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1],
]

/** Empty orthogonal neighbours of a tile, in reading order (up, down, left, right). */
export function adjacentEmptyCells(board: BoardSnapshot, tile: Tile): CellRef[] {
  const cells: CellRef[] = []
  for (const [dr, dc] of NEIGHBORS) {
    const row = tile.row + dr
    const col = tile.col + dc
    if (!inBounds(board, row, col)) continue
    if (tileAt(board, row, col)) continue
    cells.push({ row, col })
  }
  return cells
}

/** Orthogonal adjacency only; diagonals do not count. */
export function isAdjacentCell(a: CellRef, b: CellRef): boolean {
  return Math.abs(a.row - b.row) + Math.abs(a.col - b.col) === 1
}
