/** M1 scene: table, lighting, camera fit and a first 3D tile. */
import * as THREE from 'three'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'
import { boardDimensions, TILE_H } from './layout'
import { createTable, type TableObjects } from './table'
import { TileFactory } from './tileFactory'

const CAMERA_FOV = 34
const CAMERA_PITCH = THREE.MathUtils.degToRad(60)
const FIT_MARGIN = 1.14

export class GameRenderer {
  private readonly container: HTMLElement
  private readonly renderer: THREE.WebGLRenderer
  private readonly scene = new THREE.Scene()
  private readonly camera: THREE.PerspectiveCamera
  private readonly table: TableObjects
  private readonly tiles: TileFactory
  private readonly resizeObserver: ResizeObserver
  private readonly environmentTexture: THREE.Texture
  private readonly keyLight: THREE.DirectionalLight
  private animationFrame = 0
  private disposed = false
  private readonly clock = new THREE.Clock()

  constructor(container: HTMLElement, rows = 8, cols = 9) {
    this.container = container
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
    })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.02
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap
    this.renderer.domElement.className = 'board-canvas'
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

    const hemi = new THREE.HemisphereLight(0xfff3dd, 0x0a241e, 0.55)
    this.scene.add(hemi)

    this.keyLight = new THREE.DirectionalLight(0xffe9c9, 2.1)
    this.keyLight.position.set(-8, 16, 10)
    this.keyLight.castShadow = true
    this.keyLight.shadow.mapSize.set(2048, 2048)
    this.keyLight.shadow.camera.near = 1
    this.keyLight.shadow.camera.far = 60
    this.keyLight.shadow.bias = -0.0005
    this.keyLight.shadow.normalBias = 0.02
    this.scene.add(this.keyLight)
    this.scene.add(this.keyLight.target)

    const fill = new THREE.DirectionalLight(0x8fc7ff, 0.35)
    fill.position.set(9, 8, -8)
    this.scene.add(fill)

    this.tiles = new TileFactory(this.renderer)
    const { cells } = this.createStarterTile(rows, cols)
    for (const tile of cells) {
      this.scene.add(this.tiles.create(tile, rows, cols))
    }

    this.resizeObserver = new ResizeObserver(() => this.resize())
    this.resizeObserver.observe(container)
    this.resize()
  }

  start(): void {
    if (this.animationFrame !== 0) return
    const tick = (): void => {
      if (this.disposed) return
      this.animationFrame = requestAnimationFrame(tick)
      this.clock.getDelta()
      this.renderer.render(this.scene, this.camera)
    }
    this.animationFrame = requestAnimationFrame(tick)
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    cancelAnimationFrame(this.animationFrame)
    this.animationFrame = 0
    this.resizeObserver.disconnect()
    this.scene.traverse((object) => {
      const mesh = object as THREE.Mesh
      if (mesh.isMesh) mesh.geometry?.dispose()
    })
    this.tiles.dispose()
    this.table.dispose()
    this.environmentTexture.dispose()
    this.keyLight.shadow.map?.dispose()
    this.renderer.dispose()
    this.renderer.domElement.remove()
  }

  private createStarterTile(rows: number, cols: number) {
    const row = Math.floor(rows / 2)
    const col = Math.floor(cols / 2)
    return {
      cells: [
        {
          id: 1,
          kindId: 'pin-1',
          row,
          col,
        },
      ],
    }
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
    const rows = 8
    const cols = 9
    const { width, depth } = boardDimensions(rows, cols)
    const radius = 0.5 * Math.hypot(width, depth) + TILE_H
    const fovY = THREE.MathUtils.degToRad(this.camera.fov)
    const fovX = 2 * Math.atan(Math.tan(fovY / 2) * this.camera.aspect)
    const fitFov = Math.min(fovY, fovX)
    const distance = (radius / Math.sin(fitFov / 2)) * FIT_MARGIN
    const pitch = CAMERA_PITCH
    this.camera.position.set(
      0,
      distance * Math.sin(pitch),
      distance * Math.cos(pitch),
    )
    this.camera.lookAt(0, 0.4, 0.6)
    this.camera.updateProjectionMatrix()

    const shadowRadius = Math.max(width, depth) / 2 + 2
    const shadowCamera = this.keyLight.shadow.camera
    shadowCamera.left = -shadowRadius
    shadowCamera.right = shadowRadius
    shadowCamera.top = shadowRadius
    shadowCamera.bottom = -shadowRadius
    shadowCamera.updateProjectionMatrix()
  }
}
