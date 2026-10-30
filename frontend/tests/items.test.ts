import { describe, expect, it } from 'vitest'
import { boardSignature } from '@/core/board'
import { GameSession } from '@/core/session'
import { ITEM_USES_PER_GAME } from '@/core/items'
import { boardFromRows, tileAtRowCol } from './helpers'

function sessionFrom(rows: string[], seed = 1): GameSession {
  return GameSession.fromBoard({
    mode: 'easy',
    seed,
    seedSource: 'custom',
    board: boardFromRows(rows),
  })
}

function select(session: GameSession, row: number, col: number): void {
  const result = session.tap(row, col)
  expect(result.kind).toBe('itemSelected')
}

describe('item uses', () => {
  it('starts with three uses in every game', () => {
    const session = sessionFrom(['AAB.....'])
    expect(session.itemUsesLeft).toBe(ITEM_USES_PER_GAME)
    expect(ITEM_USES_PER_GAME).toBe(3)
    expect(session.snapshot().itemUses).toBe(3)
    expect(session.itemActiveNow).toBe(false)
  })

  it('moves one tile to an adjacent empty cell without counting a move', () => {
    const session = sessionFrom(['AAB....'])
    const b = tileAtRowCol(session.getBoard(), 0, 2)

    expect(session.beginItemMove()).toBe(true)
    expect(session.itemActiveNow).toBe(true)
    select(session, 0, 2)
    expect(session.itemTargets()).toEqual([{ row: 0, col: 3 }])

    const result = session.tap(0, 3)
    expect(result.kind).toBe('itemMoved')
    if (result.kind !== 'itemMoved') return
    expect(result.from).toEqual({ row: 0, col: 2 })
    expect(result.to).toEqual({ row: 0, col: 3 })
    expect(result.itemUsesLeft).toBe(2)
    expect(session.itemUsesLeft).toBe(2)
    expect(session.itemActiveNow).toBe(false)
    expect(session.tileAt(0, 2)).toBeNull()
    expect(session.tileAt(0, 3)?.id).toBe(b.id)
    expect(session.moveCount).toBe(0)
    expect(session.remaining).toBe(3)
  })

  it('rejects non-adjacent and diagonal targets', () => {
    const session = sessionFrom(['AAB..', '.....'])
    const before = boardSignature(session.getBoard())

    session.beginItemMove()
    select(session, 0, 2)
    expect(session.tap(1, 3)).toMatchObject({ kind: 'itemRejected', reason: 'not-adjacent' })
    expect(session.tap(1, 1)).toMatchObject({ kind: 'itemRejected', reason: 'not-adjacent' })
    expect(session.itemUsesLeft).toBe(3)
    expect(boardSignature(session.getBoard())).toBe(before)
    expect(session.itemActiveNow).toBe(true)
  })

  it('cannot pick a tile with no empty neighbour', () => {
    const session = sessionFrom(['.B.', 'BAB'])
    expect(session.beginItemMove()).toBe(true)
    expect(session.tap(1, 1)).toMatchObject({ kind: 'itemRejected', reason: 'no-space' })
    expect(session.itemActiveNow).toBe(true)
  })

  it('switches the chosen tile and cancels on the same tile', () => {
    const session = sessionFrom(['AB....', '......'])
    session.beginItemMove()
    select(session, 0, 1)
    select(session, 0, 0)
    expect(session.itemPendingTileId).toBe(tileAtRowCol(session.getBoard(), 0, 0).id)
    expect(session.tap(0, 0).kind).toBe('itemCancelled')
    expect(session.itemActiveNow).toBe(false)
  })

  it('cancels item mode when tapping an empty cell before picking a tile', () => {
    const session = sessionFrom(['AAB...'])
    session.beginItemMove()
    expect(session.tap(0, 5).kind).toBe('itemCancelled')
    expect(session.itemActiveNow).toBe(false)
  })

  it('disables dragging and hints while item mode is active', () => {
    const session = sessionFrom(['AAB...'])
    session.beginItemMove()
    expect(session.dragInfo(0, 0)).toBeNull()
    expect(session.hint()).toBeNull()
  })

  it('stops working after three uses', () => {
    const session = sessionFrom(['AAB.....'])
    session.beginItemMove()
    select(session, 0, 2)
    expect(session.tap(0, 3).kind).toBe('itemMoved')

    session.beginItemMove()
    select(session, 0, 3)
    expect(session.tap(0, 4).kind).toBe('itemMoved')

    session.beginItemMove()
    select(session, 0, 4)
    expect(session.tap(0, 5).kind).toBe('itemMoved')

    expect(session.itemUsesLeft).toBe(0)
    expect(session.beginItemMove()).toBe(false)
  })

  it('restores the board and the use count on undo', () => {
    const session = sessionFrom(['AAB....'])
    const before = boardSignature(session.getBoard())
    const b = tileAtRowCol(session.getBoard(), 0, 2)

    session.beginItemMove()
    select(session, 0, 2)
    expect(session.tap(0, 3).kind).toBe('itemMoved')
    expect(session.itemUsesLeft).toBe(2)

    expect(session.undo()).toBe(true)
    expect(boardSignature(session.getBoard())).toBe(before)
    expect(session.itemUsesLeft).toBe(3)
    expect(session.moveCount).toBe(0)
    expect(session.itemActiveNow).toBe(false)
    expect(session.tileAt(0, 2)?.id).toBe(b.id)
  })

  it('can break a deadlock by moving a blocking tile', () => {
    const session = sessionFrom(['B.A.B', '.....', '.....'])
    expect(session.phaseNow).toBe('deadlock')
    expect(session.tap(0, 0).kind).toBe('ignored')

    expect(session.beginItemMove()).toBe(true)
    select(session, 0, 2)
    const result = session.tap(1, 2)
    expect(result.kind).toBe('itemMoved')
    expect(session.phaseNow).toBe('idle')
    expect(session.itemUsesLeft).toBe(2)
  })

  it('refuses item mode after winning', () => {
    const session = sessionFrom(['AA'])
    session.tap(0, 0)
    session.tap(0, 1)
    expect(session.phaseNow).toBe('won')
    expect(session.beginItemMove()).toBe(false)
  })
})
