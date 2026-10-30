import { describe, expect, it } from 'vitest'
import { boardSignature, listTiles } from '@/core/board'
import { findAnyMove } from '@/core/drag'
import { buildBag, fallbackPlayableLayout, generateBoard } from '@/core/generate'
import { KINDS, kindCountsForMode, totalTilesForMode } from '@/core/kinds'
import type { ModeId } from '@/core/types'

const MODES: ModeId[] = ['easy', 'medium', 'full']

describe('mode totals', () => {
  it('matches the planned tile counts', () => {
    expect(totalTilesForMode('easy')).toBe(72)
    expect(totalTilesForMode('medium')).toBe(108)
    expect(totalTilesForMode('full')).toBe(144)
  })

  it('builds bags with pairable counts for every kind', () => {
    for (const mode of MODES) {
      const bag = buildBag(mode)
      expect(bag).toHaveLength(totalTilesForMode(mode))
      const counts = new Map<string, number>()
      for (const kindId of bag) counts.set(kindId, (counts.get(kindId) ?? 0) + 1)
      for (const [kindId, count] of counts) {
        if (KINDS[kindId].suit === 'flower') {
          expect(count, `${mode}:${kindId}`).toBe(1)
        } else {
          expect(count % 2, `${mode}:${kindId}`).toBe(0)
        }
      }
    }
  })

  it('keeps both flower groups pairable in full mode', () => {
    const flowers = kindCountsForMode('full').filter(({ kind }) => kind.suit === 'flower')
    const season = flowers
      .filter(({ kind }) => kind.flowerGroup === 'season')
      .reduce((sum, item) => sum + item.count, 0)
    const blossom = flowers
      .filter(({ kind }) => kind.flowerGroup === 'blossom')
      .reduce((sum, item) => sum + item.count, 0)
    expect(season).toBe(4)
    expect(blossom).toBe(4)
  })

  it('keeps flowers at one copy each in full mode', () => {
    const flowers = kindCountsForMode('full').filter(({ kind }) => kind.suit === 'flower')
    expect(flowers).toHaveLength(8)
    expect(flowers.every(({ count }) => count === 1)).toBe(true)
  })
})

describe('generation', () => {
  it('fills every cell with the right dimensions', () => {
    const easy = generateBoard('easy', 1)
    expect(easy.rows).toBe(8)
    expect(easy.cols).toBe(9)
    expect(listTiles(easy)).toHaveLength(72)

    const medium = generateBoard('medium', 1)
    expect(medium.rows).toBe(9)
    expect(medium.cols).toBe(12)
    expect(listTiles(medium)).toHaveLength(108)

    const full = generateBoard('full', 1)
    expect(full.rows).toBe(12)
    expect(full.cols).toBe(12)
    expect(listTiles(full)).toHaveLength(144)
  })

  it('produces the exact kind counts', () => {
    for (const mode of MODES) {
      const board = generateBoard(mode, 12345)
      const counts = new Map<string, number>()
      for (const tile of listTiles(board)) {
        counts.set(tile.kindId, (counts.get(tile.kindId) ?? 0) + 1)
      }
      for (const { kind, count } of kindCountsForMode(mode)) {
        expect(counts.get(kind.id), `${mode}:${kind.id}`).toBe(count)
        expect(KINDS[kind.id]).toBeDefined()
      }
    }
  })

  it('reproduces the same board for the same seed', () => {
    for (const mode of MODES) {
      expect(boardSignature(generateBoard(mode, 7))).toBe(
        boardSignature(generateBoard(mode, 7)),
      )
    }
  })

  it('varies across seeds', () => {
    expect(boardSignature(generateBoard('full', 1))).not.toBe(
      boardSignature(generateBoard('full', 2)),
    )
  })

  it('always starts with a legal move', () => {
    for (const mode of MODES) {
      for (let seed = 0; seed < 12; seed += 1) {
        expect(findAnyMove(generateBoard(mode, seed))).not.toBeNull()
      }
    }
  })

  it('transposes the same tiles for the tall layout', () => {
    for (const mode of MODES) {
      const wide = generateBoard(mode, 2026, 'wide')
      const tall = generateBoard(mode, 2026, 'tall')
      expect(tall.rows).toBe(wide.cols)
      expect(tall.cols).toBe(wide.rows)
      expect(listTiles(tall)).toHaveLength(listTiles(wide).length)
      for (let row = 0; row < wide.rows; row += 1) {
        for (let col = 0; col < wide.cols; col += 1) {
          const source = wide.cells[row * wide.cols + col]
          const target = tall.cells[col * tall.cols + row]
          if (!source) {
            expect(target).toBeNull()
            continue
          }
          expect(target).toMatchObject({
            id: source.id,
            kindId: source.kindId,
            row: col,
            col: row,
          })
        }
      }
      expect(findAnyMove(tall)).not.toBeNull()
    }
  })

  it('keeps the fallback playable', () => {
    for (const mode of MODES) {
      expect(findAnyMove(fallbackPlayableLayout(mode))).not.toBeNull()
    }
  })
})
