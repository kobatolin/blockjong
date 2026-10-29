/**
 * Authoritative game state machine.
 *
 * The renderer and Vue store only read snapshots; every board change goes
 * through tap/dragEnd/undo here. Drag previews never mutate the board.
 */
import {
  cloneBoardCells,
  countTiles,
  removeTilesById,
  tileAt,
  tileById,
} from './board'
import { DIRS, findAnyMove, maxSlide, resolveDrag, segment } from './drag'
import type { DragResolution } from './drag'
import { generateBoard } from './generate'
import { compatible, visible } from './rules'
import type {
  BoardSnapshot,
  Dir,
  GameSnapshot,
  ModeId,
  Phase,
  SeedSource,
  Tile,
} from './types'

export interface SessionInit {
  mode: ModeId
  seed: number
  seedSource: SeedSource
  board: BoardSnapshot
}

export interface DragInfo {
  tile: Tile
  ranges: Record<Dir, number>
}

export type TapResult =
  | { kind: 'ignored' }
  | { kind: 'cleared'; hadSelection: boolean }
  | { kind: 'selected'; tileId: number }
  | { kind: 'deselected' }
  | { kind: 'switched'; tileId: number; reason: 'blocked' | 'mismatch' }
  | { kind: 'matched'; pair: [Tile, Tile]; board: BoardSnapshot }

export type DragEndResult =
  | { kind: 'ignored' }
  | { kind: 'noop'; tile: Tile }
  | { kind: 'reverted'; moved: Tile[]; k: number; kMax: number }
  | {
      kind: 'matched'
      pair: [Tile, Tile]
      moved: Tile[]
      board: BoardSnapshot
    }

interface HistoryEntry {
  board: BoardSnapshot
  moves: number
}

function cloneBoardDeep(board: BoardSnapshot): BoardSnapshot {
  return { rows: board.rows, cols: board.cols, cells: cloneBoardCells(board) }
}

export class GameSession {
  readonly mode: ModeId
  readonly seed: number
  readonly seedSource: SeedSource

  private board: BoardSnapshot
  private phase: Phase
  private selectedId: number | null = null
  private moves = 0
  private history: HistoryEntry[] = []

  private constructor(init: SessionInit) {
    this.mode = init.mode
    this.seed = init.seed >>> 0
    this.seedSource = init.seedSource
    this.board = init.board
    this.phase = this.evaluatePhase()
  }

  static create(mode: ModeId, seed: number, seedSource: SeedSource): GameSession {
    return new GameSession({
      mode,
      seed,
      seedSource,
      board: generateBoard(mode, seed),
    })
  }

  static fromBoard(init: SessionInit): GameSession {
    return new GameSession(init)
  }

  get phaseNow(): Phase {
    return this.phase
  }

  get selected(): number | null {
    return this.selectedId
  }

  get remaining(): number {
    return countTiles(this.board)
  }

  get moveCount(): number {
    return this.moves
  }

  get historySize(): number {
    return this.history.length
  }

  getBoard(): BoardSnapshot {
    return cloneBoardDeep(this.board)
  }

  tileAt(row: number, col: number): Tile | null {
    return tileAt(this.board, row, col)
  }

  tileById(id: number): Tile | null {
    return tileById(this.board, id)
  }

  snapshot(): GameSnapshot {
    return {
      mode: this.mode,
      phase: this.phase,
      board: cloneBoardDeep(this.board),
      remaining: countTiles(this.board),
      selectedId: this.selectedId,
      moves: this.moves,
      seed: this.seed,
      seedSource: this.seedSource,
    }
  }

  tap(row: number, col: number): TapResult {
    if (this.phase !== 'idle') return { kind: 'ignored' }

    const target = tileAt(this.board, row, col)
    if (!target) {
      const hadSelection = this.selectedId !== null
      this.selectedId = null
      return { kind: 'cleared', hadSelection }
    }

    if (this.selectedId === null) {
      this.selectedId = target.id
      return { kind: 'selected', tileId: target.id }
    }

    if (this.selectedId === target.id) {
      this.selectedId = null
      return { kind: 'deselected' }
    }

    const anchor = tileById(this.board, this.selectedId)
    if (anchor && compatible(anchor, target) && visible(this.board, anchor, target)) {
      this.pushHistory()
      this.board = removeTilesById(this.board, new Set([anchor.id, target.id]))
      this.moves += 1
      this.selectedId = null
      this.finishMove()
      return {
        kind: 'matched',
        pair: [anchor, target],
        board: this.snapshotBoard(),
      }
    }

    const reason: 'blocked' | 'mismatch' =
      anchor && compatible(anchor, target) ? 'blocked' : 'mismatch'
    this.selectedId = target.id
    return { kind: 'switched', tileId: target.id, reason }
  }

  dragInfo(row: number, col: number): DragInfo | null {
    if (this.phase !== 'idle') return null
    const tile = tileAt(this.board, row, col)
    if (!tile) return null

    const ranges = { left: 0, right: 0, up: 0, down: 0 } as Record<Dir, number>
    for (const dir of DIRS) {
      ranges[dir] = maxSlide(this.board, segment(this.board, tile, dir), dir)
    }
    return { tile, ranges }
  }

  dragPreview(tileId: number, dir: Dir, k: number): DragResolution | null {
    if (this.phase !== 'idle') return null
    const tile = tileById(this.board, tileId)
    if (!tile) return null
    return resolveDrag(this.board, tile, dir, k, this.selectedId)
  }

  dragEnd(tileId: number, dir: Dir, k: number): DragEndResult {
    if (this.phase !== 'idle') return { kind: 'ignored' }
    const tile = tileById(this.board, tileId)
    if (!tile) return { kind: 'ignored' }

    const resolution = resolveDrag(this.board, tile, dir, k, this.selectedId)
    if (resolution.kind === 'none') {
      return { kind: 'noop', tile }
    }

    if (
      resolution.kind === 'revert' ||
      !resolution.dragged ||
      !resolution.partner
    ) {
      return {
        kind: 'reverted',
        moved: resolution.moved,
        k: resolution.k,
        kMax: resolution.kMax,
      }
    }

    this.pushHistory()
    const pair: [Tile, Tile] = [resolution.dragged, resolution.partner]
    this.board = removeTilesById(
      resolution.preview,
      new Set([pair[0].id, pair[1].id]),
    )
    this.moves += 1
    this.selectedId = null
    this.finishMove()

    return {
      kind: 'matched',
      pair,
      moved: resolution.moved,
      board: this.snapshotBoard(),
    }
  }

  undo(): boolean {
    if (this.phase === 'won') return false
    const entry = this.history.pop()
    if (!entry) return false
    this.board = entry.board
    this.moves = entry.moves
    this.phase = 'idle'
    this.selectedId = null
    return true
  }

  hint() {
    if (this.phase !== 'idle') return null
    return findAnyMove(this.board)
  }

  private snapshotBoard(): BoardSnapshot {
    return cloneBoardDeep(this.board)
  }

  private pushHistory(): void {
    this.history.push({
      board: cloneBoardDeep(this.board),
      moves: this.moves,
    })
    if (this.history.length > 50) this.history.shift()
  }

  private evaluatePhase(): Phase {
    const remaining = countTiles(this.board)
    if (remaining === 0) return 'won'
    if (findAnyMove(this.board) === null) return 'deadlock'
    return 'idle'
  }

  private finishMove(): void {
    this.phase = this.evaluatePhase()
  }
}
