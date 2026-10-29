/**
 * The 42 mahjong kinds and the three mode presets.
 *
 * Tile counts are mode-dependent: numbered/honor kinds use `copies` (4),
 * while each flower exists exactly once in the 144-tile full mode and is
 * matched against its flower group instead of its exact face.
 */
import type { FlowerGroup, ModeConfig, ModeId, Suit, TileKind } from './types'

const NUMERALS = ['一', '二', '三', '四', '五', '六', '七', '八', '九'] as const

function numberedKinds(suit: Suit, suffix: string): TileKind[] {
  return NUMERALS.map((numeral, index) => ({
    id: `${suit}-${index + 1}`,
    suit,
    rank: index + 1,
    label: `${numeral}${suffix}`,
  }))
}

const HONORS: TileKind[] = [
  { id: 'honor-east', suit: 'honor', label: '东风' },
  { id: 'honor-south', suit: 'honor', label: '南风' },
  { id: 'honor-west', suit: 'honor', label: '西风' },
  { id: 'honor-north', suit: 'honor', label: '北风' },
  { id: 'honor-red', suit: 'honor', label: '红中' },
  { id: 'honor-green', suit: 'honor', label: '发财' },
  { id: 'honor-white', suit: 'honor', label: '白板' },
]

const FLOWERS: TileKind[] = [
  { id: 'flower-spring', suit: 'flower', label: '春', flowerGroup: 'season' },
  { id: 'flower-summer', suit: 'flower', label: '夏', flowerGroup: 'season' },
  { id: 'flower-autumn', suit: 'flower', label: '秋', flowerGroup: 'season' },
  { id: 'flower-winter', suit: 'flower', label: '冬', flowerGroup: 'season' },
  { id: 'flower-plum', suit: 'flower', label: '梅', flowerGroup: 'blossom' },
  { id: 'flower-orchid', suit: 'flower', label: '兰', flowerGroup: 'blossom' },
  { id: 'flower-bamboo', suit: 'flower', label: '竹', flowerGroup: 'blossom' },
  { id: 'flower-chrysanthemum', suit: 'flower', label: '菊', flowerGroup: 'blossom' },
]

/** Ordered catalogue: pin, sou, man, honors, flowers. */
export const KIND_LIST: readonly TileKind[] = [
  ...numberedKinds('pin', '筒'),
  ...numberedKinds('sou', '索'),
  ...numberedKinds('man', '万'),
  ...HONORS,
  ...FLOWERS,
]

export const KINDS: Readonly<Record<string, TileKind>> = Object.fromEntries(
  KIND_LIST.map((kind) => [kind.id, kind]),
)

export const FLOWER_GROUP_LABEL: Record<FlowerGroup, string> = {
  season: '季节',
  blossom: '花',
}

export const MODE_CONFIGS: Readonly<Record<ModeId, ModeConfig>> = {
  easy: {
    id: 'easy',
    name: '简单',
    rows: 8,
    cols: 9,
    suits: ['pin', 'sou'],
    copies: 4,
  },
  medium: {
    id: 'medium',
    name: '中等',
    rows: 9,
    cols: 12,
    suits: ['pin', 'sou', 'man'],
    copies: 4,
  },
  full: {
    id: 'full',
    name: '完整',
    rows: 12,
    cols: 12,
    suits: ['pin', 'sou', 'man', 'honor', 'flower'],
    copies: 4,
  },
}

export const MODE_IDS: readonly ModeId[] = ['easy', 'medium', 'full']

export function getMode(mode: ModeId): ModeConfig {
  return MODE_CONFIGS[mode]
}

export function kindsForMode(mode: ModeId): TileKind[] {
  const config = MODE_CONFIGS[mode]
  return KIND_LIST.filter((kind) => config.suits.includes(kind.suit))
}

export function tileCountForKind(kind: TileKind): number {
  return kind.suit === 'flower' ? 1 : 4
}

export interface KindCount {
  kind: TileKind
  count: number
}

export function kindCountsForMode(mode: ModeId): KindCount[] {
  return kindsForMode(mode).map((kind) => ({
    kind,
    count: tileCountForKind(kind),
  }))
}

export function totalTilesForMode(mode: ModeId): number {
  return kindCountsForMode(mode).reduce((sum, item) => sum + item.count, 0)
}

export function kindOf(kindId: string): TileKind {
  const kind = KINDS[kindId]
  if (!kind) throw new Error(`unknown tile kind: ${kindId}`)
  return kind
}

/** Traditional character used on the tile face for a numbered man tile. */
export function manFaceGlyph(rank: number): string {
  return `${NUMERALS[rank - 1] ?? ''}萬`
}
