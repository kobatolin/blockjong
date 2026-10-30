/** Three.js board view, picking and pointer interaction. Rules live in core/. */
import * as THREE from 'three'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'
import type { BoardSnapshot, Dir, Tile } from '@/core/types'
import {
  CELL_D,
  CELL_W,
  TILE_H,
  boardDimensions,
  tileX,
  tileZ,
} from './layout'
import { createTable, type TableObjects } from './table'
import { TileFactory } from './tileFactory'
import { TweenManager } from './tween'
import { createCanvas, roundRectPath } from './canvas'
import { ParticleBurst } from './particles'

const CAMERA_FOV = 34
const CAMERA_PITCH = THREE.MathUtils.degToRad(60)
const DRAG_THRESHOLD = 6

export type RenderQuality = 'auto' | 'high' | 'medium' | 'low'
export type MotionSetting = 'auto' | 'reduced'

export interface LightingSettings {
  intensity: number
  temperature: number
  roughness: number
  reflectivity: number
}

/** Every parameter currently exposed by the lighting/material pipeline. */
export interface RenderTuning {
  exposure: number
  keyIntensity: number
  fillIntensity: number
  hemisphereIntensity: number
  keyTemperature: number
  fillTemperature: number
  hemisphereTemperature: number
  keyX: number
  keyY: number
  keyZ: number
  fillX: number
  fillY: number
  fillZ: number
  bodyRoughness: number
  bodyMetalness: number
  bodyClearcoat: number
  bodyClearcoatRoughness: number
  bodyEnvMapIntensity: number
  faceRoughness: number
  faceClearcoat: number
  faceClearcoatRoughness: number
  faceEnvMapIntensity: number
  faceBumpScale: number
  faceInkMetalness: number
  rimOpacity: number
  inkColor: string
  redColor: string
  greenColor: string
  faceColor: string
  bodyColor: string
  wallColor: string
}

export const DEFAULT_RENDER_TUNING: RenderTuning = {
  exposure: 0.704,
  keyIntensity: 1.395,
  fillIntensity: 0.252,
  hemisphereIntensity: 0.495,
  keyTemperature: 4300,
  fillTemperature: 5900,
  hemisphereTemperature: 4600,
  keyX: -4,
  keyY: 18,
  keyZ: 8,
  fillX: 7,
  fillY: 7,
  fillZ: 12,
  bodyRoughness: 0.68,
  bodyMetalness: 0,
  bodyClearcoat: 0.0696,
  bodyClearcoatRoughness: 0.656,
  bodyEnvMapIntensity: 0.18,
  faceRoughness: 0.87,
  faceClearcoat: 0.0408,
  faceClearcoatRoughness: 0.522,
  faceEnvMapIntensity: 0.0216,
  faceBumpScale: 0.18,
  faceInkMetalness: 0,
  rimOpacity: 0.0193,
  inkColor: '#0d1110',
  redColor: '#df2029',
  greenColor: '#114f37',
  faceColor: '#eeece8',
  bodyColor: '#dee7da',
  wallColor: '#b8a88e',
}

export interface DragStartInfo {
  ranges: Record<Dir, number>
  segmentIds: number[]
  anchorId: number | null
}

export interface DragPreviewInfo {
  k: number
  kMax: number
  partnerId: number | null
  movedIds: number[]
  targetCells: Array<{ row: number; col: number }>
}

export interface GameRendererCallbacks {
  onTap: (tileId: number, row: number, col: number) => void
  onDragStart: (
    tileId: number,
    row: number,
    col: number,
    dir: Dir,
  ) => DragStartInfo | null
  onDragMove: (tileId: number, dir: Dir, k: number) => DragPreviewInfo | null
  onDragEnd: (tileId: number, dir: Dir, k: number) => void
  onDragCancel: () => void
}

interface TileView {
  group: THREE.Group
  tile: Tile
  baseX: number
  baseZ: number
  baseRotation: number
}

interface PointerDownState {
  tileId: number
  row: number
  col: number
  pointerId: number
  startX: number
  startY: number
}

interface DragState {
  tileId: number
  row: number
  col: number
  dir: Dir
  ranges: Record<Dir, number>
  segmentIds: number[]
  k: number
}

function createHaloTexture(): THREE.CanvasTexture {
  const canvas = createCanvas(256, 320)
  const ctx = canvas.getContext('2d')!
  ctx.clearRect(0, 0, 256, 320)
  ctx.save()
  roundRectPath(ctx, 14, 14, 228, 292, 36)
  ctx.strokeStyle = 'rgba(255, 214, 132, 0.98)'
  ctx.lineWidth = 9
  ctx.shadowColor = 'rgba(255, 196, 92, 0.95)'
  ctx.shadowBlur = 20
  ctx.stroke()
  ctx.shadowBlur = 8
  ctx.strokeStyle = 'rgba(255, 245, 210, 0.95)'
  ctx.lineWidth = 3
  ctx.stroke()
  ctx.restore()
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 4
  return texture
}

function createChoiceHaloTexture(): THREE.CanvasTexture {
  const canvas = createCanvas(256, 320)
  const ctx = canvas.getContext('2d')!
  ctx.clearRect(0, 0, 256, 320)
  ctx.save()
  roundRectPath(ctx, 8, 8, 240, 304, 30)
  ctx.strokeStyle = 'rgba(255, 209, 92, 1)'
  ctx.lineWidth = 14
  ctx.shadowColor = 'rgba(255, 184, 48, 1)'
  ctx.shadowBlur = 26
  ctx.stroke()
  ctx.shadowBlur = 10
  ctx.strokeStyle = 'rgba(255, 249, 205, 1)'
  ctx.lineWidth = 5
  ctx.stroke()
  ctx.restore()
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 4
  return texture
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

/** Approximate black-body color, used for the key/fill/hemisphere lights. */
function kelvinToColor(kelvin: number): THREE.Color {
  const temp = clamp(kelvin, 1000, 40000) / 100
  let r: number
  let g: number
  let b: number
  if (temp <= 66) {
    r = 255
    g = 99.4708025861 * Math.log(temp) - 161.1195681661
    b = temp <= 19 ? 0 : 138.5177312231 * Math.log(temp - 10) - 305.0447927307
  } else {
    r = 329.698727446 * Math.pow(temp - 60, -0.1332047592)
    g = 288.1221695283 * Math.pow(temp - 60, -0.0755148492)
    b = 255
  }
  return new THREE.Color().setRGB(
    clamp(r, 0, 255) / 255,
    clamp(g, 0, 255) / 255,
    clamp(b, 0, 255) / 255,
    THREE.SRGBColorSpace,
  )
}

export class GameRenderer {
  private readonly container: HTMLElement
  private readonly callbacks: GameRendererCallbacks
  private readonly rows: number
  private readonly cols: number
  private readonly renderer: THREE.WebGLRenderer
  private readonly scene = new THREE.Scene()
  private readonly camera: THREE.PerspectiveCamera
  private readonly table: TableObjects
  private readonly tileFactory: TileFactory
  private readonly resizeObserver: ResizeObserver
  private readonly environmentTexture: THREE.Texture
  private readonly keyLight: THREE.DirectionalLight
  private readonly fillLight: THREE.DirectionalLight
  private readonly hemisphere: THREE.HemisphereLight
  private readonly clock = new THREE.Clock()
  private readonly tweens = new TweenManager()
  private readonly raycaster = new THREE.Raycaster()
  private readonly pointerNdc = new THREE.Vector2()
  private readonly boardPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -TILE_H)
  private readonly groundPoint = new THREE.Vector3()
  private readonly tileViews = new Map<number, TileView>()
  private readonly tileGroups: THREE.Group[] = []

  private readonly selectionHalo: THREE.Mesh
  private readonly haloTexture: THREE.CanvasTexture
  private readonly partnerHaloGeometry: THREE.PlaneGeometry
  private readonly partnerHaloMaterial: THREE.MeshBasicMaterial
  private readonly partnerHalos: THREE.Mesh[] = []
  private readonly partnerMarkers: THREE.Mesh[] = []
  private readonly hintMarkers: THREE.Mesh[] = []
  private readonly choiceHaloGeometry: THREE.PlaneGeometry
  private readonly choiceHaloMaterial: THREE.MeshBasicMaterial
  private readonly choiceHalos: THREE.Mesh[] = []
  private readonly dragPartnerMarker: THREE.Mesh
  private readonly ghostGeometry: THREE.PlaneGeometry
  private readonly ghostMaterial: THREE.MeshBasicMaterial
  private readonly ghosts: THREE.Mesh[] = []
  private readonly ghostGroup = new THREE.Group()
  private readonly particles: ParticleBurst

  private animationFrame = 0
  private disposed = false
  private interactive = true
  private hoverId: number | null = null
  private selectedId: number | null = null
  private partnerIds: number[] = []
  private hintIds: number[] = []
  private quality: RenderQuality = 'auto'
  private autoDowngraded = false
  private reducedMotion = false
  private facePalette = {
    ink: '#0d1110',
    red: '#df2029',
    green: '#114f37',
  }
  private faceHeight = 0.18
  private faceColor = '#eeece8'
  private bodyColor = '#dee7da'
  private wallColor = '#b8a88e'
  private particleCount = 28
  private frameSeconds = 0
  private frameSamples = 0
  private hintUntil = 0
  private pointerDown: PointerDownState | null = null
  private drag: DragState | null = null

  constructor(
    container: HTMLElement,
    rows: number,
    cols: number,
    callbacks: GameRendererCallbacks,
  ) {
    this.container = container
    this.callbacks = callbacks
    this.rows = rows
    this.cols = cols

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
    })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    this.renderer.toneMapping = THREE.NeutralToneMapping
    this.renderer.toneMappingExposure = 0.86
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap
    this.renderer.domElement.className = 'board-canvas'
    this.renderer.domElement.setAttribute('role', 'application')
    this.renderer.domElement.setAttribute(
      'aria-label',
      '3D 麻将棋盘。点选两张牌，或按住一张牌沿行或列拖动。',
    )
    this.renderer.domElement.tabIndex = 0
    container.appendChild(this.renderer.domElement)

    this.scene.background = new THREE.Color(0x07120f)
    this.scene.fog = new THREE.FogExp2(0x08130f, 0.01)
    this.camera = new THREE.PerspectiveCamera(CAMERA_FOV, 1, 0.1, 200)

    this.table = createTable(rows, cols)
    this.scene.add(this.table.group)

    const pmrem = new THREE.PMREMGenerator(this.renderer)
    const room = new RoomEnvironment()
    this.environmentTexture = pmrem.fromScene(room, 0.04).texture
    this.scene.environment = this.environmentTexture
    room.dispose()
    pmrem.dispose()

    this.hemisphere = new THREE.HemisphereLight(0xfff6e9, 0xb8a88e, 0.55)
    this.scene.add(this.hemisphere)

    this.keyLight = new THREE.DirectionalLight(0xfff1dc, 1.55)
    this.keyLight.position.set(-4, 18, 8)
    this.keyLight.castShadow = true
    this.keyLight.shadow.mapSize.set(2048, 2048)
    this.keyLight.shadow.camera.near = 1
    this.keyLight.shadow.camera.far = 60
    this.keyLight.shadow.bias = -0.0005
    this.keyLight.shadow.normalBias = 0.02
    this.scene.add(this.keyLight)
    this.scene.add(this.keyLight.target)

    const fill = new THREE.DirectionalLight(0xd8e2ef, 0.28)
    fill.position.set(7, 7, 12)
    this.scene.add(fill)
    this.fillLight = fill

    this.tileFactory = new TileFactory(this.renderer)

    this.haloTexture = createHaloTexture()
    this.selectionHalo = new THREE.Mesh(
      new THREE.PlaneGeometry(1.3, 1.58),
      new THREE.MeshBasicMaterial({
        map: this.haloTexture,
        transparent: true,
        opacity: 1,
        depthWrite: false,
      }),
    )
    this.selectionHalo.rotation.x = -Math.PI / 2
    this.selectionHalo.position.y = 0.012
    this.selectionHalo.visible = false
    this.scene.add(this.selectionHalo)

    this.partnerHaloGeometry = new THREE.PlaneGeometry(1.18, 1.44)
    this.partnerHaloMaterial = new THREE.MeshBasicMaterial({
      map: this.haloTexture,
      transparent: true,
      opacity: 0.42,
      depthWrite: false,
    })

    this.choiceHaloGeometry = new THREE.PlaneGeometry(1.24, 1.5)
    const choiceTexture = createChoiceHaloTexture()
    this.choiceHaloMaterial = new THREE.MeshBasicMaterial({
      map: choiceTexture,
      transparent: true,
      opacity: 0.96,
      depthWrite: false,
      depthTest: false,
    })

    this.dragPartnerMarker = this.createMarker()
    this.dragPartnerMarker.visible = false
    this.scene.add(this.dragPartnerMarker)

    this.ghostGeometry = new THREE.PlaneGeometry(CELL_W * 0.9, CELL_D * 0.9)
    this.ghostGeometry.rotateX(-Math.PI / 2)
    this.ghostMaterial = new THREE.MeshBasicMaterial({
      color: 0xd9b36c,
      transparent: true,
      opacity: 0.22,
      depthWrite: false,
      side: THREE.DoubleSide,
    })
    this.ghostGroup.position.y = 0.018
    this.scene.add(this.ghostGroup)

    this.particles = new ParticleBurst(this.scene)

    this.resizeObserver = new ResizeObserver(() => this.resize())
    this.resizeObserver.observe(container)
    this.resize()
    this.setQuality('auto')
    this.setMotion('auto')
    this.bindEvents()
  }

  start(): void {
    if (this.animationFrame !== 0) return
    const tick = (): void => {
      if (this.disposed) return
      this.animationFrame = requestAnimationFrame(tick)
      const dt = Math.min(this.clock.getDelta(), 0.05)
      this.tweens.update(dt)
      this.particles.update(dt)
      this.recordFrame(dt)
      this.animateAmbient()
      this.renderer.render(this.scene, this.camera)
    }
    this.animationFrame = requestAnimationFrame(tick)
  }

  setQuality(quality: RenderQuality): void {
    this.quality = quality
    if (quality === 'auto') this.autoDowngraded = false
    this.applyQuality()
  }

  setMotion(motion: MotionSetting): void {
    const systemReduced =
      motion === 'auto' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    this.reducedMotion = motion === 'reduced' || systemReduced
  }

  setLighting(settings: LightingSettings): void {
    const intensity = clamp(settings.intensity, 0.35, 1.8)
    const temperature = clamp(settings.temperature, 2700, 6500)
    const roughness = clamp(settings.roughness, 0.18, 0.95)
    const reflectivity = clamp(settings.reflectivity, 0, 1.2)

    this.keyLight.intensity = 1.55 * intensity
    this.fillLight.intensity = 0.28 * intensity
    this.hemisphere.intensity = 0.55 * intensity
    // The printed face is lit, but a wider exposure range is needed so the
    // slider has a clearly visible effect on the near-white paper texture.
    this.renderer.toneMappingExposure =
      0.55 + 0.4 * clamp((intensity - 0.35) / 1.45, 0, 1)

    this.keyLight.color.copy(kelvinToColor(temperature))
    this.fillLight.color.copy(kelvinToColor(Math.min(9000, temperature + 1600)))
    this.hemisphere.color.copy(kelvinToColor(temperature + 300))

    const material = this.tileFactory.getBodyMaterial()
    material.roughness = roughness
    material.envMapIntensity = reflectivity
    material.clearcoat = 0.02 + reflectivity * 0.75
    material.clearcoatRoughness = 0.08 + roughness * 0.5
    material.needsUpdate = true
    this.tileFactory.setFaceAppearance(roughness, reflectivity, intensity)
  }

  getLightingState(): {
    keyIntensity: number
    exposure: number
    bodyRoughness: number
    bodyEnvMapIntensity: number
    face: { type: string; roughness: number; envMapIntensity: number } | null
  } {
    return {
      keyIntensity: this.keyLight.intensity,
      exposure: this.renderer.toneMappingExposure,
      bodyRoughness: this.tileFactory.getBodyMaterial().roughness,
      bodyEnvMapIntensity: this.tileFactory.getBodyMaterial().envMapIntensity,
      face: this.tileFactory.getFaceMaterialState(),
    }
  }

  setTuning(tuning: RenderTuning): void {
    this.renderer.toneMappingExposure = tuning.exposure
    this.keyLight.intensity = tuning.keyIntensity
    this.fillLight.intensity = tuning.fillIntensity
    this.hemisphere.intensity = tuning.hemisphereIntensity
    this.keyLight.color.copy(kelvinToColor(tuning.keyTemperature))
    this.fillLight.color.copy(kelvinToColor(tuning.fillTemperature))
    this.hemisphere.color.copy(kelvinToColor(tuning.hemisphereTemperature))
    this.keyLight.position.set(tuning.keyX, tuning.keyY, tuning.keyZ)
    this.fillLight.position.set(tuning.fillX, tuning.fillY, tuning.fillZ)

    const body = this.tileFactory.getBodyMaterial()
    body.roughness = tuning.bodyRoughness
    body.metalness = tuning.bodyMetalness
    body.clearcoat = tuning.bodyClearcoat
    body.clearcoatRoughness = tuning.bodyClearcoatRoughness
    body.envMapIntensity = tuning.bodyEnvMapIntensity
    body.needsUpdate = true

    this.tileFactory.setFaceTuning({
      roughness: tuning.faceRoughness,
      clearcoat: tuning.faceClearcoat,
      clearcoatRoughness: tuning.faceClearcoatRoughness,
      envMapIntensity: tuning.faceEnvMapIntensity,
      bumpScale: tuning.faceBumpScale,
      metalness: tuning.faceInkMetalness,
    })
    this.tileFactory.setRimOpacity(tuning.rimOpacity)

    if (
      tuning.inkColor !== this.facePalette.ink ||
      tuning.redColor !== this.facePalette.red ||
      tuning.greenColor !== this.facePalette.green
    ) {
      this.facePalette = {
        ink: tuning.inkColor,
        red: tuning.redColor,
        green: tuning.greenColor,
      }
      this.tileFactory.setFacePalette(this.facePalette)
    }

    if (tuning.faceBumpScale !== this.faceHeight) {
      this.faceHeight = tuning.faceBumpScale
      this.tileFactory.setFaceHeight(this.faceHeight)
    }

    if (tuning.faceColor !== this.faceColor) {
      this.faceColor = tuning.faceColor
      this.tileFactory.setFaceColor(this.faceColor)
    }

    if (tuning.bodyColor !== this.bodyColor) {
      this.bodyColor = tuning.bodyColor
      this.tileFactory.getBodyMaterial().color.set(tuning.bodyColor)
    }

    if (tuning.wallColor !== this.wallColor) {
      this.wallColor = tuning.wallColor
      this.hemisphere.groundColor.set(tuning.wallColor)
    }
  }

  private effectiveQuality(): Exclude<RenderQuality, 'auto'> {
    if (this.quality !== 'auto') return this.quality
    return this.autoDowngraded ? 'medium' : 'high'
  }

  private applyQuality(): void {
    const effective = this.effectiveQuality()
    const dprCap = effective === 'high' ? 2 : effective === 'medium' ? 1.75 : 1.25
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, dprCap))

    const shadows = effective !== 'low'
    this.renderer.shadowMap.enabled = shadows
    this.keyLight.castShadow = shadows
    const shadowSize = effective === 'high' ? 2048 : 1024
    if (this.keyLight.shadow.mapSize.x !== shadowSize) {
      this.keyLight.shadow.mapSize.set(shadowSize, shadowSize)
      this.keyLight.shadow.map?.dispose()
      this.keyLight.shadow.map = null
    }

    this.particleCount = effective === 'high' ? 28 : effective === 'medium' ? 14 : 0
    this.particles.setCount(this.particleCount)
    this.resize()
  }

  private recordFrame(dt: number): void {
    if (this.quality !== 'auto' || this.autoDowngraded) return
    this.frameSeconds += dt
    this.frameSamples += 1
    if (this.frameSeconds < 2.5) return
    const average = this.frameSeconds / Math.max(1, this.frameSamples)
    this.frameSeconds = 0
    this.frameSamples = 0
    if (average > 0.024) {
      this.autoDowngraded = true
      this.applyQuality()
    }
  }

  setBoard(board: BoardSnapshot): void {
    this.tweens.clear()
    this.pointerDown = null
    this.drag = null
    this.resetDragVisuals()

    const ids = new Set<number>()
    for (const tile of board.cells) if (tile) ids.add(tile.id)

    for (const [id, view] of [...this.tileViews]) {
      if (!ids.has(id)) this.removeView(id, view)
    }

    for (const tile of board.cells) {
      if (!tile) continue
      const existing = this.tileViews.get(tile.id)
      if (existing && existing.tile.kindId !== tile.kindId) {
        this.removeView(tile.id, existing)
      }
      const current = this.tileViews.get(tile.id)
      if (current) {
        current.tile = { ...tile }
        current.baseX = tileX(tile.col, this.cols)
        current.baseZ = tileZ(tile.row, this.rows)
        current.group.position.set(current.baseX, TILE_H / 2, current.baseZ)
        current.group.scale.set(1, 1, 1)
        current.group.rotation.y = current.baseRotation
        continue
      }
      const group = this.tileFactory.create(tile, this.rows, this.cols)
      this.scene.add(group)
      this.tileGroups.push(group)
      this.tileViews.set(tile.id, {
        group,
        tile: { ...tile },
        baseX: group.position.x,
        baseZ: group.position.z,
        baseRotation: group.rotation.y,
      })
    }

    this.selectedId = null
    this.partnerIds = []
    this.hoverId = null
    this.hintIds = []
    this.updateSelectionVisuals()
  }

  setState(selectedId: number | null, partnerIds: number[]): void {
    this.selectedId = selectedId
    this.partnerIds = [...partnerIds]
    this.updateSelectionVisuals()
  }

  /** Screen-space center of a cell, used by automated UI checks. */
  cellToScreen(row: number, col: number): { x: number; y: number } | null {
    const point = new THREE.Vector3(
      tileX(col, this.cols),
      TILE_H,
      tileZ(row, this.rows),
    ).project(this.camera)
    const rect = this.renderer.domElement.getBoundingClientRect()
    if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) return null
    return {
      x: rect.left + ((point.x + 1) / 2) * rect.width,
      y: rect.top + ((1 - point.y) / 2) * rect.height,
    }
  }

  setInteractive(value: boolean): void {
    this.interactive = value
    if (!value) {
      this.hoverId = null
      this.pointerDown = null
    }
    this.updateSelectionVisuals()
  }

  isInteractive(): boolean {
    return this.interactive
  }

  showHint(tileIds: number[]): void {
    this.hintIds = [...tileIds]
    this.hintUntil = performance.now() + 2200
    this.updateSelectionVisuals()
  }

  /** Persistent partner highlight while the player chooses a drag target. */
  showChoice(tileIds: number[]): void {
    this.hintIds = [...tileIds]
    this.hintUntil = Number.POSITIVE_INFINITY
    this.updateChoiceMarkers(tileIds)
    this.updateSelectionVisuals()
    this.updateHintMarkers(this.hintIds)
  }

  clearChoice(): void {
    this.hintIds = []
    this.hintUntil = 0
    this.partnerIds = []
    this.updateChoiceMarkers([])
    this.updateHintMarkers([])
    this.updatePartnerMarkers([])
  }

  playAssistedMatch(
    moved: Tile[],
    pair: [Tile, Tile],
    board: BoardSnapshot,
    done: () => void,
  ): void {
    const targets: Array<{
      view: TileView
      fromX: number
      fromZ: number
      toX: number
      toZ: number
    }> = []
    for (const tile of moved) {
      const view = this.tileViews.get(tile.id)
      if (!view) continue
      targets.push({
        view,
        fromX: view.group.position.x,
        fromZ: view.group.position.z,
        toX: tileX(tile.col, this.cols),
        toZ: tileZ(tile.row, this.rows),
      })
    }

    this.clearGhosts()
    this.dragPartnerMarker.visible = false
    this.selectionHalo.visible = false

    if (targets.length === 0) {
      this.playMatch(pair, board, done)
      return
    }

    this.tweens.add({
      duration: this.reducedMotion ? 0.08 : 0.18,
      ease: (t) => 1 - Math.pow(1 - t, 3),
      onUpdate: (t) => {
        for (const target of targets) {
          target.view.group.position.x = target.fromX + (target.toX - target.fromX) * t
          target.view.group.position.z = target.fromZ + (target.toZ - target.fromZ) * t
        }
      },
      onComplete: () => {
        for (const target of targets) {
          target.view.group.position.x = target.toX
          target.view.group.position.z = target.toZ
        }
        this.playMatch(pair, board, done)
      },
    })
  }

  playMatch(pair: [Tile, Tile], board: BoardSnapshot, done: () => void): void {    const views = pair
      .map((tile) => this.tileViews.get(tile.id))
      .filter((view): view is TileView => Boolean(view))
    this.clearGhosts()
    this.dragPartnerMarker.visible = false
    this.selectionHalo.visible = false

    if (views.length === 0) {
      this.setBoard(board)
      done()
      return
    }

    const starts = views.map((view) => ({
      view,
      y: view.group.position.y,
      scale: view.group.scale.x,
      rotation: view.group.rotation.y,
    }))

    if (!this.reducedMotion && this.particleCount > 0) {
      const midX =
        (tileX(pair[0].col, this.cols) + tileX(pair[1].col, this.cols)) / 2
      const midZ =
        (tileZ(pair[0].row, this.rows) + tileZ(pair[1].row, this.rows)) / 2
      this.particles.emit(midX, TILE_H + 0.25, midZ, this.particleCount)
    }

    this.tweens.add({
      duration: this.reducedMotion ? 0.16 : 0.42,
      onUpdate: (t) => {
        for (const start of starts) {
          start.view.group.position.y = start.y + (this.reducedMotion ? 0.2 : 0.55) * t
          const scale = Math.max(0.05, start.scale * (1 - 0.82 * t))
          start.view.group.scale.setScalar(scale)
          start.view.group.rotation.y =
            start.rotation + (this.reducedMotion ? 0.1 : 0.42) * t
        }
      },
      onComplete: () => {
        for (const start of starts) {
          if (this.tileViews.has(start.view.tile.id)) {
            this.removeView(start.view.tile.id, start.view)
          }
        }
        this.setBoard(board)
        done()
      },
    })
  }

  playRevert(moved: Tile[], done: () => void): void {
    const views = moved
      .map((tile) => this.tileViews.get(tile.id))
      .filter((view): view is TileView => Boolean(view))
    this.clearGhosts()
    this.dragPartnerMarker.visible = false
    if (views.length === 0) {
      done()
      return
    }

    const starts = views.map((view) => ({
      view,
      x: view.group.position.x,
      z: view.group.position.z,
      y: view.group.position.y,
      rotation: view.group.rotation.y,
    }))

    this.tweens.add({
      duration: this.reducedMotion ? 0.12 : 0.28,
      ease: (t) => 1 - Math.pow(1 - t, 3),
      onUpdate: (t) => {
        for (const start of starts) {
          start.view.group.position.x = start.x + (start.view.baseX - start.x) * t
          start.view.group.position.z = start.z + (start.view.baseZ - start.z) * t
          start.view.group.position.y = start.y + (TILE_H / 2 - start.y) * t
          start.view.group.rotation.y = start.rotation
        }
      },
      onComplete: () => {
        for (const start of starts) {
          start.view.group.position.x = start.view.baseX
          start.view.group.position.z = start.view.baseZ
          start.view.group.position.y = TILE_H / 2
          start.view.group.rotation.y = start.view.baseRotation
        }
        done()
      },
    })
  }

  resetDrag(): void {
    this.drag = null
    this.pointerDown = null
    this.resetDragVisuals()
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    cancelAnimationFrame(this.animationFrame)
    this.animationFrame = 0
    this.unbindEvents()
    this.resizeObserver.disconnect()
    this.tweens.clear()
    for (const [id, view] of [...this.tileViews]) this.removeView(id, view)
    this.tileFactory.dispose()
    this.table.dispose()
    this.environmentTexture.dispose()
    this.keyLight.shadow.map?.dispose()
    this.selectionHalo.geometry.dispose()
    ;(this.selectionHalo.material as THREE.Material).dispose()
    this.haloTexture.dispose()
    this.partnerHaloGeometry.dispose()
    this.partnerHaloMaterial.dispose()
    this.choiceHaloGeometry.dispose()
    this.choiceHaloMaterial.map?.dispose()
    this.choiceHaloMaterial.dispose()
    for (const halo of this.choiceHalos) this.scene.remove(halo)
    this.dragPartnerMarker.geometry.dispose()
    ;(this.dragPartnerMarker.material as THREE.Material).dispose()
    this.ghostGeometry.dispose()
    this.ghostMaterial.dispose()
    this.particles.dispose()
    for (const marker of [...this.partnerMarkers, ...this.hintMarkers]) {
      marker.geometry.dispose()
      ;(marker.material as THREE.Material).dispose()
    }
    this.renderer.dispose()
    this.renderer.domElement.remove()
  }

  private bindEvents(): void {
    const canvas = this.renderer.domElement
    canvas.addEventListener('pointerdown', this.onPointerDown)
    canvas.addEventListener('pointermove', this.onPointerMove)
    canvas.addEventListener('pointerup', this.onPointerUp)
    canvas.addEventListener('pointercancel', this.onPointerCancel)
    canvas.addEventListener('contextmenu', this.onContextMenu)
  }

  private unbindEvents(): void {
    const canvas = this.renderer.domElement
    canvas.removeEventListener('pointerdown', this.onPointerDown)
    canvas.removeEventListener('pointermove', this.onPointerMove)
    canvas.removeEventListener('pointerup', this.onPointerUp)
    canvas.removeEventListener('pointercancel', this.onPointerCancel)
    canvas.removeEventListener('contextmenu', this.onContextMenu)
  }

  private readonly onContextMenu = (event: Event): void => {
    event.preventDefault()
  }

  private readonly onPointerDown = (event: PointerEvent): void => {
    if (!this.interactive || this.pointerDown || this.drag) return
    if (event.button !== 0 && event.pointerType === 'mouse') return
    const hit = this.pickTile(event)
    event.preventDefault()
    this.pointerDown = {
      tileId: hit?.tile.id ?? -1,
      row: hit?.tile.row ?? -1,
      col: hit?.tile.col ?? -1,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
    }
    this.renderer.domElement.setPointerCapture(event.pointerId)
    this.hoverId = hit?.tile.id ?? null
    this.updateSelectionVisuals()
  }

  private readonly onPointerMove = (event: PointerEvent): void => {
    if (this.drag) {
      this.updateDragFromPointer(event)
      return
    }

    const down = this.pointerDown
    if (!down) {
      if (!this.interactive) return
      const hit = this.pickTile(event)
      const nextHover = hit?.tile.id ?? null
      if (nextHover !== this.hoverId) {
        this.hoverId = nextHover
        this.renderer.domElement.style.cursor = hit ? 'pointer' : 'default'
        this.updateSelectionVisuals()
      }
      return
    }

    if (down.tileId < 0) return

    const dx = event.clientX - down.startX
    const dy = event.clientY - down.startY
    if (Math.hypot(dx, dy) < DRAG_THRESHOLD) return

    const horizontal = Math.abs(dx) >= Math.abs(dy)
    const dir: Dir = horizontal ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up'
    const info = this.callbacks.onDragStart(down.tileId, down.row, down.col, dir)
    if (!info) {
      this.pointerDown = null
      return
    }

    this.drag = {
      tileId: down.tileId,
      row: down.row,
      col: down.col,
      dir,
      ranges: info.ranges,
      segmentIds: info.segmentIds,
      k: 0,
    }
    this.pointerDown = null
    this.beginDragVisuals(info.segmentIds)
    this.updateDragFromPointer(event)
  }

  private readonly onPointerUp = (event: PointerEvent): void => {
    const canvas = this.renderer.domElement
    if (canvas.hasPointerCapture(event.pointerId)) {
      canvas.releasePointerCapture(event.pointerId)
    }

    if (this.drag) {
      const drag = this.drag
      this.drag = null
      if (drag.k > 0) {
        this.callbacks.onDragEnd(drag.tileId, drag.dir, drag.k)
      } else {
        this.resetDragVisuals()
        this.callbacks.onTap(drag.tileId, drag.row, drag.col)
      }
      return
    }

    if (this.pointerDown) {
      const down = this.pointerDown
      this.pointerDown = null
      this.callbacks.onTap(down.tileId, down.row, down.col)
    }
  }

  private readonly onPointerCancel = (): void => {
    this.pointerDown = null
    if (this.drag) {
      this.drag = null
      this.callbacks.onDragCancel()
      this.resetDragVisuals()
    }
  }

  private updateDragFromPointer(event: PointerEvent): void {
    const drag = this.drag
    if (!drag) return
    const planePoint = this.pointerToBoardPlane(event)
    if (!planePoint) return

    const sign = drag.dir === 'right' || drag.dir === 'down' ? 1 : -1
    const start = drag.dir === 'left' || drag.dir === 'right' ? drag.col : drag.row
    const current =
      drag.dir === 'left' || drag.dir === 'right'
        ? planePoint.x / CELL_W + (this.cols - 1) / 2
        : planePoint.z / CELL_D + (this.rows - 1) / 2
    const raw = Math.round((current - start) * sign)
    const k = Math.max(0, Math.min(drag.ranges[drag.dir], raw))
    if (k === drag.k && this.ghosts.length > 0) return
    drag.k = k

    if (k === 0) {
      this.resetSegmentVisuals(drag.segmentIds)
      this.clearGhosts()
      this.dragPartnerMarker.visible = false
      return
    }

    const info = this.callbacks.onDragMove(drag.tileId, drag.dir, k)
    if (!info) {
      drag.k = 0
      this.resetSegmentVisuals(drag.segmentIds)
      this.clearGhosts()
      this.dragPartnerMarker.visible = false
      return
    }

    drag.k = info.k
    this.positionSegment(info)
    this.setGhosts(info.targetCells)
    const partner = info.partnerId !== null ? this.tileViews.get(info.partnerId) : null
    if (partner) {
      this.dragPartnerMarker.visible = true
      this.dragPartnerMarker.position.set(
        partner.group.position.x,
        TILE_H + 0.34,
        partner.group.position.z,
      )
    } else {
      this.dragPartnerMarker.visible = false
    }
  }

  private beginDragVisuals(segmentIds: number[]): void {
    this.selectionHalo.visible = false
    for (const id of segmentIds) {
      const view = this.tileViews.get(id)
      if (!view) continue
      view.group.position.y = TILE_H / 2 + 0.12
    }
    this.updatePartnerMarkers([])
  }

  private positionSegment(info: DragPreviewInfo): void {
    info.movedIds.forEach((id, index) => {
      const view = this.tileViews.get(id)
      const cell = info.targetCells[index]
      if (!view || !cell) return
      view.group.position.x = tileX(cell.col, this.cols)
      view.group.position.z = tileZ(cell.row, this.rows)
      view.group.position.y = TILE_H / 2 + 0.12
    })
  }

  private resetSegmentVisuals(segmentIds: number[]): void {
    for (const id of segmentIds) {
      const view = this.tileViews.get(id)
      if (!view) continue
      view.group.position.x = view.baseX
      view.group.position.z = view.baseZ
      view.group.position.y = TILE_H / 2 + 0.12
    }
  }

  private resetDragVisuals(): void {
    for (const view of this.tileViews.values()) {
      view.group.position.x = view.baseX
      view.group.position.z = view.baseZ
      view.group.position.y = TILE_H / 2
    }
    this.clearGhosts()
    this.dragPartnerMarker.visible = false
    this.updateSelectionVisuals()
  }

  private setGhosts(cells: Array<{ row: number; col: number }>): void {
    while (this.ghosts.length < cells.length) {
      const mesh = new THREE.Mesh(this.ghostGeometry, this.ghostMaterial)
      this.ghosts.push(mesh)
      this.ghostGroup.add(mesh)
    }
    this.ghosts.forEach((mesh, index) => {
      const cell = cells[index]
      mesh.visible = Boolean(cell)
      if (cell) {
        mesh.position.set(tileX(cell.col, this.cols), 0, tileZ(cell.row, this.rows))
      }
    })
  }

  private clearGhosts(): void {
    for (const mesh of this.ghosts) mesh.visible = false
  }

  private updateSelectionVisuals(): void {
    if (this.drag) return

    for (const [id, view] of this.tileViews) {
      const lift = id === this.selectedId ? 0.18 : id === this.hoverId ? 0.06 : 0
      view.group.position.y = TILE_H / 2 + lift
    }

    const selected = this.selectedId !== null ? this.tileViews.get(this.selectedId) : null
    if (selected) {
      this.selectionHalo.visible = true
      this.selectionHalo.position.set(
        selected.baseX,
        selected.group.position.y + TILE_H / 2 + 0.012,
        selected.baseZ,
      )
    } else {
      this.selectionHalo.visible = false
    }

    this.updatePartnerMarkers(this.partnerIds)
    this.updateHintMarkers(this.hintIds)
  }

  private updatePartnerMarkers(ids: number[]): void {
    while (this.partnerMarkers.length < ids.length) {
      const marker = this.createMarker()
      this.partnerMarkers.push(marker)
      this.scene.add(marker)
    }
    while (this.partnerHalos.length < ids.length) {
      const halo = new THREE.Mesh(this.partnerHaloGeometry, this.partnerHaloMaterial)
      halo.rotation.x = -Math.PI / 2
      halo.position.y = 0.011
      this.partnerHalos.push(halo)
      this.scene.add(halo)
    }
    this.partnerMarkers.forEach((marker, index) => {
      const view = ids[index] !== undefined ? this.tileViews.get(ids[index]) : undefined
      marker.visible = Boolean(view)
      if (view) {
        marker.position.set(
          view.baseX,
          view.group.position.y + TILE_H / 2 + 0.24,
          view.baseZ,
        )
        marker.userData.baseY = marker.position.y
      }
    })
    this.partnerHalos.forEach((halo, index) => {
      const view = ids[index] !== undefined ? this.tileViews.get(ids[index]) : undefined
      halo.visible = Boolean(view)
      if (view) {
        halo.position.set(
          view.baseX,
          view.group.position.y + TILE_H / 2 + 0.01,
          view.baseZ,
        )
      }
    })
  }

  private updateHintMarkers(ids: number[]): void {
    while (this.hintMarkers.length < ids.length) {
      const marker = this.createMarker()
      this.hintMarkers.push(marker)
      this.scene.add(marker)
    }
    this.hintMarkers.forEach((marker, index) => {
      const view = ids[index] !== undefined ? this.tileViews.get(ids[index]) : undefined
      marker.visible = Boolean(view)
      if (view) marker.position.set(view.baseX, TILE_H + 0.36, view.baseZ)
    })
  }

  private updateChoiceMarkers(ids: number[]): void {
    while (this.choiceHalos.length < ids.length) {
      const halo = new THREE.Mesh(this.choiceHaloGeometry, this.choiceHaloMaterial)
      halo.rotation.x = -Math.PI / 2
      halo.position.y = 0.012
      halo.renderOrder = 20
      this.choiceHalos.push(halo)
      this.scene.add(halo)
    }
    this.choiceHalos.forEach((halo, index) => {
      const view = ids[index] !== undefined ? this.tileViews.get(ids[index]) : undefined
      halo.visible = Boolean(view)
      if (view) {
        halo.position.set(
          view.baseX,
          view.group.position.y + TILE_H / 2 + 0.018,
          view.baseZ,
        )
      }
    })
  }

  private createMarker(): THREE.Mesh {
    return new THREE.Mesh(
      new THREE.OctahedronGeometry(0.1, 0),
      new THREE.MeshBasicMaterial({ color: 0xffd27a, transparent: true, opacity: 0.95 }),
    )
  }

  private animateAmbient(): void {
    const now = performance.now()

    if (this.reducedMotion) {
      this.selectionHalo.scale.setScalar(1)
      this.partnerMarkers.forEach((marker) => {
        if (!marker.visible) return
        const baseY = marker.userData.baseY
        if (typeof baseY === 'number') marker.position.y = baseY
      })
      this.hintMarkers.forEach((marker) => {
        if (marker.visible) marker.position.y = TILE_H + 0.36
      })
    } else {
      const haloScale = 1 + 0.05 * Math.sin(now * 0.004)
      this.selectionHalo.scale.setScalar(haloScale)

      this.partnerMarkers.forEach((marker, index) => {
        if (!marker.visible) return
        const baseY = marker.userData.baseY ?? marker.position.y
        marker.position.y = baseY + Math.sin(now * 0.004 + index) * 0.03
        marker.rotation.y += 0.02
      })

      this.hintMarkers.forEach((marker, index) => {
        if (!marker.visible) return
        marker.position.y = TILE_H + 0.36 + Math.sin(now * 0.005 + index) * 0.04
        marker.rotation.y += 0.03
      })
    }

    if (this.hintIds.length > 0 && now > this.hintUntil) {
      this.hintIds = []
      this.updateHintMarkers([])
    }
  }

  private pickTile(event: PointerEvent): TileView | null {
    const rect = this.renderer.domElement.getBoundingClientRect()
    this.pointerNdc.set(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1,
    )
    this.raycaster.setFromCamera(this.pointerNdc, this.camera)
    const hits = this.raycaster.intersectObjects(this.tileGroups, true)
    for (const hit of hits) {
      let object: THREE.Object3D | null = hit.object
      while (object) {
        const id = object.userData.tileId
        if (typeof id === 'number') {
          return this.tileViews.get(id) ?? null
        }
        object = object.parent
      }
    }
    return null
  }

  private pointerToBoardPlane(event: PointerEvent): THREE.Vector3 | null {
    const rect = this.renderer.domElement.getBoundingClientRect()
    this.pointerNdc.set(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1,
    )
    this.raycaster.setFromCamera(this.pointerNdc, this.camera)
    const point = this.raycaster.ray.intersectPlane(this.boardPlane, this.groundPoint)
    return point ? this.groundPoint.clone() : null
  }

  private removeView(id: number, view: TileView): void {
    this.scene.remove(view.group)
    this.tileViews.delete(id)
    const index = this.tileGroups.indexOf(view.group)
    if (index >= 0) this.tileGroups.splice(index, 1)
  }

  private resize(): void {
    const width = Math.max(1, this.container.clientWidth)
    const height = Math.max(1, this.container.clientHeight)
    this.renderer.setSize(width, height, false)
    this.camera.aspect = width / height
    this.camera.updateProjectionMatrix()
    this.fitCamera()
  }

  private fitCamera(): void {
    const { width, depth } = boardDimensions(this.rows, this.cols)
    const target = new THREE.Vector3(0, 0.25, 0.35)
    const corners: THREE.Vector3[] = []
    for (const x of [-width / 2, width / 2]) {
      for (const z of [-depth / 2, depth / 2]) {
        corners.push(new THREE.Vector3(x, 0, z))
        corners.push(new THREE.Vector3(x, TILE_H, z))
      }
    }

    const fitNdc = 0.78
    const projected = new THREE.Vector3()
    let low = 4
    let high = 200
    for (let iteration = 0; iteration < 28; iteration += 1) {
      const distance = (low + high) / 2
      this.camera.position.set(
        0,
        distance * Math.sin(CAMERA_PITCH),
        distance * Math.cos(CAMERA_PITCH),
      )
      this.camera.lookAt(target)
      this.camera.updateMatrixWorld(true)

      let maxNdc = 0
      for (const corner of corners) {
        projected.copy(corner).project(this.camera)
        maxNdc = Math.max(maxNdc, Math.abs(projected.x), Math.abs(projected.y))
      }
      if (maxNdc > fitNdc) low = distance
      else high = distance
    }

    const distance = high
    this.camera.position.set(
      0,
      distance * Math.sin(CAMERA_PITCH),
      distance * Math.cos(CAMERA_PITCH),
    )
    this.camera.lookAt(target)
    this.camera.updateMatrixWorld(true)

    const shadowRadius = Math.max(width, depth) / 2 + 2
    const shadowCamera = this.keyLight.shadow.camera
    shadowCamera.left = -shadowRadius
    shadowCamera.right = shadowRadius
    shadowCamera.top = shadowRadius
    shadowCamera.bottom = -shadowRadius
    shadowCamera.updateProjectionMatrix()
  }
}
