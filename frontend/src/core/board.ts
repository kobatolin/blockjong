/** Immutable board helpers. A board is always rows × cols cells. */
import type { BoardSnapshot, Tile } from './types'

export function createEmptyBoard(rows: number, cols: number): BoardSnapshot {
  return {
    rows,
    cols,
    cells: new Array<Tile | null>(rows * cols).fill(null),
  }
}

export function cellIndex(board: BoardSnapshot, row: number, col: number): number {
  return row * board.cols + col
}

export function inBounds(board: BoardSnapshot, row: number, col: number): boolean {
  return row >= 0 && row < board.rows && col >= 0 && col < board.cols
}

export function tileAt(board: BoardSnapshot, row: number, col: number): Tile | null {
  if (!inBounds(board, row, col)) return null
  return board.cells[cellIndex(board, row, col)]
}

export function tileById(board: BoardSnapshot, id: number): Tile | null {
  for (const tile of board.cells) {
    if (tile && tile.id === id) return tile
  }
  return null
}

export function listTiles(board: BoardSnapshot): Tile[] {
  return board.cells.filter((tile): tile is Tile => tile !== null)
}

export function countTiles(board: BoardSnapshot): number {
  let count = 0
  for (const tile of board.cells) if (tile) count += 1
  return count
}

export function cloneBoard(board: BoardSnapshot): BoardSnapshot {
  return { rows: board.rows, cols: board.cols, cells: board.cells.slice() }
}

export function cloneTile(tile: Tile): Tile {
  return { id: tile.id, kindId: tile.kindId, row: tile.row, col: tile.col }
}

export function setTile(board: BoardSnapshot, tile: Tile): BoardSnapshot {
  const next = cloneBoard(board)
  next.cells[cellIndex(next, tile.row, tile.col)] = tile
  return next
}

export function clearTile(board: BoardSnapshot, row: number, col: number): BoardSnapshot {
  const next = cloneBoard(board)
  next.cells[cellIndex(next, row, col)] = null
  return next
}

export function removeTilesById(board: BoardSnapshot, ids: ReadonlySet<number>): BoardSnapshot {
  const next = cloneBoard(board)
  for (let i = 0; i < next.cells.length; i += 1) {
    const tile = next.cells[i]
    if (tile && ids.has(tile.id)) next.cells[i] = null
  }
  return next
}

export interface TileMove {
  id: number
  row: number
  col: number
}

/** Move tiles to new cells, producing fresh tile objects. */
export function moveTiles(board: BoardSnapshot, moves: readonly TileMove[]): BoardSnapshot {
  const next = cloneBoard(board)
  const moving = new Map<number, TileMove>()
  for (const move of moves) moving.set(move.id, move)

  for (let i = 0; i < next.cells.length; i += 1) {
    const tile = next.cells[i]
    if (tile && moving.has(tile.id)) next.cells[i] = null
  }

  const original = new Map<number, Tile>()
  for (const tile of board.cells) if (tile) original.set(tile.id, tile)

  for (const move of moves) {
    const source = original.get(move.id)
    if (!source) continue
    if (!inBounds(next, move.row, move.col)) continue
    if (next.cells[cellIndex(next, move.row, move.col)]) continue
    next.cells[cellIndex(next, move.row, move.col)] = {
      id: source.id,
      kindId: source.kindId,
      row: move.row,
      col: move.col,
    }
  }
  return next
}

export function boardFromKindIds(
  rows: number,
  cols: number,
  kindIds: readonly string[],
  firstTileId = 1,
): BoardSnapshot {
  const board = createEmptyBoard(rows, cols)
  for (let index = 0; index < board.cells.length; index += 1) {
    const kindId = kindIds[index]
    if (!kindId) continue
    const row = Math.floor(index / cols)
    const col = index % cols
    board.cells[index] = {
      id: firstTileId + index,
      kindId,
      row,
      col,
    }
  }
  return board
}

/** Stable, human-readable signature used by tests and debugging. */
export function boardSignature(board: BoardSnapshot): string {
  return board.cells.map((tile) => tile?.kindId ?? '.').join('|')
}

export function cloneBoardCells(board: BoardSnapshot): (Tile | null)[] {
  return board.cells.map((tile) => (tile ? cloneTile(tile) : null))
}
