/** Shared tile geometry/material factory. One body material and one face material per kind. */
import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import type { Tile } from '@/core/types'
import { createCanvas } from './canvas'
import { CORNER_R, TILE_D, TILE_H, TILE_W, tileX, tileZ } from './layout'
import { FacePainter } from './facePainter'

function createRimTexture(): THREE.CanvasTexture {
  const canvas = createCanvas(256, 320)
  const ctx = canvas.getContext('2d')!
  ctx.clearRect(0, 0, 256, 320)
  const gradient = ctx.createLinearGradient(0, 0, 256, 320)
  gradient.addColorStop(0, 'rgba(255,255,255,.72)')
  gradient.addColorStop(0.42, 'rgba(255,255,255,.12)')
  gradient.addColorStop(1, 'rgba(255,255,255,.5)')
  ctx.strokeStyle = gradient
  ctx.lineWidth = 9
  ctx.shadowColor = 'rgba(255,255,255,.28)'
  ctx.shadowBlur = 9
  ctx.beginPath()
  ctx.roundRect(7, 7, 242, 306, 22)
  ctx.stroke()
  ctx.shadowBlur = 0
  ctx.strokeStyle = 'rgba(255,255,255,.24)'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.roundRect(14, 14, 228, 292, 18)
  ctx.stroke()
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 4
  return texture
}

export class TileFactory {
  private readonly bodyGeometry: RoundedBoxGeometry
  private readonly backGeometry: RoundedBoxGeometry
  private readonly faceGeometry: THREE.PlaneGeometry
  private readonly rimGeometry: THREE.PlaneGeometry
  private readonly rimMaterial: THREE.MeshBasicMaterial
  private readonly bodyMaterial: THREE.MeshPhysicalMaterial
  private readonly backMaterial: THREE.MeshPhysicalMaterial
  private readonly faceMaterials = new Map<string, THREE.MeshPhysicalMaterial>()
  private readonly painter: FacePainter
  private faceRoughness = 0.82
  private faceReflectivity = 0.05

  constructor(renderer: THREE.WebGLRenderer) {
    this.bodyGeometry = new RoundedBoxGeometry(TILE_W, TILE_H, TILE_D, 4, CORNER_R)
    // A thin blue cap over the back face. It sits slightly proud of the white
    // body so the lower side band reads as the blue back in the reference.
    const backHeight = TILE_H * 0.2
    this.backGeometry = new RoundedBoxGeometry(
      TILE_W * 1.003,
      backHeight,
      TILE_D * 1.003,
      4,
      0.035,
    )
    this.faceGeometry = new THREE.PlaneGeometry(TILE_W * 0.94, TILE_D * 0.94)
    this.faceGeometry.rotateX(-Math.PI / 2)
    this.rimGeometry = new THREE.PlaneGeometry(TILE_W * 0.94, TILE_D * 0.94)
    this.rimGeometry.rotateX(-Math.PI / 2)
    this.rimMaterial = new THREE.MeshBasicMaterial({
      map: createRimTexture(),
      transparent: true,
      opacity: 0.03,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
    this.bodyMaterial = new THREE.MeshPhysicalMaterial({
      color: 0xdee7da,
      roughness: 0.56,
      metalness: 0,
      clearcoat: 0.12,
      clearcoatRoughness: 0.6,
      envMapIntensity: 0.34,
    })
    this.backMaterial = new THREE.MeshPhysicalMaterial({
      color: 0x18a8df,
      roughness: 0.4,
      metalness: 0,
      clearcoat: 0.24,
      clearcoatRoughness: 0.34,
      envMapIntensity: 0.35,
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

    const back = new THREE.Mesh(this.backGeometry, this.backMaterial)
    back.position.y = -TILE_H / 2 + (TILE_H * 0.2) / 2
    back.castShadow = true
    back.receiveShadow = true
    back.userData.tileId = tile.id
    group.add(back)

    const faceMaterial = this.getFaceMaterial(tile.kindId)
    const face = new THREE.Mesh(this.faceGeometry, faceMaterial)
    face.position.y = TILE_H / 2 + 0.002
    face.receiveShadow = true
    face.userData.tileId = tile.id
    group.add(face)

    const rim = new THREE.Mesh(this.rimGeometry, this.rimMaterial)
    rim.position.y = TILE_H / 2 + 0.004
    rim.renderOrder = 2
    rim.userData.tileId = tile.id
    group.add(rim)

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
    // Printed acrylic is smoother than the body; the recessed paint is
    // rougher. A single face material cannot split those two without a
    // roughness map, so keep the sheet glossy and let the bump map + clearcoat
    // carry the engraved-paint read.
    this.faceRoughness = Math.max(0.7, 0.7 + roughness * 0.25)
    this.faceReflectivity = reflectivity * 0.12
    for (const material of this.faceMaterials.values()) {
      material.roughness = this.faceRoughness
      material.clearcoat = 0.03 + reflectivity * 0.06
      material.clearcoatRoughness = 0.25 + roughness * 0.4
      material.envMapIntensity = this.faceReflectivity
      material.needsUpdate = true
    }
    // Keep the center of the face untouched so the engraved ink stays crisp;
    // the adjustable acrylic highlight lives on the rim only.
    const lightFactor = Math.min(1, Math.max(0.35, lightIntensity / 1.8))
    this.rimMaterial.opacity = Math.min(
      0.5,
      reflectivity * (1 - roughness * 0.72) * 0.42 * lightFactor,
    )
  }

  setRimOpacity(opacity: number): void {
    this.rimMaterial.opacity = Math.min(0.8, Math.max(0, opacity))
  }

  setFaceTuning(tuning: {
    roughness: number
    clearcoat: number
    clearcoatRoughness: number
    envMapIntensity: number
    bumpScale: number
    metalness: number
  }): void {
    this.faceRoughness = tuning.roughness
    this.faceReflectivity = tuning.envMapIntensity
    for (const material of this.faceMaterials.values()) {
      material.roughness = tuning.roughness
      material.clearcoat = tuning.clearcoat
      material.clearcoatRoughness = tuning.clearcoatRoughness
      material.envMapIntensity = tuning.envMapIntensity
      material.normalScale.set(tuning.bumpScale * 3, tuning.bumpScale * 3)
      material.clearcoatNormalScale.set(tuning.bumpScale * 2.5, tuning.bumpScale * 2.5)
      material.metalness = tuning.metalness
      material.needsUpdate = true
    }
  }

  setFacePalette(palette: { ink: string; red: string; green: string }): void {
    this.painter.setPalette(palette)
    for (const [kindId, material] of this.faceMaterials) {
      const map = this.painter.get(kindId)
      material.map = map
      material.normalMap = this.painter.getNormal(kindId)
      material.clearcoatNormalMap = this.painter.getNormal(kindId)
      material.metalnessMap = this.painter.getMetalnessMask(kindId)
      material.needsUpdate = true
    }
  }

  setFaceColor(color: string): void {
    this.painter.setBaseColor(color)
    for (const [kindId, material] of this.faceMaterials) {
      material.map = this.painter.get(kindId)
      material.normalMap = this.painter.getNormal(kindId)
      material.clearcoatNormalMap = this.painter.getNormal(kindId)
      material.metalnessMap = this.painter.getMetalnessMask(kindId)
      material.needsUpdate = true
    }
  }

  setFaceHeight(height: number): void {
    this.painter.setEmboss(height)
    for (const [kindId, material] of this.faceMaterials) {
      material.map = this.painter.get(kindId)
      material.normalMap = this.painter.getNormal(kindId)
      material.clearcoatNormalMap = this.painter.getNormal(kindId)
      material.metalnessMap = this.painter.getMetalnessMask(kindId)
      material.normalScale.set(height * 3, height * 3)
      material.needsUpdate = true
    }
  }

  getFaceMaterialState(): {
    type: string
    roughness: number
    envMapIntensity: number
    clearcoat: number
  } | null {
    const material = this.faceMaterials.values().next().value as
      | THREE.MeshPhysicalMaterial
      | undefined
    if (!material) return null
    return {
      type: material.type,
      roughness: material.roughness,
      envMapIntensity: material.envMapIntensity,
      clearcoat: material.clearcoat,
    }
  }

  private getFaceMaterial(kindId: string): THREE.MeshPhysicalMaterial {
    const existing = this.faceMaterials.get(kindId)
    if (existing) return existing
    const map = this.painter.get(kindId)
    const material = new THREE.MeshPhysicalMaterial({
      map,
      // Dedicated blurred height -> normal map. normalScale is driven by the
      // “阴刻高度” slider; a plain bumpMap was too subtle on the flat top face.
      normalMap: this.painter.getNormal(kindId),
      normalScale: new THREE.Vector2(0.9, 0.9),
      clearcoatNormalMap: this.painter.getNormal(kindId),
      clearcoatNormalScale: new THREE.Vector2(0.8, 0.8),
      metalnessMap: this.painter.getMetalnessMask(kindId),
      metalness: 0.75,
      roughness: this.faceRoughness,
      clearcoat: 0.04,
      clearcoatRoughness: 0.35,
      envMapIntensity: this.faceReflectivity,
    })
    this.faceMaterials.set(kindId, material)
    return material
  }

  dispose(): void {
    this.bodyGeometry.dispose()
    this.backGeometry.dispose()
    this.faceGeometry.dispose()
    this.rimGeometry.dispose()
    this.rimMaterial.map?.dispose()
    this.rimMaterial.dispose()
    this.bodyMaterial.dispose()
    this.backMaterial.dispose()
    for (const material of this.faceMaterials.values()) material.dispose()
    this.faceMaterials.clear()
    this.painter.dispose()
  }
}
