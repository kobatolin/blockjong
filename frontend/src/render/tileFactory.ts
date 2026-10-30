/** Shared tile geometry/material factory. One body material and one face material per kind. */
import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import type { Tile } from '@/core/types'
import { createCanvas } from './canvas'
import { CORNER_R, TILE_D, TILE_H, TILE_W, tileX, tileZ } from './layout'
import { FacePainter } from './facePainter'

function createGlossTexture(): THREE.CanvasTexture {
  const canvas = createCanvas(256, 320)
  const ctx = canvas.getContext('2d')!
  ctx.clearRect(0, 0, 256, 320)
  const band = ctx.createLinearGradient(0, 0, 256, 320)
  band.addColorStop(0, 'rgba(255,255,255,0)')
  band.addColorStop(0.3, 'rgba(255,255,255,0.52)')
  band.addColorStop(0.46, 'rgba(255,255,255,0.16)')
  band.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = band
  ctx.fillRect(0, 0, 256, 320)

  const glow = ctx.createRadialGradient(72, 54, 0, 72, 54, 190)
  glow.addColorStop(0, 'rgba(255,255,255,0.24)')
  glow.addColorStop(0.5, 'rgba(255,255,255,0.06)')
  glow.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = glow
  ctx.fillRect(0, 0, 256, 320)

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 4
  return texture
}

export class TileFactory {
  private readonly bodyGeometry: RoundedBoxGeometry
  private readonly faceGeometry: THREE.PlaneGeometry
  private readonly glossGeometry: THREE.PlaneGeometry
  private readonly glossMaterial: THREE.MeshBasicMaterial
  private readonly bodyMaterial: THREE.MeshPhysicalMaterial
  private readonly faceMaterials = new Map<string, THREE.MeshStandardMaterial>()
  private readonly painter: FacePainter
  private faceRoughness = 0.84
  private faceReflectivity = 0.04

  constructor(renderer: THREE.WebGLRenderer) {
    this.bodyGeometry = new RoundedBoxGeometry(TILE_W, TILE_H, TILE_D, 3, CORNER_R)
    this.faceGeometry = new THREE.PlaneGeometry(TILE_W * 0.94, TILE_D * 0.94)
    this.faceGeometry.rotateX(-Math.PI / 2)
    this.glossGeometry = new THREE.PlaneGeometry(TILE_W * 0.94, TILE_D * 0.94)
    this.glossGeometry.rotateX(-Math.PI / 2)
    this.glossMaterial = new THREE.MeshBasicMaterial({
      map: createGlossTexture(),
      transparent: true,
      opacity: 0.04,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
    this.bodyMaterial = new THREE.MeshPhysicalMaterial({
      color: 0xd2c1a5,
      roughness: 0.56,
      metalness: 0,
      clearcoat: 0.12,
      clearcoatRoughness: 0.6,
      envMapIntensity: 0.34,
    })
    this.painter = new FacePainter(renderer)
  }

  create(tile: Tile, rows: number, cols: number): THREE.Group {
    const group = new THREE.Group()
    group.userData.tileId = tile.id
    group.position.set(tileX(tile.col, cols), TILE_H / 2, tileZ(tile.row, rows))
    group.rotation.y = (tile.id % 7) * 0.0008 - 0.0024

    const body = new THREE.Mesh(this.bodyGeometry, this.bodyMaterial)
    body.castShadow = true
    body.receiveShadow = true
    body.userData.tileId = tile.id
    group.add(body)

    const faceMaterial = this.getFaceMaterial(tile.kindId)
    const face = new THREE.Mesh(this.faceGeometry, faceMaterial)
    face.position.y = TILE_H / 2 + 0.002
    face.receiveShadow = true
    face.userData.tileId = tile.id
    group.add(face)

    const gloss = new THREE.Mesh(this.glossGeometry, this.glossMaterial)
    gloss.position.y = TILE_H / 2 + 0.004
    gloss.renderOrder = 2
    gloss.userData.tileId = tile.id
    group.add(gloss)

    return group
  }

  place(group: THREE.Group, row: number, col: number, rows: number, cols: number): void {
    group.position.x = tileX(col, cols)
    group.position.z = tileZ(row, rows)
  }

  getBodyMaterial(): THREE.MeshPhysicalMaterial {
    return this.bodyMaterial
  }

  setFaceAppearance(roughness: number, reflectivity: number, lightIntensity = 1): void {
    this.faceRoughness = Math.max(0.15, roughness * 0.9)
    this.faceReflectivity = reflectivity * 0.55
    for (const material of this.faceMaterials.values()) {
      material.roughness = this.faceRoughness
      material.envMapIntensity = this.faceReflectivity
      material.needsUpdate = true
    }
    // The flat printed face does not catch a strong specular highlight from
    // the studio environment, so add a soft reflected-light sheen. Its
    // strength/intensity follows the same controls as the PBR material.
    const lightFactor = Math.min(1, Math.max(0.35, lightIntensity / 1.8))
    this.glossMaterial.opacity = Math.min(
      0.62,
      reflectivity * (1 - roughness * 0.75) * 0.6 * lightFactor,
    )
  }

  getFaceMaterialState(): { type: string; roughness: number; envMapIntensity: number } | null {
    const material = this.faceMaterials.values().next().value as
      | THREE.MeshStandardMaterial
      | undefined
    if (!material) return null
    return {
      type: material.type,
      roughness: material.roughness,
      envMapIntensity: material.envMapIntensity,
    }
  }

  private getFaceMaterial(kindId: string): THREE.MeshStandardMaterial {
    const existing = this.faceMaterials.get(kindId)
    if (existing) return existing
    const material = new THREE.MeshStandardMaterial({
      map: this.painter.get(kindId),
      roughness: this.faceRoughness,
      metalness: 0,
      envMapIntensity: this.faceReflectivity,
    })
    this.faceMaterials.set(kindId, material)
    return material
  }

  dispose(): void {
    this.bodyGeometry.dispose()
    this.faceGeometry.dispose()
    this.glossGeometry.dispose()
    this.glossMaterial.map?.dispose()
    this.glossMaterial.dispose()
    this.bodyMaterial.dispose()
    for (const material of this.faceMaterials.values()) material.dispose()
    this.faceMaterials.clear()
    this.painter.dispose()
  }
}
