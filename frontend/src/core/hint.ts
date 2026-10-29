/** Hint search: tap pairs first, then any drag that lands on a pair. */
import { findAnyMove, type AnyMove } from './drag'
import type { BoardSnapshot } from './types'

export type Hint = AnyMove

export function findHint(board: BoardSnapshot): Hint | null {
  return findAnyMove(board)
}
