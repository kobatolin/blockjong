/** Deterministic layout generation for the three modes. */
import { boardFromKindIds } from './board'
import { findAnyMove } from './drag'
import { KINDS, getMode, kindCountsForMode } from './kinds'
import { mulberry32, shuffleInPlace } from './rng'
import type { BoardSnapshot, FlowerGroup, ModeId } from './types'

export function buildBag(mode: ModeId): string[] {
  const bag: string[] = []
  for (const { kind, count } of kindCountsForMode(mode)) {
    for (let i = 0; i < count; i += 1) bag.push(kind.id)
  }
  return bag
}

export function generateBoard(mode: ModeId, seed: number): BoardSnapshot {
  const config = getMode(mode)
  const rng = mulberry32(seed >>> 0)
  const bag = buildBag(mode)

  for (let attempt = 0; attempt < 200; attempt += 1) {
    shuffleInPlace(bag, rng)
    const board = boardFromKindIds(config.rows, config.cols, bag)
    if (findAnyMove(board) !== null) return board
  }

  return fallbackPlayableLayout(mode)
}

/**
 * Extremely rare fallback: put one compatible pair in the first two cells,
 * then fill the rest in bag order. This guarantees an initial legal move.
 */
export function fallbackPlayableLayout(mode: ModeId): BoardSnapshot {
  const config = getMode(mode)
  const bag = buildBag(mode)
  const pair = takeCompatiblePair(bag)
  if (!pair) {
    return boardFromKindIds(config.rows, config.cols, bag)
  }
  return boardFromKindIds(config.rows, config.cols, [...pair, ...bag])
}

function takeCompatiblePair(bag: string[]): [string, string] | null {
  const byKind = new Map<string, number[]>()
  const byGroup = new Map<FlowerGroup, number[]>()

  bag.forEach((kindId, index) => {
    const kind = KINDS[kindId]
    if (!kind) return
    const bucket =
      kind.suit === 'flower' && kind.flowerGroup
        ? byGroup.get(kind.flowerGroup) ?? []
        : byKind.get(kindId) ?? []
    bucket.push(index)
    if (kind.suit === 'flower' && kind.flowerGroup) {
      byGroup.set(kind.flowerGroup, bucket)
    } else {
      byKind.set(kindId, bucket)
    }
  })

  for (const indices of byKind.values()) {
    if (indices.length >= 2) return removePair(bag, indices[0], indices[1])
  }
  for (const indices of byGroup.values()) {
    if (indices.length >= 2) return removePair(bag, indices[0], indices[1])
  }
  return null
}

function removePair(bag: string[], first: number, second: number): [string, string] {
  const low = Math.min(first, second)
  const high = Math.max(first, second)
  const a = bag[low]
  const b = bag[high]
  bag.splice(high, 1)
  bag.splice(low, 1)
  return [a, b]
}
