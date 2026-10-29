import { describe, expect, it } from 'vitest'
import {
  choosePartner,
  findAnyDrag,
  findAnyMove,
  isDeadlocked,
  maxSlide,
  resolveDrag,
  segment,
} from '@/core/drag'
import { boardFromRows, tileAtRowCol } from './helpers'

describe('drag segment and slide range', () => {
  it('collects only the contiguous run in the drag direction', () => {
    const board = boardFromRows(['.ABC..D'])
    const a = tileAtRowCol(board, 0, 1)
    const right = segment(board, a, 'right')
    expect(right.map((tile) => tile.col)).toEqual([1, 2, 3])
    expect(maxSlide(board, right, 'right')).toBe(2)

    const left = segment(board, a, 'left')
    expect(left.map((tile) => tile.col)).toEqual([1])
    expect(maxSlide(board, left, 'left')).toBe(1)
  })

  it('stops before the next occupied cell', () => {
    const board = boardFromRows(['A B . C'])
    const a = tileAtRowCol(board, 0, 0)
    const run = segment(board, a, 'right')
    expect(maxSlide(board, run, 'right')).toBe(1)
  })
})

describe('drag landing', () => {
  it('slides a vertical run and pairs on the new row', () => {
    const board = boardFromRows([
      '......',
      'A.....',
      'X.....',
      '......',
      '...A..',
      '......',
    ])
    const a = tileAtRowCol(board, 1, 0)
    const result = resolveDrag(board, a, 'down', 3, null)

    expect(result.kind).toBe('match')
    expect(result.k).toBe(3)
    expect(result.kMax).toBe(3)
    expect(result.dragged?.row).toBe(4)
    expect(result.dragged?.col).toBe(0)
    expect(result.partner?.row).toBe(4)
    expect(result.partner?.col).toBe(3)
    expect(result.moved.map((tile) => `${tile.row},${tile.col}`)).toEqual(['4,0', '5,0'])
  })

  it('slides a horizontal run and pairs on the new column', () => {
    const board = boardFromRows([
      '.AB..C',
      '......',
      '......',
      '...A..',
      '......',
      '......',
    ])
    const a = tileAtRowCol(board, 0, 1)
    const result = resolveDrag(board, a, 'right', 2, null)

    expect(result.kind).toBe('match')
    expect(result.kMax).toBe(2)
    expect(result.dragged?.row).toBe(0)
    expect(result.dragged?.col).toBe(3)
    expect(result.partner?.row).toBe(3)
    expect(result.partner?.col).toBe(3)
  })

  it('allows an adjacent pair inside the moving segment', () => {
    const board = boardFromRows(['AAB.C'])
    const a = tileAtRowCol(board, 0, 0)
    const result = resolveDrag(board, a, 'right', 1, null)

    expect(result.kind).toBe('match')
    expect(result.kMax).toBe(1)
    expect(result.dragged?.col).toBe(1)
    expect(result.partner?.col).toBe(2)
    expect(result.moved).toHaveLength(3)
  })

  it('clamps k to the maximum slide', () => {
    const board = boardFromRows(['A..A'])
    const a = tileAtRowCol(board, 0, 0)
    const result = resolveDrag(board, a, 'right', 99, null)
    // A at c0 already sees A at c3; after sliding it lands next to the border.
    expect(result.k).toBe(2)
    expect(result.kind).toBe('match')
  })

  it('returns none for k = 0', () => {
    const board = boardFromRows(['A..A'])
    const a = tileAtRowCol(board, 0, 0)
    const result = resolveDrag(board, a, 'right', 0, null)
    expect(result.kind).toBe('none')
    expect(result.moved).toHaveLength(0)
  })

  it('reverts when no partner is visible at the destination', () => {
    const board = boardFromRows(['.A..', '....', 'B...'])
    const a = tileAtRowCol(board, 0, 1)
    const result = resolveDrag(board, a, 'down', 1, null)
    expect(result.kind).toBe('revert')
    expect(result.partner).toBeNull()
    expect(board.cells[0 * board.cols + 1]?.id).toBe(a.id)
  })

  it('prefers the selected anchor over a nearer partner', () => {
    const board = boardFromRows(['A.A.A'])
    const dragged = tileAtRowCol(board, 0, 2)
    const anchor = tileAtRowCol(board, 0, 4)
    const withAnchor = choosePartner(board, dragged, anchor.id)
    const withoutAnchor = choosePartner(board, dragged, null)
    expect(withAnchor?.col).toBe(4)
    expect(withoutAnchor?.col).toBe(0)
  })
})

describe('move search', () => {
  it('finds a drag when no tap pair exists', () => {
    const board = boardFromRows([
      '......',
      '.A....',
      '.X....',
      '......',
      '...A..',
      '......',
    ])
    expect(findAnyDrag(board)).not.toBeNull()
    expect(findAnyMove(board)?.kind).toBe('drag')
  })

  it('detects a fully blocked board as deadlocked', () => {
    const board = boardFromRows(['AB', 'BA'])
    expect(findAnyMove(board)).toBeNull()
    expect(isDeadlocked(board)).toBe(true)
  })
})
