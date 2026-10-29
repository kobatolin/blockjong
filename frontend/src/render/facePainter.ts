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
const PAPER = '#fbf4e4'
const PAPER_EDGE = '#e7d7b9'

const BLUE = '#1f5fa8'
const GREEN = '#1f7a4d'
const RED = '#a8322a'
const INK = '#20303a'
const GOLD = '#a98243'
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

function drawStick(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  color: string,
): void {
  ctx.save()
  ctx.translate(x, y)
  ctx.shadowColor = 'rgba(0,0,0,0.22)'
  ctx.shadowBlur = 1.5
  ctx.shadowOffsetY = 1
  roundRectPath(ctx, -width / 2, -height / 2, width, height, width / 2)
  ctx.fillStyle = color
  ctx.fill()

  ctx.shadowColor = 'transparent'
  ctx.strokeStyle = 'rgba(255,250,235,0.45)'
  ctx.lineWidth = 1
  for (const offset of [-height * 0.18, height * 0.18]) {
    ctx.beginPath()
    ctx.moveTo(-width * 0.28, offset)
    ctx.lineTo(width * 0.28, offset)
    ctx.stroke()
  }
  ctx.restore()
}

function drawBird(ctx: CanvasRenderingContext2D): void {
  ctx.save()
  ctx.translate(128, 168)

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
    drawDot(ctx, 128, 168, 52, RED)
    return
  }
  const points = DOT_PATTERNS[rank] ?? []
  const radius = rank >= 7 ? 15 : 17
  points.forEach(([dx, dy], index) => {
    drawDot(
      ctx,
      128 + dx * 86,
      168 + dy * 112,
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
  const height = rank >= 7 ? 54 : 62
  const width = rank >= 7 ? 13 : 15
  points.forEach(([dx, dy], index) => {
    drawStick(
      ctx,
      128 + dx * 86,
      168 + dy * 112,
      width,
      height,
      index % 2 === 0 ? GREEN : RED,
    )
  })
}

function paintMan(ctx: CanvasRenderingContext2D, rank: number): void {
  const numerals = ['一', '二', '三', '四', '五', '六', '七', '八', '九']
  drawText(ctx, numerals[rank - 1] ?? '', 128, 108, 84, INK, '500')
  drawText(ctx, '萬', 128, 232, 92, RED, '600')

  ctx.save()
  ctx.strokeStyle = 'rgba(169,130,67,0.4)'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(66, 168)
  ctx.lineTo(190, 168)
  ctx.stroke()
  ctx.restore()
}

const HONOR_FACE: Record<string, { glyph: string; color: string }> = {
  'honor-east': { glyph: '東', color: INK },
  'honor-south': { glyph: '南', color: INK },
  'honor-west': { glyph: '西', color: INK },
  'honor-north': { glyph: '北', color: INK },
  'honor-red': { glyph: '中', color: '#b3261e' },
  'honor-green': { glyph: '發', color: '#1c6b3c' },
}

function paintHonor(ctx: CanvasRenderingContext2D, kindId: string): void {
  if (kindId === 'honor-white') {
    ctx.save()
    roundRectPath(ctx, 56, 82, 144, 156, 22)
    ctx.strokeStyle = BLUE
    ctx.lineWidth = 9
    ctx.stroke()
    ctx.strokeStyle = 'rgba(255,250,235,0.55)'
    ctx.lineWidth = 2
    roundRectPath(ctx, 62, 88, 132, 144, 18)
    ctx.stroke()
    ctx.restore()
    return
  }

  const honor = HONOR_FACE[kindId] ?? { glyph: '?', color: INK }
  drawText(ctx, honor.glyph, 128, 168, 142, honor.color, '600')
}

const FLOWER_FACE: Record<string, { glyph: string; color: string; season: boolean }> = {
  'flower-spring': { glyph: '春', color: '#2b7a5a', season: true },
  'flower-summer': { glyph: '夏', color: '#2b7a5a', season: true },
  'flower-autumn': { glyph: '秋', color: '#2b7a5a', season: true },
  'flower-winter': { glyph: '冬', color: '#2b7a5a', season: true },
  'flower-plum': { glyph: '梅', color: '#b23a48', season: false },
  'flower-orchid': { glyph: '蘭', color: '#b23a48', season: false },
  'flower-bamboo': { glyph: '竹', color: '#b23a48', season: false },
  'flower-chrysanthemum': { glyph: '菊', color: '#b23a48', season: false },
}

function paintFlower(ctx: CanvasRenderingContext2D, kindId: string): void {
  const flower = FLOWER_FACE[kindId] ?? { glyph: '?', color: GREEN, season: true }
  drawText(ctx, flower.glyph, 120, 158, 138, flower.color, '600')

  ctx.save()
  ctx.translate(202, 262)
  ctx.rotate(flower.season ? -0.18 : 0.12)
  roundRectPath(ctx, -16, -16, 32, 32, 7)
  ctx.strokeStyle = flower.color
  ctx.lineWidth = 2.4
  ctx.stroke()

  ctx.fillStyle = flower.color
  ctx.beginPath()
  ctx.ellipse(0, 2, 8, 4.5, -0.6, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()

  ctx.save()
  ctx.strokeStyle = flower.color
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.moveTo(40, 276)
  ctx.quadraticCurveTo(58, 262, 66, 276)
  ctx.stroke()
  ctx.restore()
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
