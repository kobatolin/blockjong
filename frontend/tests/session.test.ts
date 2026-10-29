import { describe, expect, it } from 'vitest'
import { boardSignature } from '@/core/board'
import { GameSession } from '@/core/session'
import { boardFromRows, tileAtRowCol } from './helpers'

function sessionFrom(rows: string[], seed = 1): GameSession {
  return GameSession.fromBoard({
    mode: 'easy',
    seed,
    seedSource: 'custom',
    board: boardFromRows(rows),
  })
}

describe('tap flow', () => {
  it('selects, matches and removes a pair', () => {
    const session = sessionFrom(['AABB'])
    expect(session.phaseNow).toBe('idle')

    expect(session.tap(0, 0)).toMatchObject({ kind: 'selected' })
    const result = session.tap(0, 1)
    expect(result.kind).toBe('matched')
    expect(session.remaining).toBe(2)
    expect(session.moveCount).toBe(1)
    expect(session.phaseNow).toBe('idle')
    expect(session.selected).toBeNull()
  })

  it('switches the anchor on mismatched tiles', () => {
    const session = sessionFrom(['AABB'])
    session.tap(0, 0)
    const b = tileAtRowCol(session.getBoard(), 0, 2)
    const result = session.tap(0, 2)
    expect(result).toMatchObject({ kind: 'switched', reason: 'mismatch' })
    expect(session.selected).toBe(b.id)
  })

  it('reports a blocked pair and switches the anchor', () => {
    const session = sessionFrom(['ABA.', '..BB'])
    session.tap(0, 0)
    const result = session.tap(0, 2)
    expect(result).toMatchObject({ kind: 'switched', reason: 'blocked' })
    expect(session.selected).toBe(tileAtRowCol(session.getBoard(), 0, 2).id)
  })

  it('deselects on the same tile and clears on empty cells', () => {
    const session = sessionFrom(['AA..'])
    session.tap(0, 0)
    expect(session.tap(0, 0).kind).toBe('deselected')
    session.tap(0, 0)
    const cleared = session.tap(0, 3)
    expect(cleared.kind).toBe('cleared')
    expect(session.selected).toBeNull()
  })

  it('wins when the last pair is removed', () => {
    const session = sessionFrom(['AA'])
    session.tap(0, 0)
    expect(session.tap(0, 1).kind).toBe('matched')
    expect(session.phaseNow).toBe('won')
    expect(session.remaining).toBe(0)
    expect(session.undo()).toBe(false)
  })
})

describe('drag flow', () => {
  it('commits a matched drag and leaves other moved tiles in place', () => {
    const rows = [
      '......',
      'A.....',
      'X.....',
      '......',
      '...A..',
      '....BB',
    ]
    const session = sessionFrom(rows)
    const board = session.getBoard()
    const a = tileAtRowCol(board, 1, 0)
    const x = tileAtRowCol(board, 2, 0)

    const info = session.dragInfo(1, 0)
    expect(info?.ranges.down).toBe(3)

    const preview = session.dragPreview(a.id, 'down', 3)
    expect(preview?.kind).toBe('match')
    expect(session.remaining).toBe(5)

    const result = session.dragEnd(a.id, 'down', 3)
    expect(result.kind).toBe('matched')
    if (result.kind !== 'matched') return
    expect(result.pair[0]).toMatchObject({ row: 4, col: 0 })
    expect(result.pair[1]).toMatchObject({ row: 4, col: 3 })
    expect(session.remaining).toBe(3)
    expect(session.moveCount).toBe(1)
    expect(session.phaseNow).toBe('idle')

    const after = session.getBoard()
    expect(after.cells[5 * after.cols + 0]?.id).toBe(x.id)
  })

  it('undoes a drag back to the pre-drag board', () => {
    const rows = [
      '......',
      'A.....',
      'X.....',
      '......',
      '...A..',
      '....BB',
    ]
    const session = sessionFrom(rows)
    const before = boardSignature(session.getBoard())
    const a = tileAtRowCol(session.getBoard(), 1, 0)

    expect(session.dragEnd(a.id, 'down', 3).kind).toBe('matched')
    expect(session.undo()).toBe(true)
    expect(boardSignature(session.getBoard())).toBe(before)
    expect(session.moveCount).toBe(0)
    expect(session.phaseNow).toBe('idle')
  })

  it('reverts a failed drag without touching history or moves', () => {
    const rows = ['.A..', '....', 'B..B', '....']
    const session = sessionFrom(rows)
    const before = boardSignature(session.getBoard())
    const a = tileAtRowCol(session.getBoard(), 0, 1)

    expect(session.dragInfo(0, 1)?.ranges.down).toBe(3)
    const result = session.dragEnd(a.id, 'down', 1)
    expect(result.kind).toBe('reverted')
    expect(boardSignature(session.getBoard())).toBe(before)
    expect(session.moveCount).toBe(0)
    expect(session.historySize).toBe(0)
  })

  it('treats k = 0 as a no-op', () => {
    const session = sessionFrom(['AABB'])
    const a = tileAtRowCol(session.getBoard(), 0, 0)
    expect(session.dragEnd(a.id, 'right', 0).kind).toBe('noop')
  })

  it('uses the selected anchor as the landing partner', () => {
    const session = sessionFrom(['A.A.A'])
    session.tap(0, 0)
    const moved = tileAtRowCol(session.getBoard(), 0, 2)
    const result = session.dragEnd(moved.id, 'right', 1)
    expect(result.kind).toBe('matched')
    if (result.kind !== 'matched') return
    expect(result.pair.map((tile) => tile.col).sort()).toEqual([0, 3])
  })
})

describe('undo and deadlock', () => {
  it('restores a tap move', () => {
    const session = sessionFrom(['AABB'])
    const before = boardSignature(session.getBoard())
    session.tap(0, 0)
    session.tap(0, 1)
    expect(session.undo()).toBe(true)
    expect(boardSignature(session.getBoard())).toBe(before)
    expect(session.moveCount).toBe(0)
    expect(session.selected).toBeNull()
  })

  it('starts in deadlock when no move exists and refuses input', () => {
    const session = sessionFrom(['AB', 'BA'])
    expect(session.phaseNow).toBe('deadlock')
    expect(session.tap(0, 0).kind).toBe('ignored')
    expect(session.undo()).toBe(false)
  })
})
