import { describe, expect, it } from 'vitest'
import { compatible, findAnyTap, findVisiblePartners, visible } from '@/core/rules'
import { boardFromRows, tileAtRowCol } from './helpers'

describe('pair compatibility', () => {
  it('matches the same kind and rejects different kinds', () => {
    const board = boardFromRows(['A B'])
    expect(compatible(tileAtRowCol(board, 0, 0), tileAtRowCol(board, 0, 1))).toBe(false)
    const twins = boardFromRows(['A A'])
    expect(compatible(tileAtRowCol(twins, 0, 0), tileAtRowCol(twins, 0, 1))).toBe(true)
  })

  it('matches flowers within the same group only', () => {
    const season = boardFromRows(['F G'])
    expect(compatible(tileAtRowCol(season, 0, 0), tileAtRowCol(season, 0, 1))).toBe(true)
    const cross = boardFromRows(['F H'])
    expect(compatible(tileAtRowCol(cross, 0, 0), tileAtRowCol(cross, 0, 1))).toBe(false)
    const mixed = boardFromRows(['F A'])
    expect(compatible(tileAtRowCol(mixed, 0, 0), tileAtRowCol(mixed, 0, 1))).toBe(false)
  })
})

describe('visibility', () => {
  it('sees adjacent tiles and tiles separated only by empty cells', () => {
    const adjacent = boardFromRows(['A A .'])
    expect(visible(adjacent, tileAtRowCol(adjacent, 0, 0), tileAtRowCol(adjacent, 0, 1))).toBe(true)

    const gap = boardFromRows(['A . . A'])
    expect(visible(gap, tileAtRowCol(gap, 0, 0), tileAtRowCol(gap, 0, 3))).toBe(true)

    const vertical = boardFromRows(['A .', '. .', 'A .'])
    expect(visible(vertical, tileAtRowCol(vertical, 0, 0), tileAtRowCol(vertical, 2, 0))).toBe(true)
  })

  it('blocks on any intervening tile', () => {
    const blocked = boardFromRows(['A B A'])
    expect(visible(blocked, tileAtRowCol(blocked, 0, 0), tileAtRowCol(blocked, 0, 2))).toBe(false)

    const blockedVertical = boardFromRows(['A .', 'B .', 'A .'])
    expect(
      visible(
        blockedVertical,
        tileAtRowCol(blockedVertical, 0, 0),
        tileAtRowCol(blockedVertical, 2, 0),
      ),
    ).toBe(false)
  })

  it('rejects diagonal and self pairs', () => {
    const diagonal = boardFromRows(['A .', '. A'])
    expect(visible(diagonal, tileAtRowCol(diagonal, 0, 0), tileAtRowCol(diagonal, 1, 1))).toBe(false)
    const single = boardFromRows(['A'])
    expect(visible(single, tileAtRowCol(single, 0, 0), tileAtRowCol(single, 0, 0))).toBe(false)
  })

  it('finds visible partners and tap moves', () => {
    const board = boardFromRows(['A . A B', '. . . .'])
    const partners = findVisiblePartners(board, tileAtRowCol(board, 0, 0))
    expect(partners.map((tile) => tile.col)).toEqual([2])
    expect(findAnyTap(board)).not.toBeNull()
  })
})
