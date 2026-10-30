/** Shared domain types. Core must stay free of DOM and Three.js imports. */

export type Suit = 'pin' | 'sou' | 'man' | 'honor' | 'flower';
export type FlowerGroup = 'season' | 'blossom';
export type ModeId = 'easy' | 'medium' | 'full';
export type SeedSource = 'random' | 'custom';
export type Layout = 'wide' | 'tall';
export type Phase = 'idle' | 'won' | 'deadlock';
export type Dir = 'left' | 'right' | 'up' | 'down';

export interface TileKind {
  id: string;
  suit: Suit;
  /** 1..9 for numbered suits; undefined for honors and flowers. */
  rank?: number;
  label: string;
  flowerGroup?: FlowerGroup;
}

export interface Tile {
  id: number;
  kindId: string;
  row: number;
  col: number;
}

export interface BoardSnapshot {
  rows: number;
  cols: number;
  /** Row-major cells, index = row * cols + col. */
  cells: (Tile | null)[];
}

export interface ModeConfig {
  id: ModeId;
  name: string;
  rows: number;
  cols: number;
  suits: Suit[];
  copies: number;
}

export interface GameSnapshot {
  mode: ModeId;
  phase: Phase;
  board: BoardSnapshot;
  remaining: number;
  selectedId: number | null;
  seed: number;
  seedSource: SeedSource;
  /** Remaining "move one tile" item uses. */
  itemUses: number;
  /** True while the player is picking a tile / target cell for the item. */
  itemActive: boolean;
  /** Tile chosen inside item mode, waiting for an adjacent empty target. */
  itemTileId: number | null;
}

export interface TilePair {
  a: Tile;
  b: Tile;
}
