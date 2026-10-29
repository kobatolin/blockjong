/** World-space dimensions and board-to-world mapping. */

export const CELL_W = 1.0
export const CELL_D = 1.25
export const TILE_W = 0.92
export const TILE_D = 1.15
export const TILE_H = 0.34
export const CORNER_R = 0.055

export interface BoardDimensions {
  width: number
  depth: number
}

export function boardDimensions(rows: number, cols: number): BoardDimensions {
  return {
    width: cols * CELL_W,
    depth: rows * CELL_D,
  }
}

/** X coordinate of a column, centered on the board. */
export function tileX(col: number, cols: number): number {
  return (col - (cols - 1) / 2) * CELL_W
}

/** Z coordinate of a row, centered on the board. */
export function tileZ(row: number, rows: number): number {
  return (row - (rows - 1) / 2) * CELL_D
}
