/** Shared tile geometry/material factory. One body material and one face material per kind. */
import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import type { Tile } from '@/core/types'
import { CORNER_R, TILE_D, TILE_H, TILE_W, tileX, tileZ } from './layout'
import { FacePainter } from './facePainter'

export class TileFactory {
  private readonly bodyGeometry: RoundedBoxGeometry
  private readonly faceGeometry: THREE.PlaneGeometry
  private readonly bodyMaterial: THREE.MeshPhysicalMaterial
  private readonly faceMaterials = new Map<string, THREE.MeshStandardMaterial>()
  private readonly painter: FacePainter

  constructor(renderer: THREE.WebGLRenderer) {
    this.bodyGeometry = new RoundedBoxGeometry(TILE_W, TILE_H, TILE_D, 3, CORNER_R)
    this.faceGeometry = new THREE.PlaneGeometry(TILE_W * 0.94, TILE_D * 0.94)
    this.faceGeometry.rotateX(-Math.PI / 2)
    this.bodyMaterial = new THREE.MeshPhysicalMaterial({
      color: 0xf1e6cf,
      roughness: 0.38,
      metalness: 0,
      clearcoat: 0.35,
      clearcoatRoughness: 0.35,
      envMapIntensity: 0.6,
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
    face.userData.tileId = tile.id
    face.receiveShadow = true
    group.add(face)

    return group
  }

  place(group: THREE.Group, row: number, col: number, rows: number, cols: number): void {
    group.position.x = tileX(col, cols)
    group.position.z = tileZ(row, rows)
  }

  getBodyMaterial(): THREE.MeshPhysicalMaterial {
    return this.bodyMaterial
  }

  private getFaceMaterial(kindId: string): THREE.MeshStandardMaterial {
    const existing = this.faceMaterials.get(kindId)
    if (existing) return existing
    const material = new THREE.MeshStandardMaterial({
      map: this.painter.get(kindId),
      roughness: 0.55,
      metalness: 0,
      envMapIntensity: 0.4,
    })
    this.faceMaterials.set(kindId, material)
    return material
  }

  dispose(): void {
    this.bodyGeometry.dispose()
    this.faceGeometry.dispose()
    this.bodyMaterial.dispose()
    for (const material of this.faceMaterials.values()) material.dispose()
    this.faceMaterials.clear()
    this.painter.dispose()
  }
}
