/**
 * Tile faces from the V2 I.Mahjong-HK contour/color pipeline.
 * The 3D tile body stays in TileFactory; this only bakes the printed face.
 */
import * as THREE from 'three'
import { kindOf } from '@/core/kinds'
import { createCanvas } from './canvas'
import { LAYER_COLORS, setLayerColors } from './imahjong/tile-segmentation.js'
import { drawMahjongFace } from './imahjong/tile-renderer.js'

const FACE_W = 256
const FACE_H = 320
const DESIGN_W = 120
const DESIGN_H = 160

const PAPER_HI = '#eeece8'

const V2_IDS: Record<string, string> = {
  'honor-east': 'wind-east',
  'honor-south': 'wind-south',
  'honor-west': 'wind-west',
  'honor-north': 'wind-north',
  'honor-red': 'dragon-red',
  'honor-green': 'dragon-green',
  'honor-white': 'dragon-white',
  'pin-1': 'dot-1',
  'pin-2': 'dot-2',
  'pin-3': 'dot-3',
  'pin-4': 'dot-4',
  'pin-5': 'dot-5',
  'pin-6': 'dot-6',
  'pin-7': 'dot-7',
  'pin-8': 'dot-8',
  'pin-9': 'dot-9',
  'sou-1': 'bamboo-1',
  'sou-2': 'bamboo-2',
  'sou-3': 'bamboo-3',
  'sou-4': 'bamboo-4',
  'sou-5': 'bamboo-5',
  'sou-6': 'bamboo-6',
  'sou-7': 'bamboo-7',
  'sou-8': 'bamboo-8',
  'sou-9': 'bamboo-9',
  'man-1': 'wan-1',
  'man-2': 'wan-2',
  'man-3': 'wan-3',
  'man-4': 'wan-4',
  'man-5': 'wan-5',
  'man-6': 'wan-6',
  'man-7': 'wan-7',
  'man-8': 'wan-8',
  'man-9': 'wan-9',
  'flower-spring': 'flower-spring',
  'flower-summer': 'flower-summer',
  'flower-autumn': 'flower-autumn',
  'flower-winter': 'flower-winter',
  'flower-plum': 'flower-plum',
  'flower-orchid': 'flower-orchid',
  'flower-bamboo': 'flower-bamboo',
  'flower-chrysanthemum': 'flower-chrysanthemum',
}

function paintPaper(ctx: CanvasRenderingContext2D, baseColor: string): void {
  // Clean cast-acrylic base; user-adjustable in RENDER DEBUG.
  ctx.fillStyle = baseColor
  ctx.fillRect(0, 0, FACE_W, FACE_H)
  const glow = ctx.createRadialGradient(54, 30, 0, 54, 30, 250)
  glow.addColorStop(0, 'rgba(255,255,255,.16)')
  glow.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = glow
  ctx.fillRect(0, 0, FACE_W, FACE_H)
}

export function paintFaceCanvas(
  kindId: string,
  emboss = 0.3,
  baseColor = PAPER_HI,
): HTMLCanvasElement {
  const kind = kindOf(kindId)
  const canvas = createCanvas(FACE_W, FACE_H)
  const ctx = canvas.getContext('2d')!
  paintPaper(ctx, baseColor)

  const v2Id = V2_IDS[kind.id]
  if (!v2Id) return canvas

  // 120×160 design space -> 240×320 content, centered with an 8px acrylic edge.
  ctx.save()
  ctx.translate((FACE_W - DESIGN_W * 2) / 2, 0)
  ctx.scale(2, 2)
  // Height drives the recessed edge shadow as well as the normal map; this
  // guarantees visible feedback even under the top-down studio light.
  const blur = 0.15 + Math.max(0, emboss) * 9
  const offset = Math.max(0, emboss) * 2.4
  ctx.shadowColor = `rgba(8, 13, 11, ${0.45 + Math.min(0.35, emboss * 0.8)})`
  ctx.shadowBlur = blur
  ctx.shadowOffsetX = offset
  ctx.shadowOffsetY = offset
  if (kind.id === 'honor-white') {
    // I.Mahjong-HK expresses the white dragon through the tile frame, which
    // lives on the 2D body. Our 3D body has no printed frame, so draw it here.
    ctx.strokeStyle = LAYER_COLORS.ink
    ctx.lineWidth = 5
    ctx.beginPath()
    ctx.roundRect(30, 25, 59, 100, 4)
    ctx.stroke()
    ctx.lineWidth = 2.2
    ctx.beginPath()
    ctx.roundRect(37, 32, 45, 86, 2)
    ctx.stroke()
    ctx.strokeStyle = 'rgba(13, 20, 17, .4)'
    ctx.lineWidth = 0.8
    ctx.beginPath()
    ctx.roundRect(42, 37, 35, 76, 1)
    ctx.stroke()
  } else {
    drawMahjongFace(ctx, v2Id)
  }
  ctx.restore()

  return canvas
}

export function paintBumpCanvas(
  kindId: string,
  emboss = 0.3,
  baseColor = PAPER_HI,
): HTMLCanvasElement {
  const source = paintFaceCanvas(kindId, emboss, baseColor)
  const raw = createCanvas(FACE_W, FACE_H)
  const rawCtx = raw.getContext('2d')!
  rawCtx.drawImage(source, 0, 0)
  const image = rawCtx.getImageData(0, 0, FACE_W, FACE_H)
  const data = image.data
  for (let i = 0; i < data.length; i += 4) {
    const luminance = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114
    // White acrylic -> high, dark fill -> low; the curve widens the groove
    // walls so the bump is visible on a 45px tile.
    const height = Math.max(0, Math.min(255, ((luminance - 24) / 206) * 255))
    data[i] = height
    data[i + 1] = height
    data[i + 2] = height
    data[i + 3] = 255
  }
  rawCtx.putImageData(image, 0, 0)

  const canvas = createCanvas(FACE_W, FACE_H)
  const ctx = canvas.getContext('2d')!
  ctx.filter = 'blur(1.35px)'
  ctx.drawImage(raw, 0, 0)
  ctx.filter = 'none'
  return canvas
}

export function paintNormalCanvas(
  kindId: string,
  emboss = 0.3,
  baseColor = PAPER_HI,
): HTMLCanvasElement {
  const height = paintBumpCanvas(kindId, emboss, baseColor)
  const source = height.getContext('2d')!.getImageData(0, 0, FACE_W, FACE_H)
  const canvas = createCanvas(FACE_W, FACE_H)
  const ctx = canvas.getContext('2d')!
  const output = ctx.createImageData(FACE_W, FACE_H)
  const at = (x: number, y: number): number => {
    const px = Math.max(0, Math.min(FACE_W - 1, x))
    const py = Math.max(0, Math.min(FACE_H - 1, y))
    return source.data[(py * FACE_W + px) * 4] / 255
  }
  const strength = 2.4
  for (let y = 0; y < FACE_H; y += 1) {
    for (let x = 0; x < FACE_W; x += 1) {
      const dx = (at(x + 1, y) - at(x - 1, y)) * strength
      const dy = (at(x, y + 1) - at(x, y - 1)) * strength
      const length = Math.hypot(dx, dy, 1)
      const offset = (y * FACE_W + x) * 4
      output.data[offset] = ((-dx / length) * 0.5 + 0.5) * 255
      output.data[offset + 1] = ((-dy / length) * 0.5 + 0.5) * 255
      output.data[offset + 2] = (1 / length) * 255
      output.data[offset + 3] = 255
    }
  }
  ctx.putImageData(output, 0, 0)
  return canvas
}

export function paintMetalnessCanvas(
  kindId: string,
  emboss = 0.3,
  baseColor = PAPER_HI,
): HTMLCanvasElement {
  const height = paintBumpCanvas(kindId, emboss, baseColor)
  const source = height.getContext('2d')!.getImageData(0, 0, FACE_W, FACE_H)
  const canvas = createCanvas(FACE_W, FACE_H)
  const ctx = canvas.getContext('2d')!
  const output = ctx.createImageData(FACE_W, FACE_H)
  for (let i = 0; i < source.data.length; i += 4) {
    // Height is high on acrylic and low in the groove; invert so the paint
    // region is white (metalness mask) and the acrylic is black.
    const value = Math.max(0, Math.min(255, (255 - source.data[i]) * 1.08))
    output.data[i] = value
    output.data[i + 1] = value
    output.data[i + 2] = value
    output.data[i + 3] = 255
  }
  ctx.putImageData(output, 0, 0)
  return canvas
}

export class FacePainter {
  private readonly cache = new Map<string, THREE.CanvasTexture>()
  private readonly bumpCache = new Map<string, THREE.CanvasTexture>()
  private readonly normalCache = new Map<string, THREE.CanvasTexture>()
  private readonly metalnessCache = new Map<string, THREE.CanvasTexture>()
  private readonly maxAnisotropy: number
  private emboss = 0.3
  private baseColor = PAPER_HI

  constructor(renderer: THREE.WebGLRenderer) {
    this.maxAnisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy())
  }

  get(kindId: string): THREE.CanvasTexture {
    const cached = this.cache.get(kindId)
    if (cached) return cached

    const texture = new THREE.CanvasTexture(
      paintFaceCanvas(kindId, this.emboss, this.baseColor),
    )
    texture.colorSpace = THREE.SRGBColorSpace
    texture.anisotropy = this.maxAnisotropy
    texture.needsUpdate = true
    this.cache.set(kindId, texture)
    return texture
  }

  getBump(kindId: string): THREE.CanvasTexture {
    const cached = this.bumpCache.get(kindId)
    if (cached) return cached

    const texture = new THREE.CanvasTexture(
      paintBumpCanvas(kindId, this.emboss, this.baseColor),
    )
    texture.colorSpace = THREE.NoColorSpace
    texture.anisotropy = this.maxAnisotropy
    texture.needsUpdate = true
    this.bumpCache.set(kindId, texture)
    return texture
  }

  getNormal(kindId: string): THREE.CanvasTexture {
    const cached = this.normalCache.get(kindId)
    if (cached) return cached

    const texture = new THREE.CanvasTexture(
      paintNormalCanvas(kindId, this.emboss, this.baseColor),
    )
    texture.colorSpace = THREE.NoColorSpace
    texture.anisotropy = this.maxAnisotropy
    texture.needsUpdate = true
    this.normalCache.set(kindId, texture)
    return texture
  }

  getMetalnessMask(kindId: string): THREE.CanvasTexture {
    const cached = this.metalnessCache.get(kindId)
    if (cached) return cached

    const texture = new THREE.CanvasTexture(
      paintMetalnessCanvas(kindId, this.emboss, this.baseColor),
    )
    texture.colorSpace = THREE.NoColorSpace
    texture.anisotropy = this.maxAnisotropy
    texture.needsUpdate = true
    this.metalnessCache.set(kindId, texture)
    return texture
  }

  setEmboss(value: number): void {
    this.emboss = value
    this.clearCaches()
  }

  setBaseColor(color: string): void {
    this.baseColor = color
    this.clearCaches()
  }

  private clearCaches(): void {
    for (const texture of this.cache.values()) texture.dispose()
    for (const texture of this.bumpCache.values()) texture.dispose()
    for (const texture of this.normalCache.values()) texture.dispose()
    for (const texture of this.metalnessCache.values()) texture.dispose()
    this.cache.clear()
    this.bumpCache.clear()
    this.normalCache.clear()
    this.metalnessCache.clear()
  }

  setPalette(palette: { ink: string; red: string; green: string }): void {
    setLayerColors(palette)
    this.clearCaches()
  }

  dispose(): void {
    for (const texture of this.cache.values()) texture.dispose()
    for (const texture of this.bumpCache.values()) texture.dispose()
    for (const texture of this.normalCache.values()) texture.dispose()
    for (const texture of this.metalnessCache.values()) texture.dispose()
    this.cache.clear()
    this.bumpCache.clear()
    this.normalCache.clear()
    this.metalnessCache.clear()
  }
}
