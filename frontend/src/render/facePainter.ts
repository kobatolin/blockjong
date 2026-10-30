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

const PAPER_HI = '#fcfaf3'

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

function paintPaper(ctx: CanvasRenderingContext2D): void {
  // Clean cast-acrylic ivory: a flat, bright base instead of paper grain.
  ctx.fillStyle = PAPER_HI
  ctx.fillRect(0, 0, FACE_W, FACE_H)
  const glow = ctx.createRadialGradient(54, 30, 0, 54, 30, 250)
  glow.addColorStop(0, 'rgba(255,255,255,.16)')
  glow.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = glow
  ctx.fillRect(0, 0, FACE_W, FACE_H)
}

export function paintFaceCanvas(kindId: string): HTMLCanvasElement {
  const kind = kindOf(kindId)
  const canvas = createCanvas(FACE_W, FACE_H)
  const ctx = canvas.getContext('2d')!
  paintPaper(ctx)

  const v2Id = V2_IDS[kind.id]
  if (!v2Id) return canvas

  // 120×160 design space -> 240×320 content, centered with an 8px acrylic edge.
  ctx.save()
  ctx.translate((FACE_W - DESIGN_W * 2) / 2, 0)
  ctx.scale(2, 2)
  // A shallow recess edge around the paint reads at game size and separates
  // dark ink from the bright acrylic even when the tile is only a few pixels.
  ctx.shadowColor = 'rgba(8, 13, 11, .5)'
  ctx.shadowBlur = 0.85
  ctx.shadowOffsetX = 0.25
  ctx.shadowOffsetY = 0.25
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

export class FacePainter {
  private readonly cache = new Map<string, THREE.CanvasTexture>()
  private readonly maxAnisotropy: number

  constructor(renderer: THREE.WebGLRenderer) {
    this.maxAnisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy())
  }

  get(kindId: string): THREE.CanvasTexture {
    const cached = this.cache.get(kindId)
    if (cached) return cached

    const texture = new THREE.CanvasTexture(paintFaceCanvas(kindId))
    texture.colorSpace = THREE.SRGBColorSpace
    texture.anisotropy = this.maxAnisotropy
    texture.needsUpdate = true
    this.cache.set(kindId, texture)
    return texture
  }

  setPalette(palette: { ink: string; red: string; green: string }): void {
    setLayerColors(palette)
    for (const texture of this.cache.values()) texture.dispose()
    this.cache.clear()
  }

  dispose(): void {
    for (const texture of this.cache.values()) texture.dispose()
    this.cache.clear()
  }
}
