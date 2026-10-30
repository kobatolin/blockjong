/** Drag segment, slide range and landing-pair resolution. */
import { cloneBoard, inBounds, listTiles, moveTiles, removeTilesById, tileAt, tileById } from './board'
import { compatible, findVisiblePartners, manhattan, visible } from './rules'
import type { BoardSnapshot, Dir, Tile } from './types'

export const DIRS: readonly Dir[] = ['left', 'right', 'up', 'down']

const DELTA: Record<Dir, { dr: number; dc: number }> = {
  left: { dr: 0, dc: -1 },
  right: { dr: 0, dc: 1 },
  up: { dr: -1, dc: 0 },
  down: { dr: 1, dc: 0 },
}

export function step(tile: Tile, dir: Dir): { row: number; col: number } {
  const delta = DELTA[dir]
  return { row: tile.row + delta.dr, col: tile.col + delta.dc }
}

/** Pressed tile plus every contiguous tile in the drag direction. */
export function segment(board: BoardSnapshot, tile: Tile, dir: Dir): Tile[] {
  const tiles: Tile[] = [tile]
  let current = tile
  for (;;) {
    const next = step(current, dir)
    if (!inBounds(board, next.row, next.col)) break
    const nextTile = tileAt(board, next.row, next.col)
    if (!nextTile) break
    tiles.push(nextTile)
    current = nextTile
  }
  return tiles
}

/** Number of empty cells beyond the leading tile, before a tile/border. */
export function maxSlide(board: BoardSnapshot, tiles: readonly Tile[], dir: Dir): number {
  if (tiles.length === 0) return 0
  let current = tiles[tiles.length - 1]
  let count = 0
  for (;;) {
    const next = step(current, dir)
    if (!inBounds(board, next.row, next.col)) break
    if (tileAt(board, next.row, next.col)) break
    count += 1
    current = { ...current, row: next.row, col: next.col }
  }
  return count
}

export interface SlideResult {
  board: BoardSnapshot
  moved: Tile[]
}

/** Translate the whole segment by k cells; caller must clamp k to maxSlide. */
export function slide(
  board: BoardSnapshot,
  tiles: readonly Tile[],
  dir: Dir,
  k: number,
): SlideResult {
  const delta = DELTA[dir]
  const moves = tiles.map((tile) => ({
    id: tile.id,
    row: tile.row + delta.dr * k,
    col: tile.col + delta.dc * k,
  }))
  const next = moveTiles(board, moves)
  const moved = moves
    .map((move) => tileById(next, move.id))
    .filter((tile): tile is Tile => tile !== null)
  return { board: next, moved }
}

/**
 * Pick the landing partner: the selected anchor if it qualifies, otherwise
 * the nearest visible compatible tile (row/col then id order for ties).
 */
export function choosePartner(
  board: BoardSnapshot,
  dragged: Tile,
  anchorId: number | null,
): Tile | null {
  const candidates = findVisiblePartners(board, dragged)
  if (candidates.length === 0) return null

  if (anchorId !== null) {
    const anchor = tileById(board, anchorId)
    if (
      anchor &&
      anchor.id !== dragged.id &&
      candidates.some((tile) => tile.id === anchor.id)
    ) {
      return anchor
    }
  }

  candidates.sort((a, b) => {
    const distance = manhattan(dragged, a) - manhattan(dragged, b)
    if (distance !== 0) return distance
    if (a.row !== b.row) return a.row - b.row
    return a.col - b.col
  })
  return candidates[0] ?? null
}

export interface DragResolution {
  kind: 'none' | 'revert' | 'match'
  k: number
  kMax: number
  moved: Tile[]
  preview: BoardSnapshot
  dragged: Tile | null
  partner: Tile | null
}

export function resolveDrag(
  board: BoardSnapshot,
  tile: Tile,
  dir: Dir,
  k: number,
  anchorId: number | null = null,
): DragResolution {
  const tiles = segment(board, tile, dir)
  const kMax = maxSlide(board, tiles, dir)
  const clamped = Math.max(0, Math.min(Math.floor(k), kMax))

  if (clamped === 0) {
    return {
      kind: 'none',
      k: 0,
      kMax,
      moved: [],
      preview: cloneBoard(board),
      dragged: tile,
      partner: null,
    }
  }

  const preview = slide(board, tiles, dir, clamped).board
  const dragged = tileById(preview, tile.id)
  if (!dragged) {
    return {
      kind: 'revert',
      k: clamped,
      kMax,
      moved: [],
      preview: cloneBoard(board),
      dragged: null,
      partner: null,
    }
  }

  const partner = choosePartner(preview, dragged, anchorId)
  const moved = tiles
    .map((source) => tileById(preview, source.id))
    .filter((movedTile): movedTile is Tile => movedTile !== null)

  return {
    kind: partner ? 'match' : 'revert',
    k: clamped,
    kMax,
    moved,
    preview,
    dragged,
    partner,
  }
}

export interface AssistedTapMove {
  mover: Tile
  dir: Dir
  k: number
  partner: Tile
  moved: Tile[]
  preview: BoardSnapshot
  board: BoardSnapshot
}

/**
 * A click-click shortcut for a pair that needs exactly one single-tile slide.
 * The moving segment must contain only the pressed tile; a multi-tile push
 * still has to be dragged manually.
 */
export function findAssistedTap(
  board: BoardSnapshot,
  a: Tile,
  b: Tile,
): AssistedTapMove | null {
  if (a.id === b.id || !compatible(a, b) || visible(board, a, b)) return null

  let best: AssistedTapMove | null = null
  for (const [mover, other] of [
    [a, b],
    [b, a],
  ] as const) {
    for (const dir of DIRS) {
      const tiles = segment(board, mover, dir)
      if (tiles.length !== 1) continue
      const kMax = maxSlide(board, tiles, dir)
      for (let k = 1; k <= kMax; k += 1) {
        const resolution = resolveDrag(board, mover, dir, k, other.id)
        if (
          resolution.kind !== 'match' ||
          !resolution.dragged ||
          resolution.partner?.id !== other.id
        ) {
          continue
        }
        const moved = resolution.moved
        const nextBoard = removeTilesById(
          resolution.preview,
          new Set([resolution.dragged.id, resolution.partner.id]),
        )
        const candidate: AssistedTapMove = {
          mover,
          dir,
          k: resolution.k,
          partner: resolution.partner,
          moved,
          preview: resolution.preview,
          board: nextBoard,
        }
        if (!best || candidate.k < best.k) best = candidate
      }
      if (best) break
    }
    if (best) break
  }
  return best
}

export interface DragMove {
  tile: Tile
  dir: Dir
  k: number
  partner: Tile
  preview: BoardSnapshot
  moved: Tile[]
}

export function findAnyDrag(board: BoardSnapshot): DragMove | null {
  for (const tile of listTiles(board)) {
    for (const dir of DIRS) {
      const tiles = segment(board, tile, dir)
      const kMax = maxSlide(board, tiles, dir)
      for (let k = 1; k <= kMax; k += 1) {
        const resolution = resolveDrag(board, tile, dir, k, null)
        if (resolution.kind === 'match' && resolution.partner) {
          return {
            tile,
            dir,
            k,
            partner: resolution.partner,
            preview: resolution.preview,
            moved: resolution.moved,
          }
        }
      }
    }
  }
  return null
}

export type AnyMove =
  | { kind: 'tap'; a: Tile; b: Tile }
  | { kind: 'drag'; move: DragMove }

export function findAnyMove(board: BoardSnapshot): AnyMove | null {
  // Kept local to avoid a circular import with rules.ts.
  for (const a of listTiles(board)) {
    for (let col = a.col + 1; col < board.cols; col += 1) {
      const b = tileAt(board, a.row, col)
      if (!b) continue
      if (compatible(a, b) && visible(board, a, b)) return { kind: 'tap', a, b }
      break
    }
    for (let row = a.row + 1; row < board.rows; row += 1) {
      const b = tileAt(board, row, a.col)
      if (!b) continue
      if (compatible(a, b) && visible(board, a, b)) return { kind: 'tap', a, b }
      break
    }
  }

  const drag = findAnyDrag(board)
  return drag ? { kind: 'drag', move: drag } : null
}

export function isDeadlocked(board: BoardSnapshot): boolean {
  return findAnyMove(board) === null
}
