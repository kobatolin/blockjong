/** Small pooled gold sparks for pair removal. */
import * as THREE from 'three'
import { createCanvas } from './canvas'

const MAX_PARTICLES = 180

function makeSparkTexture(): THREE.CanvasTexture {
  const canvas = createCanvas(64, 64)
  const ctx = canvas.getContext('2d')!
  const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32)
  gradient.addColorStop(0, 'rgba(255, 248, 220, 1)')
  gradient.addColorStop(0.25, 'rgba(255, 214, 128, 0.95)')
  gradient.addColorStop(0.65, 'rgba(217, 179, 108, 0.45)')
  gradient.addColorStop(1, 'rgba(217, 179, 108, 0)')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, 64, 64)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

export class ParticleBurst {
  private readonly geometry = new THREE.BufferGeometry()
  private readonly material: THREE.PointsMaterial
  private readonly texture: THREE.CanvasTexture
  private readonly points: THREE.Points
  private readonly positions = new Float32Array(MAX_PARTICLES * 3)
  private readonly velocities = new Float32Array(MAX_PARTICLES * 3)
  private readonly life = new Float32Array(MAX_PARTICLES)
  private readonly age = new Float32Array(MAX_PARTICLES)
  private cursor = 0
  private count = 28

  constructor(scene: THREE.Scene) {
    for (let i = 0; i < MAX_PARTICLES; i += 1) {
      this.positions[i * 3 + 1] = -100
    }
    this.geometry.setAttribute(
      'position',
      new THREE.BufferAttribute(this.positions, 3).setUsage(THREE.DynamicDrawUsage),
    )
    this.texture = makeSparkTexture()
    this.material = new THREE.PointsMaterial({
      color: 0xffd27a,
      size: 0.12,
      map: this.texture,
      transparent: true,
      opacity: 0.95,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true,
    })
    this.points = new THREE.Points(this.geometry, this.material)
    this.points.frustumCulled = false
    this.points.renderOrder = 5
    scene.add(this.points)
  }

  setCount(count: number): void {
    this.count = Math.max(0, Math.min(count, 48))
  }

  emit(x: number, y: number, z: number, count = this.count): void {
    const total = Math.min(Math.max(0, count), MAX_PARTICLES)
    for (let n = 0; n < total; n += 1) {
      const index = this.cursor
      this.cursor = (this.cursor + 1) % MAX_PARTICLES
      const i = index * 3
      this.positions[i] = x + (Math.random() - 0.5) * 0.35
      this.positions[i + 1] = y + Math.random() * 0.1
      this.positions[i + 2] = z + (Math.random() - 0.5) * 0.4
      const angle = Math.random() * Math.PI * 2
      const speed = 0.8 + Math.random() * 2.1
      this.velocities[i] = Math.cos(angle) * speed
      this.velocities[i + 1] = 1.4 + Math.random() * 2.2
      this.velocities[i + 2] = Math.sin(angle) * speed
      this.life[index] = 0.55 + Math.random() * 0.4
      this.age[index] = 0
    }
    this.geometry.attributes.position.needsUpdate = true
  }

  update(dt: number): void {
    let active = false
    for (let index = 0; index < MAX_PARTICLES; index += 1) {
      if (this.life[index] <= 0) continue
      active = true
      this.age[index] += dt
      if (this.age[index] >= this.life[index]) {
        this.life[index] = 0
        this.positions[index * 3 + 1] = -100
        continue
      }
      const i = index * 3
      this.positions[i] += this.velocities[i] * dt
      this.positions[i + 1] += this.velocities[i + 1] * dt
      this.positions[i + 2] += this.velocities[i + 2] * dt
      this.velocities[i + 1] -= 3.6 * dt
      if (this.positions[i + 1] < 0.05) {
        this.positions[i + 1] = 0.05
        this.velocities[i + 1] *= -0.28
        this.velocities[i] *= 0.7
        this.velocities[i + 2] *= 0.7
      }
    }
    if (active) this.geometry.attributes.position.needsUpdate = true
  }

  dispose(): void {
    this.geometry.dispose()
    this.material.dispose()
    this.texture.dispose()
    this.points.removeFromParent()
  }
}
