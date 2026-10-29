/**
 * Procedural mahjong faces. Each kind is painted once into a 256×320 canvas
 * and cached as a shared Three.js texture.
 */
import * as THREE from 'three'
import { kindOf } from '@/core/kinds'
import type { TileKind } from '@/core/types'
import { createCanvas, roundRectPath } from './canvas'

const FACE_W = 256
const FACE_H = 320
const FONT = '"KaiTi","STKaiti","Kaiti SC","Noto Serif SC","SimSun",serif'
const PAPER = '#f1e1c6'
const PAPER_EDGE = '#ddc8a5'

const BLUE = '#1b4f8f'
const GREEN = '#196544'
const RED = '#94261f'
const INK = '#1b2932'
const GOLD = '#8f6a34'
const SUIT_COLORS = [BLUE, GREEN, RED]

type Point = [number, number]

const DOT_PATTERNS: Record<number, Point[]> = {
  1: [[0, 0]],
  2: [
    [0, -0.26],
    [0, 0.26],
  ],
  3: [
    [-0.26, 0.26],
    [0, 0],
    [0.26, -0.26],
  ],
  4: [
    [-0.24, -0.24],
    [0.24, -0.24],
    [-0.24, 0.24],
    [0.24, 0.24],
  ],
  5: [
    [-0.26, -0.26],
    [0.26, -0.26],
    [0, 0],
    [-0.26, 0.26],
    [0.26, 0.26],
  ],
  6: [
    [-0.26, -0.32],
    [-0.26, 0],
    [-0.26, 0.32],
    [0.26, -0.32],
    [0.26, 0],
    [0.26, 0.32],
  ],
  7: [
    [-0.3, -0.34],
    [0, -0.34],
    [0.3, -0.34],
    [0, -0.02],
    [-0.3, 0.3],
    [0, 0.3],
    [0.3, 0.3],
  ],
  8: [
    [-0.26, -0.36],
    [-0.26, -0.12],
    [-0.26, 0.12],
    [-0.26, 0.36],
    [0.26, -0.36],
    [0.26, -0.12],
    [0.26, 0.12],
    [0.26, 0.36],
  ],
  9: [
    [-0.28, -0.32],
    [0, -0.32],
    [0.28, -0.32],
    [-0.28, 0],
    [0, 0],
    [0.28, 0],
    [-0.28, 0.32],
    [0, 0.32],
    [0.28, 0.32],
  ],
}

function paintBackground(ctx: CanvasRenderingContext2D): void {
  const gradient = ctx.createRadialGradient(
    FACE_W / 2,
    FACE_H / 2,
    12,
    FACE_W / 2,
    FACE_H / 2,
    FACE_W * 0.8,
  )
  gradient.addColorStop(0, PAPER)
  gradient.addColorStop(1, PAPER_EDGE)
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, FACE_W, FACE_H)

  for (let i = 0; i < 1400; i += 1) {
    const alpha = 0.015 + Math.random() * 0.03
    ctx.fillStyle = Math.random() > 0.5 ? `rgba(120,90,50,${alpha})` : `rgba(255,255,255,${alpha})`
    ctx.fillRect(Math.random() * FACE_W, Math.random() * FACE_H, 1, 1)
  }

  const shade = ctx.createLinearGradient(0, 0, 0, FACE_H)
  shade.addColorStop(0, 'rgba(80,55,25,0.06)')
  shade.addColorStop(0.2, 'rgba(80,55,25,0)')
  shade.addColorStop(0.8, 'rgba(80,55,25,0)')
  shade.addColorStop(1, 'rgba(80,55,25,0.08)')
  ctx.fillStyle = shade
  ctx.fillRect(0, 0, FACE_W, FACE_H)
}

function paintInnerBorder(ctx: CanvasRenderingContext2D): void {
  ctx.save()
  roundRectPath(ctx, 9, 9, FACE_W - 18, FACE_H - 18, 14)
  ctx.strokeStyle = 'rgba(120,90,50,0.18)'
  ctx.lineWidth = 2
  ctx.stroke()
  ctx.restore()
}

function drawText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  size: number,
  color: string,
  weight = '600',
): void {
  ctx.save()
  ctx.font = `${weight} ${size}px ${FONT}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = 'rgba(255,250,235,0.8)'
  ctx.fillText(text, x, y + Math.max(1, size * 0.025))
  ctx.shadowColor = 'rgba(0,0,0,0.28)'
  ctx.shadowBlur = 1.4
  ctx.shadowOffsetY = 1
  ctx.fillStyle = color
  ctx.fillText(text, x, y)
  ctx.restore()
}

function drawDot(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  color: string,
): void {
  ctx.save()
  ctx.shadowColor = 'rgba(0,0,0,0.24)'
  ctx.shadowBlur = 2
  ctx.shadowOffsetY = 1
  ctx.strokeStyle = color
  ctx.lineWidth = Math.max(3, radius * 0.3)
  ctx.beginPath()
  ctx.arc(x, y, radius, 0, Math.PI * 2)
  ctx.stroke()

  ctx.fillStyle = color
  ctx.beginPath()
  ctx.arc(x, y, radius * 0.42, 0, Math.PI * 2)
  ctx.fill()

  ctx.shadowColor = 'transparent'
  ctx.strokeStyle = 'rgba(255,250,235,0.65)'
  ctx.lineWidth = 1.2
  ctx.beginPath()
  ctx.arc(x, y + radius * 0.06, radius * 0.78, Math.PI * 1.12, Math.PI * 1.88)
  ctx.stroke()
  ctx.restore()
}

function drawBamboo(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  color: string,
): void {
  ctx.save()
  ctx.translate(x, y)
  ctx.shadowColor = 'rgba(0,0,0,0.3)'
  ctx.shadowBlur = 2
  ctx.shadowOffsetY = 1

  roundRectPath(ctx, -width / 2, -height / 2, width, height, width * 0.42)
  ctx.fillStyle = color
  ctx.fill()
  ctx.shadowColor = 'transparent'
  ctx.strokeStyle = 'rgba(8, 38, 25, 0.45)'
  ctx.lineWidth = 2
  ctx.stroke()

  ctx.strokeStyle = 'rgba(255,250,235,0.55)'
  ctx.lineWidth = 2
  for (const offset of [-height * 0.3, 0, height * 0.3]) {
    ctx.beginPath()
    ctx.moveTo(-width * 0.32, offset)
    ctx.lineTo(width * 0.32, offset)
    ctx.stroke()
  }

  ctx.strokeStyle = 'rgba(8, 38, 25, 0.22)'
  ctx.lineWidth = 1
  for (const offset of [-height * 0.3, 0, height * 0.3]) {
    ctx.beginPath()
    ctx.moveTo(-width * 0.32, offset + 1.5)
    ctx.lineTo(width * 0.32, offset + 1.5)
    ctx.stroke()
  }
  ctx.restore()
}

function drawPinRosette(ctx: CanvasRenderingContext2D): void {
  const cx = 128
  const cy = 168

  ctx.save()
  ctx.strokeStyle = BLUE
  ctx.lineWidth = 6
  ctx.beginPath()
  ctx.arc(cx, cy, 61, 0, Math.PI * 2)
  ctx.stroke()

  for (let i = 0; i < 8; i += 1) {
    const angle = -Math.PI / 2 + (i * Math.PI) / 4
    ctx.save()
    ctx.translate(cx + Math.cos(angle) * 39, cy + Math.sin(angle) * 39)
    ctx.rotate(angle + Math.PI / 2)
    ctx.fillStyle = i % 2 === 0 ? RED : GREEN
    ctx.beginPath()
    ctx.ellipse(0, 0, 11, 18, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = 'rgba(30, 25, 15, 0.28)'
    ctx.lineWidth = 1.6
    ctx.stroke()
    ctx.restore()
  }

  drawDot(ctx, cx, cy, 27, RED)
  ctx.save()
  ctx.fillStyle = GOLD
  ctx.beginPath()
  ctx.arc(cx, cy, 11, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
  ctx.restore()
}

function drawBird(ctx: CanvasRenderingContext2D): void {
  ctx.save()
  ctx.translate(128, 168)
  ctx.scale(1.06, 1.06)

  ctx.fillStyle = GREEN
  ctx.beginPath()
  ctx.ellipse(-12, 12, 44, 28, -0.25, 0, Math.PI * 2)
  ctx.fill()

  ctx.fillStyle = BLUE
  ctx.beginPath()
  ctx.ellipse(-16, 6, 28, 18, -0.3, 0, Math.PI * 2)
  ctx.fill()

  ctx.fillStyle = GREEN
  ctx.beginPath()
  ctx.arc(34, -26, 20, 0, Math.PI * 2)
  ctx.fill()

  ctx.fillStyle = RED
  ctx.beginPath()
  ctx.moveTo(52, -30)
  ctx.lineTo(74, -22)
  ctx.lineTo(52, -14)
  ctx.closePath()
  ctx.fill()

  ctx.strokeStyle = RED
  ctx.lineWidth = 5
  ctx.lineCap = 'round'
  for (const dy of [-10, 4, 18]) {
    ctx.beginPath()
    ctx.moveTo(-46, 6)
    ctx.quadraticCurveTo(-74, dy, -92, dy - 10)
    ctx.stroke()
  }

  ctx.fillStyle = INK
  ctx.beginPath()
  ctx.arc(40, -30, 3.2, 0, Math.PI * 2)
  ctx.fill()

  ctx.strokeStyle = INK
  ctx.lineWidth = 3
  for (const dx of [-8, 12]) {
    ctx.beginPath()
    ctx.moveTo(dx, 38)
    ctx.lineTo(dx - 4, 58)
    ctx.stroke()
  }
  ctx.restore()
}

function paintPin(ctx: CanvasRenderingContext2D, rank: number): void {
  if (rank === 1) {
    drawPinRosette(ctx)
    return
  }
  const points = DOT_PATTERNS[rank] ?? []
  const radius = rank >= 9 ? 16 : rank >= 7 ? 18 : 20
  const spreadX = rank >= 7 ? 92 : 88
  const spreadY = rank >= 7 ? 116 : 112
  points.forEach(([dx, dy], index) => {
    drawDot(
      ctx,
      128 + dx * spreadX,
      168 + dy * spreadY,
      radius,
      SUIT_COLORS[index % SUIT_COLORS.length],
    )
  })
}

function paintSou(ctx: CanvasRenderingContext2D, rank: number): void {
  if (rank === 1) {
    drawBird(ctx)
    return
  }
  const points = DOT_PATTERNS[rank] ?? []
  const height = rank >= 7 ? 64 : 74
  const width = rank >= 7 ? 14 : 17
  const accentIndex = Math.floor(points.length / 2)
  const hasAccent = rank === 5 || rank === 7 || rank === 9
  points.forEach(([dx, dy], index) => {
    drawBamboo(
      ctx,
      128 + dx * 86,
      168 + dy * 112,
      width,
      height,
      hasAccent && index === accentIndex ? RED : GREEN,
    )
  })
}

function paintMan(ctx: CanvasRenderingContext2D, rank: number): void {
  const numerals = ['一', '二', '三', '四', '五', '六', '七', '八', '九']
  drawText(ctx, numerals[rank - 1] ?? '', 128, 102, 90, RED, '700')
  drawText(ctx, '萬', 128, 228, 104, RED, '700')
}

const HONOR_FACE: Record<string, { glyph: string; color: string }> = {
  'honor-east': { glyph: '東', color: INK },
  'honor-south': { glyph: '南', color: INK },
  'honor-west': { glyph: '西', color: INK },
  'honor-north': { glyph: '北', color: INK },
  'honor-red': { glyph: '中', color: '#a8261e' },
  'honor-green': { glyph: '發', color: '#1c6b3c' },
}

function paintHonor(ctx: CanvasRenderingContext2D, kindId: string): void {
  if (kindId === 'honor-white') {
    ctx.save()
    roundRectPath(ctx, 50, 74, 156, 188, 24)
    ctx.strokeStyle = BLUE
    ctx.lineWidth = 10
    ctx.stroke()
    ctx.strokeStyle = 'rgba(255,250,235,0.6)'
    ctx.lineWidth = 2
    roundRectPath(ctx, 58, 82, 140, 172, 19)
    ctx.stroke()
    ctx.restore()
    return
  }

  const honor = HONOR_FACE[kindId] ?? { glyph: '?', color: INK }
  drawText(ctx, honor.glyph, 128, 168, 154, honor.color, '700')
}

type FlowerIcon =
  | 'spring'
  | 'summer'
  | 'autumn'
  | 'winter'
  | 'plum'
  | 'orchid'
  | 'bamboo'
  | 'chrysanthemum'

interface FlowerMeta {
  glyph: string
  color: string
  numeral: number
  icon: FlowerIcon
}

const FLOWER_FACE: Record<string, FlowerMeta> = {
  'flower-spring': { glyph: '春', color: '#2b7a5a', numeral: 1, icon: 'spring' },
  'flower-summer': { glyph: '夏', color: '#2b7a5a', numeral: 2, icon: 'summer' },
  'flower-autumn': { glyph: '秋', color: '#2b7a5a', numeral: 3, icon: 'autumn' },
  'flower-winter': { glyph: '冬', color: '#2b7a5a', numeral: 4, icon: 'winter' },
  'flower-plum': { glyph: '梅', color: '#9e2937', numeral: 1, icon: 'plum' },
  'flower-orchid': { glyph: '蘭', color: '#9e2937', numeral: 2, icon: 'orchid' },
  'flower-bamboo': { glyph: '竹', color: '#9e2937', numeral: 3, icon: 'bamboo' },
  'flower-chrysanthemum': { glyph: '菊', color: '#9e2937', numeral: 4, icon: 'chrysanthemum' },
}

const FLOWER_PETAL: Record<string, string> = {
  spring: '#c24352',
  summer: '#b63737',
  autumn: '#b56a2a',
  winter: '#b34a56',
  plum: '#9e2937',
}

function drawLeaf(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  rotation: number,
): void {
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(rotation)
  ctx.fillStyle = GREEN
  ctx.beginPath()
  ctx.ellipse(0, 0, 5, 13, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = 'rgba(10, 45, 30, 0.3)'
  ctx.lineWidth = 1
  ctx.stroke()
  ctx.restore()
}

function drawFlowerIcon(
  ctx: CanvasRenderingContext2D,
  icon: FlowerIcon,
  color: string,
): void {
  ctx.save()
  ctx.translate(128, 252)

  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.strokeStyle = GREEN
  ctx.lineWidth = 4
  ctx.beginPath()
  ctx.moveTo(0, 8)
  ctx.quadraticCurveTo(-5, 24, -8, 38)
  ctx.stroke()
  drawLeaf(ctx, -16, 28, -0.8)
  drawLeaf(ctx, 12, 22, 0.9)

  if (icon === 'orchid') {
    ctx.strokeStyle = GREEN
    ctx.lineWidth = 5
    for (const [endX, endY, bend] of [
      [-34, -8, -28],
      [32, -2, 26],
      [-18, -24, -8],
    ] as const) {
      ctx.beginPath()
      ctx.moveTo(0, 14)
      ctx.quadraticCurveTo(bend, -6, endX, endY)
      ctx.stroke()
    }
    ctx.fillStyle = RED
    for (let i = 0; i < 3; i += 1) {
      const angle = (i * Math.PI * 2) / 3 - Math.PI / 2
      ctx.beginPath()
      ctx.ellipse(Math.cos(angle) * 9, -8 + Math.sin(angle) * 9, 5, 8, angle, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.fillStyle = GOLD
    ctx.beginPath()
    ctx.arc(0, -8, 4, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
    return
  }

  if (icon === 'bamboo') {
    ctx.strokeStyle = GREEN
    ctx.lineWidth = 5
    for (const offset of [-18, 0, 18]) {
      ctx.beginPath()
      ctx.moveTo(offset, 34)
      ctx.lineTo(offset + 2, -18)
      ctx.stroke()
      ctx.lineWidth = 2
      ctx.strokeStyle = 'rgba(255,250,235,0.5)'
      for (const joint of [28, 14, 0]) {
        ctx.beginPath()
        ctx.moveTo(offset - 4, joint)
        ctx.lineTo(offset + 4, joint)
        ctx.stroke()
      }
      ctx.strokeStyle = GREEN
      ctx.lineWidth = 5
    }
    drawLeaf(ctx, -26, -10, -0.9)
    drawLeaf(ctx, 25, -18, 0.9)
    drawLeaf(ctx, 4, -26, 0.1)
    ctx.restore()
    return
  }

  const petalColor = FLOWER_PETAL[icon] ?? color
  const petals = icon === 'chrysanthemum' ? 12 : icon === 'summer' ? 6 : 5
  const radius = icon === 'chrysanthemum' ? 21 : 17
  for (let i = 0; i < petals; i += 1) {
    const angle = (i * Math.PI * 2) / petals - Math.PI / 2
    ctx.save()
    ctx.translate(Math.cos(angle) * radius, -14 + Math.sin(angle) * radius)
    ctx.rotate(angle + Math.PI / 2)
    ctx.fillStyle = petalColor
    ctx.beginPath()
    ctx.ellipse(0, 0, icon === 'chrysanthemum' ? 4 : 6, icon === 'chrysanthemum' ? 13 : 11, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = 'rgba(80, 20, 20, 0.25)'
    ctx.lineWidth = 1
    ctx.stroke()
    ctx.restore()
  }
  ctx.fillStyle = GOLD
  ctx.beginPath()
  ctx.arc(0, -14, 6, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

function paintFlower(ctx: CanvasRenderingContext2D, kindId: string): void {
  const flower = FLOWER_FACE[kindId] ?? {
    glyph: '?',
    color: GREEN,
    numeral: 1,
    icon: 'spring' as const,
  }
  drawText(ctx, String(flower.numeral), 36, 52, 40, RED, '700')
  drawText(ctx, flower.glyph, 128, 146, 126, flower.color, '700')
  drawFlowerIcon(ctx, flower.icon, flower.color)
}

function paintFace(kind: TileKind): HTMLCanvasElement {
  const canvas = createCanvas(FACE_W, FACE_H)
  const ctx = canvas.getContext('2d')!
  paintBackground(ctx)

  switch (kind.suit) {
    case 'pin':
      paintPin(ctx, kind.rank ?? 1)
      break
    case 'sou':
      paintSou(ctx, kind.rank ?? 1)
      break
    case 'man':
      paintMan(ctx, kind.rank ?? 1)
      break
    case 'honor':
      paintHonor(ctx, kind.id)
      break
    case 'flower':
      paintFlower(ctx, kind.id)
      break
  }

  paintInnerBorder(ctx)
  return canvas
}

export class FacePainter {
  private readonly cache = new Map<string, THREE.CanvasTexture>()
  private readonly maxAnisotropy: number

  constructor(renderer: THREE.WebGLRenderer) {
    this.maxAnisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy())
  }

  get(kindId: string): THREE.CanvasTexture {
    const cached = this.cache.get(kindId)
    if (cached) return cached

    const kind = kindOf(kindId)
    const texture = new THREE.CanvasTexture(paintFace(kind))
    texture.colorSpace = THREE.SRGBColorSpace
    texture.anisotropy = this.maxAnisotropy
    texture.needsUpdate = true
    this.cache.set(kindId, texture)
    return texture
  }

  dispose(): void {
    for (const texture of this.cache.values()) texture.dispose()
    this.cache.clear()
  }
}
