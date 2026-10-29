/** Felt table, board mat and a subtle wooden rim, all procedurally drawn. */
import * as THREE from 'three'
import { boardDimensions } from './layout'
import { createCanvas, roundRectPath } from './canvas'

export interface TableObjects {
  group: THREE.Group
  dispose: () => void
}

function makeFeltTexture(): THREE.CanvasTexture {
  const size = 512
  const canvas = createCanvas(size, size)
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#0a2b24'
  ctx.fillRect(0, 0, size, size)

  for (let i = 0; i < 9000; i += 1) {
    const x = Math.random() * size
    const y = Math.random() * size
    ctx.fillStyle = Math.random() > 0.5 ? 'rgba(255,255,255,0.025)' : 'rgba(0,0,0,0.06)'
    ctx.fillRect(x, y, 1, 1)
  }
  for (let i = 0; i < 220; i += 1) {
    const x = Math.random() * size
    const y = Math.random() * size
    const length = 4 + Math.random() * 16
    ctx.strokeStyle = 'rgba(0,0,0,0.05)'
    ctx.lineWidth = 0.7
    ctx.beginPath()
    ctx.moveTo(x, y)
    ctx.lineTo(x + length, y + Math.random() * 2 - 1)
    ctx.stroke()
  }

  const texture = new THREE.CanvasTexture(canvas)
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  texture.repeat.set(10, 10)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 4
  return texture
}

function makeMatTexture(width: number, depth: number): THREE.CanvasTexture {
  const canvasWidth = 1024
  const canvasHeight = Math.round((canvasWidth * depth) / width)
  const canvas = createCanvas(canvasWidth, canvasHeight)
  const ctx = canvas.getContext('2d')!
  ctx.clearRect(0, 0, canvasWidth, canvasHeight)

  const margin = 14
  const outerRadius = 42
  roundRectPath(ctx, margin, margin, canvasWidth - margin * 2, canvasHeight - margin * 2, outerRadius)
  const wood = ctx.createLinearGradient(0, 0, canvasWidth, canvasHeight)
  wood.addColorStop(0, '#3b2618')
  wood.addColorStop(0.45, '#2a1a10')
  wood.addColorStop(1, '#1b100a')
  ctx.fillStyle = wood
  ctx.fill()

  const border = 22
  roundRectPath(
    ctx,
    margin + border,
    margin + border,
    canvasWidth - (margin + border) * 2,
    canvasHeight - (margin + border) * 2,
    outerRadius - 12,
  )
  const felt = ctx.createRadialGradient(
    canvasWidth / 2,
    canvasHeight / 2,
    20,
    canvasWidth / 2,
    canvasHeight / 2,
    canvasWidth * 0.65,
  )
  felt.addColorStop(0, '#104238')
  felt.addColorStop(1, '#082b25')
  ctx.fillStyle = felt
  ctx.fill()

  ctx.strokeStyle = 'rgba(217,179,108,0.55)'
  ctx.lineWidth = 2
  roundRectPath(
    ctx,
    margin + border + 10,
    margin + border + 10,
    canvasWidth - (margin + border + 10) * 2,
    canvasHeight - (margin + border + 10) * 2,
    outerRadius - 18,
  )
  ctx.stroke()

  for (let i = 0; i < 3000; i += 1) {
    const x = margin + border + Math.random() * (canvasWidth - (margin + border) * 2)
    const y = margin + border + Math.random() * (canvasHeight - (margin + border) * 2)
    ctx.fillStyle = Math.random() > 0.5 ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.05)'
    ctx.fillRect(x, y, 1, 1)
  }

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 8
  return texture
}

export function createTable(rows: number, cols: number): TableObjects {
  const group = new THREE.Group()
  const { width, depth } = boardDimensions(rows, cols)
  const disposables: Array<{ dispose: () => void }> = []

  const feltTexture = makeFeltTexture()
  const feltMaterial = new THREE.MeshStandardMaterial({
    map: feltTexture,
    color: 0xffffff,
    roughness: 1,
    metalness: 0,
  })
  const table = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), feltMaterial)
  table.rotation.x = -Math.PI / 2
  table.position.y = -0.02
  table.receiveShadow = true
  group.add(table)
  disposables.push(table.geometry, feltMaterial, feltTexture)

  const matTexture = makeMatTexture(width + 3.0, depth + 3.0)
  const matMaterial = new THREE.MeshStandardMaterial({
    map: matTexture,
    transparent: true,
    roughness: 0.92,
    metalness: 0,
  })
  const mat = new THREE.Mesh(new THREE.PlaneGeometry(width + 3.0, depth + 3.0), matMaterial)
  mat.rotation.x = -Math.PI / 2
  mat.position.y = 0.005
  mat.receiveShadow = true
  group.add(mat)
  disposables.push(mat.geometry, matMaterial, matTexture)

  return {
    group,
    dispose: () => {
      for (const item of disposables) item.dispose()
    },
  }
}
