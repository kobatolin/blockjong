/**
 * High-recognition Mahjong faces, adapted from the Canvas 2D reference package.
 * The design space is 120×160; the final texture is 256×320 (2× content with
 * an 8px paper margin) and is mapped onto the 3D tile face.
 */
import * as THREE from 'three'
import { kindOf } from '@/core/kinds'
import type { TileKind } from '@/core/types'
import { createCanvas, roundRectPath } from './canvas'

const DESIGN_W = 120
const DESIGN_H = 160
const FACE_W = 256
const FACE_H = 320
const SCALE = 2
const OFFSET_X = (FACE_W - DESIGN_W * SCALE) / 2

const INK = '#18231d'
const RED = '#c72c32'
const GREEN = '#175c3f'
const GREEN_LIGHT = '#3a7753'
const BLUE = '#1b4f8f'
const IVORY = '#fbf7e9'
const PAPER_HI = '#faf4e4'
const PAPER_MID = '#f4e8cf'
const PAPER_LOW = '#e8d8b8'

const BRUSH_FONT =
  'MahjongBrush, MahjongTraditional, "Noto Serif CJK TC", "Songti TC", "KaiTi", serif'
const TRADITIONAL_FONT =
  'MahjongTraditional, "Noto Serif CJK TC", "Songti TC", "KaiTi", serif'

type Ctx = CanvasRenderingContext2D

function seedFrom(text: string): () => number {
  let seed = 2166136261
  for (let i = 0; i < text.length; i += 1) {
    seed ^= text.charCodeAt(i)
    seed = Math.imul(seed, 16777619)
  }
  return () => {
    seed += 0x6d2b79f5
    let t = seed
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function roundedRect(
  ctx: Ctx,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void {
  roundRectPath(ctx, x, y, width, height, radius)
}

function glyph(
  ctx: Ctx,
  text: string,
  x: number,
  y: number,
  size: number,
  color = INK,
  rotation = 0,
  strokeWidth = 0,
  font = BRUSH_FONT,
): void {
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(rotation)
  ctx.font = `${size}px ${font}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = color
  if (strokeWidth > 0) {
    ctx.strokeStyle = color
    ctx.lineWidth = strokeWidth
    ctx.lineJoin = 'round'
    ctx.strokeText(text, 0, 0)
  }
  ctx.fillText(text, 0, 0)
  ctx.restore()
}

function paintPaper(ctx: Ctx, id: string): void {
  const background = ctx.createLinearGradient(12, 0, FACE_W - 12, FACE_H)
  background.addColorStop(0, PAPER_HI)
  background.addColorStop(0.46, PAPER_MID)
  background.addColorStop(1, PAPER_LOW)
  ctx.fillStyle = background
  ctx.fillRect(0, 0, FACE_W, FACE_H)

  const random = seedFrom(id)
  for (let i = 0; i < 110; i += 1) {
    const x = 8 + random() * (FACE_W - 16)
    const y = 8 + random() * (FACE_H - 16)
    const radius = 0.25 + random() * 0.9
    ctx.fillStyle = `rgba(104, 85, 48, ${0.018 + random() * 0.026})`
    ctx.beginPath()
    ctx.arc(x, y, radius, 0, Math.PI * 2)
    ctx.fill()
  }

  ctx.save()
  roundedRect(ctx, 6, 6, FACE_W - 12, FACE_H - 12, 18)
  ctx.strokeStyle = 'rgba(133, 115, 77, 0.32)'
  ctx.lineWidth = 1.2
  ctx.stroke()
  ctx.restore()
}

function drawHonor(ctx: Ctx, id: string): void {
  if (id === 'honor-east') {
    glyph(ctx, '東', 59, 79, 88, INK, 0.01, 7.5, TRADITIONAL_FONT)
    return
  }
  if (id === 'honor-south') {
    glyph(ctx, '南', 59, 79, 86, INK, -0.012, 2.2, BRUSH_FONT)
    return
  }
  if (id === 'honor-west') {
    glyph(ctx, '西', 59, 79, 86, INK, -0.025, 2.2, BRUSH_FONT)
    return
  }
  if (id === 'honor-north') {
    glyph(ctx, '北', 59, 79, 86, INK, 0.018, 2.2, BRUSH_FONT)
    return
  }
  if (id === 'honor-red') {
    glyph(ctx, '中', 59, 78, 98, RED, -0.015, 2.6, BRUSH_FONT)
    return
  }
  if (id === 'honor-green') {
    glyph(ctx, '發', 59, 79, 94, GREEN, 0.02, 7.0, TRADITIONAL_FONT)
    return
  }

  ctx.save()
  roundedRect(ctx, 28, 23, 64, 108, 5)
  ctx.strokeStyle = BLUE
  ctx.lineWidth = 5
  ctx.stroke()
  roundedRect(ctx, 35, 30, 50, 94, 3)
  ctx.lineWidth = 2.4
  ctx.stroke()
  ctx.strokeStyle = 'rgba(27, 79, 143, 0.35)'
  ctx.lineWidth = 0.9
  roundedRect(ctx, 40, 35, 40, 84, 2)
  ctx.stroke()
  ctx.restore()
}

function leaf(
  ctx: Ctx,
  x: number,
  y: number,
  length: number,
  width: number,
  angle: number,
  color = GREEN,
): void {
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(angle)
  ctx.beginPath()
  ctx.moveTo(0, 0)
  ctx.bezierCurveTo(length * 0.25, -width, length * 0.8, -width * 0.8, length, 0)
  ctx.bezierCurveTo(length * 0.72, width * 0.72, length * 0.2, width * 0.65, 0, 0)
  ctx.fillStyle = color
  ctx.fill()
  ctx.strokeStyle = 'rgba(20,65,42,0.65)'
  ctx.lineWidth = 0.8
  ctx.stroke()
  ctx.restore()
}

function stem(
  ctx: Ctx,
  points: number[],
  color = GREEN,
  width = 2.2,
): void {
  ctx.beginPath()
  ctx.moveTo(points[0], points[1])
  ctx.bezierCurveTo(
    points[2],
    points[3],
    points[4],
    points[5],
    points[6],
    points[7],
  )
  ctx.strokeStyle = color
  ctx.lineWidth = width
  ctx.lineCap = 'round'
  ctx.stroke()
}

function rose(ctx: Ctx, x: number, y: number, r = 12, color = RED): void {
  ctx.save()
  ctx.translate(x, y)
  ctx.fillStyle = IVORY
  ctx.strokeStyle = color
  ctx.lineWidth = Math.max(1.5, r * 0.16)
  ctx.beginPath()
  for (let i = 0; i < 5; i += 1) {
    const angle = (i * Math.PI * 2) / 5 - Math.PI / 2
    const px = Math.cos(angle) * r * 0.38
    const py = Math.sin(angle) * r * 0.38
    ctx.moveTo(px + r * 0.68, py)
    ctx.arc(px, py, r * 0.68, 0, Math.PI * 2)
  }
  ctx.fill()
  ctx.stroke()
  ctx.beginPath()
  ctx.arc(0, 0, r * 0.48, 0.2, Math.PI * 1.8)
  ctx.arc(-r * 0.08, 0, r * 0.22, Math.PI * 1.7, 0.1, true)
  ctx.stroke()
  ctx.restore()
}

interface FlowerMeta {
  char: string
  number: number
  color: string
  reverse: boolean
}

const FLOWERS: Record<string, FlowerMeta> = {
  spring: { char: '春', number: 1, color: GREEN, reverse: false },
  summer: { char: '夏', number: 2, color: GREEN, reverse: false },
  autumn: { char: '秋', number: 3, color: GREEN, reverse: false },
  winter: { char: '冬', number: 4, color: GREEN, reverse: false },
  plum: { char: '梅', number: 1, color: RED, reverse: true },
  orchid: { char: '兰', number: 2, color: RED, reverse: true },
  bamboo: { char: '竹', number: 4, color: RED, reverse: true },
  chrysanthemum: { char: '菊', number: 3, color: RED, reverse: true },
}

function flowerLabel(
  ctx: Ctx,
  char: string,
  number: number,
  color: string,
  reverse: boolean,
): void {
  const numberX = reverse ? 94 : 18
  const charX = reverse ? 18 : 94
  glyph(ctx, String(number), numberX, 26, 46, RED, 0.02, 2.0, BRUSH_FONT)
  glyph(ctx, char, charX, 26, 46, color, -0.03, 2.0, BRUSH_FONT)
}

function drawFlower(ctx: Ctx, id: string): void {
  const type = id.replace('flower-', '')
  const info = FLOWERS[type]
  if (!info) return
  flowerLabel(ctx, info.char, info.number, info.color, info.reverse)

  if (type === 'orchid') {
    stem(ctx, [56, 133, 48, 102, 61, 69, 49, 47], GREEN, 2.4)
    stem(ctx, [58, 132, 78, 105, 80, 75, 67, 60], GREEN, 2.1)
    stem(ctx, [58, 131, 38, 111, 34, 83, 44, 68], GREEN_LIGHT, 2.1)
    stem(ctx, [62, 132, 91, 113, 86, 87, 83, 76], GREEN, 2.5)
    stem(ctx, [59, 133, 69, 109, 55, 86, 60, 72], GREEN, 1.5)
    rose(ctx, 70, 105, 6, RED)
    return
  }

  if (type === 'bamboo') {
    stem(ctx, [40, 133, 53, 107, 58, 74, 75, 48], GREEN, 3)
    stem(ctx, [58, 134, 67, 111, 72, 85, 86, 63], GREEN, 2.4)
    for (const [x, y, angle] of [
      [52, 105, -2.7],
      [57, 91, -0.25],
      [63, 78, -2.8],
      [70, 66, -0.3],
      [70, 111, -0.2],
      [78, 90, -2.8],
      [82, 74, -0.15],
    ] as const) {
      leaf(ctx, x, y, 19, 5, angle, GREEN)
    }
    ctx.fillStyle = GREEN
    ctx.beginPath()
    ctx.arc(38, 121, 3, 0, Math.PI * 2)
    ctx.fill()
    return
  }

  if (type === 'autumn') {
    stem(ctx, [48, 133, 42, 105, 67, 80, 58, 52], GREEN, 2.6)
    stem(ctx, [55, 100, 75, 91, 71, 71, 79, 62], GREEN, 1.8)
    leaf(ctx, 49, 105, 23, 7, -2.8)
    leaf(ctx, 58, 85, 20, 6, -0.4)
    leaf(ctx, 57, 67, 17, 6, -2.5)
    rose(ctx, 51, 105, 10)
    rose(ctx, 70, 92, 9)
    return
  }

  if (type === 'summer') {
    stem(ctx, [56, 135, 38, 106, 73, 89, 48, 57], GREEN, 2.4)
    stem(ctx, [55, 116, 75, 110, 81, 91, 78, 80], GREEN, 1.8)
    leaf(ctx, 48, 111, 24, 6, -2.75)
    leaf(ctx, 60, 96, 21, 6, -0.2)
    rose(ctx, 49, 79, 13)
    ctx.strokeStyle = RED
    ctx.lineWidth = 1.3
    for (let i = 0; i < 5; i += 1) {
      ctx.beginPath()
      ctx.moveTo(49, 79)
      ctx.lineTo(40 + i * 4, 61 - Math.abs(2 - i) * 2)
      ctx.stroke()
    }
    return
  }

  if (type === 'winter') {
    stem(ctx, [54, 134, 45, 113, 63, 90, 55, 66], GREEN, 2.2)
    stem(ctx, [55, 133, 78, 114, 82, 90, 76, 73], GREEN, 2.2)
    leaf(ctx, 51, 112, 29, 4, -2.7)
    leaf(ctx, 57, 107, 30, 4, -0.4)
    leaf(ctx, 60, 93, 26, 4, -2.5)
    leaf(ctx, 65, 91, 26, 4, -0.35)
    rose(ctx, 51, 62, 10)
    return
  }

  const lean = type === 'plum' ? 9 : type === 'chrysanthemum' ? -5 : 0
  stem(ctx, [56, 135, 52 + lean, 109, 72, 83, 58 + lean, 59], GREEN, 2.8)
  if (type === 'plum') {
    stem(ctx, [61, 90, 58, 72, 67, 59, 65, 42], INK, 2.4)
    for (let i = 0; i < 4; i += 1) {
      ctx.strokeStyle = GREEN
      ctx.lineWidth = 1.5
      ctx.beginPath()
      ctx.arc(65, 48 + i * 8, 4, -0.8, 2.4)
      ctx.stroke()
    }
  }
  leaf(ctx, 54, 111, 28, 9, -2.65)
  leaf(ctx, 59, 100, 26, 8, -0.35)
  if (type === 'spring') leaf(ctx, 51, 121, 21, 8, 2.7)
  rose(ctx, 55 + lean, type === 'plum' ? 96 : 72, type === 'chrysanthemum' ? 12 : 14)
}

function bambooStick(
  ctx: Ctx,
  x: number,
  y: number,
  length = 36,
  color = GREEN,
): void {
  ctx.save()
  ctx.translate(x, y)
  roundedRect(ctx, -4.2, -length / 2, 8.4, length, 4)
  ctx.fillStyle = IVORY
  ctx.fill()
  ctx.strokeStyle = color
  ctx.lineWidth = 2.8
  ctx.stroke()
  ctx.lineWidth = 1.5
  for (const offset of [-length / 6, length / 6]) {
    ctx.beginPath()
    ctx.moveTo(-3.5, offset)
    ctx.lineTo(3.5, offset)
    ctx.stroke()
  }
  ctx.strokeStyle = 'rgba(255,255,240,0.75)'
  ctx.lineWidth = 0.8
  ctx.beginPath()
  ctx.moveTo(-1, -length / 2 + 4)
  ctx.lineTo(-1, length / 2 - 4)
  ctx.stroke()
  ctx.restore()
}

function bambooSegment(
  ctx: Ctx,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): void {
  ctx.save()
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  const stroke = (width: number, color: string): void => {
    ctx.strokeStyle = color
    ctx.lineWidth = width
    ctx.beginPath()
    ctx.moveTo(x1, y1)
    ctx.lineTo(x2, y2)
    ctx.stroke()
  }

  stroke(24, 'rgba(10, 42, 28, 0.9)')
  stroke(18, GREEN)
  stroke(5, 'rgba(255, 250, 235, 0.72)')

  const dx = x2 - x1
  const dy = y2 - y1
  const length = Math.hypot(dx, dy) || 1
  const nx = -dy / length
  const ny = dx / length
  ctx.strokeStyle = 'rgba(10, 42, 28, 0.6)'
  ctx.lineWidth = 2.4
  for (const at of [0.3, 0.7]) {
    const cx = x1 + dx * at
    const cy = y1 + dy * at
    ctx.beginPath()
    ctx.moveTo(cx - nx * 10, cy - ny * 10)
    ctx.lineTo(cx + nx * 10, cy + ny * 10)
    ctx.stroke()
  }
  ctx.restore()
}

function drawBambooEight(ctx: Ctx): void {
  const top: Array<[number, number]> = [
    [23, 18],
    [40, 50],
    [60, 18],
    [80, 50],
    [97, 18],
  ]
  const bottom: Array<[number, number]> = [
    [23, 142],
    [40, 110],
    [60, 142],
    [80, 110],
    [97, 142],
  ]
  for (let i = 0; i < top.length - 1; i += 1) {
    bambooSegment(ctx, top[i][0], top[i][1], top[i + 1][0], top[i + 1][1])
    bambooSegment(ctx, bottom[i][0], bottom[i][1], bottom[i + 1][0], bottom[i + 1][1])
  }
}

function drawBambooBird(ctx: Ctx): void {
  ctx.save()
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  stem(ctx, [27, 99, 43, 84, 43, 52, 67, 42], GREEN, 3)
  stem(ctx, [38, 131, 52, 109, 49, 74, 65, 59], GREEN, 4)
  stem(ctx, [53, 127, 72, 104, 63, 74, 71, 60], GREEN_LIGHT, 2.5)
  ctx.beginPath()
  ctx.moveTo(48, 70)
  ctx.bezierCurveTo(37, 87, 42, 108, 52, 115)
  ctx.bezierCurveTo(66, 95, 70, 76, 60, 66)
  ctx.closePath()
  ctx.fillStyle = IVORY
  ctx.fill()
  ctx.strokeStyle = GREEN
  ctx.lineWidth = 3
  ctx.stroke()
  ctx.beginPath()
  ctx.arc(62, 53, 13, 0, Math.PI * 2)
  ctx.fillStyle = IVORY
  ctx.fill()
  ctx.strokeStyle = GREEN
  ctx.lineWidth = 3
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(72, 51)
  ctx.lineTo(91, 57)
  ctx.lineTo(73, 61)
  ctx.closePath()
  ctx.fillStyle = GREEN
  ctx.fill()
  ctx.beginPath()
  ctx.arc(64, 51, 5, 0, Math.PI * 2)
  ctx.fillStyle = RED
  ctx.fill()
  ctx.beginPath()
  ctx.arc(64, 51, 1.8, 0, Math.PI * 2)
  ctx.fillStyle = INK
  ctx.fill()
  leaf(ctx, 43, 84, 23, 6, -2.8)
  leaf(ctx, 70, 78, 23, 6, -0.3)
  leaf(ctx, 31, 101, 18, 5, -2.8)
  ctx.restore()
}

function drawBamboo(ctx: Ctx, number: number): void {
  if (number === 1) {
    drawBambooBird(ctx)
    return
  }
  if (number === 8) {
    drawBambooEight(ctx)
    return
  }
  const layouts: Record<number, Array<[number, number, number]>> = {
    2: [
      [60, 48, 40],
      [60, 108, 40],
    ],
    3: [
      [60, 39, 34],
      [40, 103, 38],
      [80, 103, 38],
    ],
    4: [
      [40, 48, 38],
      [80, 48, 38],
      [40, 108, 38],
      [80, 108, 38],
    ],
    5: [
      [38, 43, 34],
      [82, 43, 34],
      [60, 79, 34],
      [38, 116, 34],
      [82, 116, 34],
    ],
    6: [
      [35, 48, 38],
      [60, 48, 38],
      [85, 48, 38],
      [35, 108, 38],
      [60, 108, 38],
      [85, 108, 38],
    ],
    7: [
      [60, 31, 27],
      [35, 79, 32],
      [60, 79, 32],
      [85, 79, 32],
      [35, 119, 32],
      [60, 119, 32],
      [85, 119, 32],
    ],
    9: [
      [32, 38, 31],
      [60, 38, 31],
      [88, 38, 31],
      [32, 79, 31],
      [60, 79, 31],
      [88, 79, 31],
      [32, 120, 31],
      [60, 120, 31],
      [88, 120, 31],
    ],
  }
  const layout = layouts[number]
  if (!layout) return
  layout.forEach(([x, y, length], index) => {
    const isRed =
      (number === 5 && index === 2) ||
      (number === 7 && index === 0) ||
      (number === 9 && index % 3 === 1)
    bambooStick(ctx, x, y, length, isRed ? RED : GREEN)
  })
}

function pip(ctx: Ctx, x: number, y: number, r: number, color = GREEN): void {
  ctx.save()
  ctx.translate(x, y)
  ctx.fillStyle = IVORY
  ctx.strokeStyle = color
  ctx.lineWidth = Math.max(4.2, r * 0.32)
  ctx.beginPath()
  ctx.arc(0, 0, r, 0, Math.PI * 2)
  ctx.fill()
  ctx.stroke()
  ctx.lineWidth = Math.max(2.4, r * 0.2)
  ctx.beginPath()
  ctx.arc(0, 0, r * 0.68, 0, Math.PI * 2)
  ctx.stroke()
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.arc(0, 0, r * 0.32, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = IVORY
  ctx.beginPath()
  ctx.arc(0, 0, r * 0.11, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

function largePip(ctx: Ctx): void {
  ctx.save()
  ctx.translate(60, 79)
  ctx.fillStyle = IVORY
  ctx.strokeStyle = GREEN
  ctx.lineWidth = 4.2
  ctx.beginPath()
  ctx.arc(0, 0, 44, 0, Math.PI * 2)
  ctx.fill()
  ctx.stroke()
  ctx.lineWidth = 2.5
  ctx.beginPath()
  ctx.arc(0, 0, 35, 0, Math.PI * 2)
  ctx.stroke()
  for (let i = 0; i < 20; i += 1) {
    const angle = (i * Math.PI * 2) / 20
    ctx.beginPath()
    ctx.moveTo(Math.cos(angle) * 25, Math.sin(angle) * 25)
    ctx.lineTo(Math.cos(angle) * 32, Math.sin(angle) * 32)
    ctx.stroke()
  }
  ctx.fillStyle = RED
  ctx.beginPath()
  ctx.arc(0, 0, 15, 0, Math.PI * 2)
  ctx.fill()
  for (let i = 0; i < 8; i += 1) {
    const angle = (i * Math.PI * 2) / 8
    ctx.fillStyle = IVORY
    ctx.beginPath()
    ctx.arc(Math.cos(angle) * 8, Math.sin(angle) * 8, 2.4, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.restore()
}

function drawDots(ctx: Ctx, number: number): void {
  if (number === 1) {
    largePip(ctx)
    return
  }
  const layouts: Record<number, Array<[number, number]>> = {
    2: [
      [60, 46],
      [60, 112],
    ],
    3: [
      [40, 39],
      [60, 79],
      [80, 119],
    ],
    4: [
      [40, 47],
      [80, 47],
      [40, 111],
      [80, 111],
    ],
    5: [
      [39, 42],
      [81, 42],
      [60, 79],
      [39, 116],
      [81, 116],
    ],
    6: [
      [32, 40],
      [60, 40],
      [88, 40],
      [32, 79],
      [60, 79],
      [88, 79],
    ],
    7: [
      [36, 34],
      [60, 46],
      [84, 58],
      [40, 94],
      [80, 94],
      [40, 126],
      [80, 126],
    ],
    8: [
      [42, 31],
      [78, 31],
      [42, 63],
      [78, 63],
      [42, 96],
      [78, 96],
      [42, 128],
      [78, 128],
    ],
    9: [
      [31, 39],
      [60, 39],
      [89, 39],
      [31, 79],
      [60, 79],
      [89, 79],
      [31, 119],
      [60, 119],
      [89, 119],
    ],
  }
  const radii: Record<number, number> = {
    2: 22,
    3: 18,
    4: 19,
    5: 18,
    6: 14,
    7: 13,
    8: 14,
    9: 14,
  }
  const layout = layouts[number]
  if (!layout) return
  layout.forEach(([x, y], index) => {
    let color = GREEN
    if (number === 3) color = index === 1 ? RED : index === 0 ? INK : GREEN
    if (number === 4 || number === 8) color = INK
    if (number === 5) color = index === 2 ? RED : GREEN
    if (number === 6) color = index < 3 ? GREEN : RED
    if (number === 7) color = index < 3 ? GREEN : RED
    if (number === 9) color = index < 3 ? GREEN : index < 6 ? RED : INK
    pip(ctx, x, y, radii[number], color)
  })
}

function drawWan(ctx: Ctx, number: number): void {
  const numerals = ['一', '二', '三', '四', '伍', '六', '七', '八', '九']
  glyph(
    ctx,
    numerals[number - 1] ?? '',
    60,
    46,
    number === 1 ? 64 : 62,
    INK,
    -0.015,
    4.0,
    BRUSH_FONT,
  )
  glyph(ctx, '萬', 60, 108, 72, RED, 0.012, 6.0, TRADITIONAL_FONT)
}

function paintFace(kind: TileKind): HTMLCanvasElement {
  const canvas = createCanvas(FACE_W, FACE_H)
  const ctx = canvas.getContext('2d')!
  paintPaper(ctx, kind.id)

  ctx.save()
  ctx.translate(OFFSET_X, 0)
  ctx.scale(SCALE, SCALE)
  ctx.beginPath()
  roundedRect(ctx, 1, 1, DESIGN_W - 2, DESIGN_H - 2, 10)
  ctx.clip()

  switch (kind.suit) {
    case 'pin':
      drawDots(ctx, kind.rank ?? 1)
      break
    case 'sou':
      drawBamboo(ctx, kind.rank ?? 1)
      break
    case 'man':
      drawWan(ctx, kind.rank ?? 1)
      break
    case 'honor':
      drawHonor(ctx, kind.id)
      break
    case 'flower':
      drawFlower(ctx, kind.id)
      break
  }

  ctx.restore()
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
