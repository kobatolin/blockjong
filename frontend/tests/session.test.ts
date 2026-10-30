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

  it('auto-slides a single tile when click-click can complete the pair', () => {
    const session = sessionFrom(['A..', '..A', 'XX.'])
    expect(session.tap(0, 0)).toMatchObject({ kind: 'selected' })
    const result = session.tap(1, 2)
    expect(result.kind).toBe('assisted')
    if (result.kind !== 'assisted') throw new Error('expected assisted tap')
    expect(result.moved).toHaveLength(1)
    expect(result.k).toBeGreaterThan(0)
    expect(session.remaining).toBe(2)
    expect(session.moveCount).toBe(1)
    expect(session.selected).toBeNull()
    expect(session.phaseNow).toBe('idle')
    expect(session.undo()).toBe(true)
    expect(session.remaining).toBe(4)
    expect(session.moveCount).toBe(0)
  })

  it('does not auto-slide when the pair needs a multi-tile segment', () => {
    const session = sessionFrom(['XX....', '.AC.A.', '......'])
    session.tap(1, 1)
    const result = session.tap(1, 4)
    expect(result).toMatchObject({ kind: 'switched', reason: 'blocked' })
    expect(session.remaining).toBe(5)
    expect(session.selected).toBe(tileAtRowCol(session.getBoard(), 1, 4).id)
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
    const session = sessionFrom(['A....', '..A..', '.....'])
    session.tap(0, 0)
    const moved = tileAtRowCol(session.getBoard(), 1, 2)
    const result = session.dragEnd(moved.id, 'left', 2)
    expect(result.kind).toBe('matched')
    if (result.kind !== 'matched') return
    expect(result.pair[0]).toMatchObject({ row: 1, col: 0 })
    expect(result.pair[1]).toMatchObject({ row: 0, col: 0 })
  })

  it('does not remove a pair that was already visible and moved with the segment', () => {
    const session = sessionFrom(['..', 'W.', 'W.', '..'])
    const before = boardSignature(session.getBoard())
    const lower = tileAtRowCol(session.getBoard(), 2, 0)
    const result = session.dragEnd(lower.id, 'up', 1)
    expect(result.kind).toBe('reverted')
    expect(session.remaining).toBe(2)
    expect(session.moveCount).toBe(0)
    expect(session.historySize).toBe(0)
    expect(boardSignature(session.getBoard())).toBe(before)
  })

  it('waits for a partner choice when the landing has multiple partners', () => {
    const rows = ['..A..', '.....', 'A....', '.....', '..A..']
    const session = sessionFrom(rows)
    const before = boardSignature(session.getBoard())
    const moved = tileAtRowCol(session.getBoard(), 2, 0)

    const result = session.dragEnd(moved.id, 'right', 2)
    expect(result.kind).toBe('choice')
    if (result.kind !== 'choice') return
    expect(result.candidates).toHaveLength(2)
    expect(session.moveCount).toBe(0)
    expect(session.historySize).toBe(0)
    expect(boardSignature(session.getBoard())).toBe(before)

    const chosen = result.candidates[0]
    const matched = session.tap(chosen.row, chosen.col)
    expect(matched.kind).toBe('choiceMatched')
    if (matched.kind !== 'choiceMatched') return
    expect(matched.pair.map((tile) => tile.id)).toContain(chosen.id)
    expect(session.remaining).toBe(1)
    expect(session.moveCount).toBe(1)
    expect(session.undo()).toBe(true)
    expect(boardSignature(session.getBoard())).toBe(before)
  })

  it('cancels a partner choice and returns the moved tile to its origin', () => {
    const rows = ['..A..', '.....', 'A....', '.....', '..A..']
    const session = sessionFrom(rows)
    const before = boardSignature(session.getBoard())
    const moved = tileAtRowCol(session.getBoard(), 2, 0)

    expect(session.dragEnd(moved.id, 'right', 2).kind).toBe('choice')
    const cancelled = session.tap(2, 1)
    expect(cancelled.kind).toBe('choiceCancelled')
    expect(session.remaining).toBe(3)
    expect(session.moveCount).toBe(0)
    expect(session.historySize).toBe(0)
    expect(boardSignature(session.getBoard())).toBe(before)
    expect(session.tileAt(2, 0)?.id).toBe(moved.id)
  })

  it('keeps the selected anchor as priority even with multiple partners', () => {
    const rows = ['..A..', '.....', 'A....', '.....', '..A..']
    const session = sessionFrom(rows)
    session.tap(0, 2)
    const moved = tileAtRowCol(session.getBoard(), 2, 0)
    const result = session.dragEnd(moved.id, 'right', 2)
    expect(result.kind).toBe('matched')
    if (result.kind !== 'matched') return
    expect(result.pair[1]).toMatchObject({ row: 0, col: 2 })
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
