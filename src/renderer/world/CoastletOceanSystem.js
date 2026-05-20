/**
 * CoastletOceanSystem.js — Ocean Surface + Volume System
 *
 * Ocean gồm 2 mesh:
 * 1. oceanSurface: flat plane ở seaLevel
 * 2. oceanVolume: box dưới mặt nước (underwater fog)
 *
 * Ocean đi theo camera trên XZ để tránh float precision issue.
 *
 * Public API:
 *   CoastletOceanSystem.init({ scene, camera, seaLevel, skyboxSystem })
 *   CoastletOceanSystem.update(deltaTime)
 *   CoastletOceanSystem.setLightDirection(dir)
 *   CoastletOceanSystem.setLightColor(color)
 *   CoastletOceanSystem.getSurface() → THREE.Object3D
 *   CoastletOceanSystem.dispose()
 */

import * as THREE from 'three'
import { CoastletOceanMaterial } from './CoastletOceanMaterial.js'

let scene = null
let camera = null
let seaLevel = -0.03
let skyboxSystem = null

let oceanRoot = null
let oceanSurface = null
let oceanVolume = null
let surfaceMaterial = null
let volumeMaterial = null

let elapsedTime = 0
let isInitialized = false

const HALF_SIZE = 2000
const VOLUME_DEPTH = 500

const CoastletOceanSystem = {
  /**
   * @param {{ scene: THREE.Scene, camera: THREE.Camera, seaLevel: number, skyboxSystem: object }} options
   */
  init({ scene: sceneRef, camera: cameraRef, seaLevel: seaLevelRef, skyboxSystem: skyboxRef }) {
    scene = sceneRef
    camera = cameraRef
    seaLevel = seaLevelRef ?? -0.03
    skyboxSystem = skyboxRef

    // Load textures first
    CoastletOceanMaterial.loadTextures().then(() => {
      _createOcean()
      isInitialized = true
      console.log('[CoastletOceanSystem] Initialized with normal maps')
    })

    console.log('[CoastletOceanSystem] Loading textures...')
  },

  /**
   * Update every frame
   * @param {number} deltaTime
   */
  update(deltaTime) {
    if (!isInitialized || !oceanRoot) return

    elapsedTime += deltaTime

    // Update time uniform
    if (surfaceMaterial) {
      surfaceMaterial.uniforms._Time.value = elapsedTime
    }

    // Ocean follows camera on XZ
    oceanRoot.position.set(camera.position.x, seaLevel, camera.position.z)

    // Sync light from skybox
    if (skyboxSystem) {
      const lightDir = skyboxSystem.getLightDirection()
      const lightColor = skyboxSystem.getLightColor()
      this.setLightDirection(lightDir)
      this.setLightColor(lightColor)
    }
  },

  /**
   * @param {THREE.Vector3} dir
   */
  setLightDirection(dir) {
    if (surfaceMaterial) {
      surfaceMaterial.uniforms._DirToLight.value.copy(dir)
    }
    if (volumeMaterial) {
      volumeMaterial.uniforms._DirToLight.value.copy(dir)
    }
  },

  /**
   * @param {THREE.Color} color
   */
  setLightColor(color) {
    if (surfaceMaterial) {
      surfaceMaterial.uniforms._Light.value.copy(color)
    }
    if (volumeMaterial) {
      volumeMaterial.uniforms._Light.value.copy(color)
    }
  },

  /**
   * @returns {THREE.Object3D|null}
   */
  getSurface() {
    return oceanSurface
  },

  /**
   * @returns {boolean}
   */
  isReady() {
    return isInitialized
  },

  dispose() {
    if (oceanSurface) {
      scene.remove(oceanSurface)
      oceanSurface.geometry?.dispose()
      oceanSurface.material?.dispose()
    }
    if (oceanVolume) {
      scene.remove(oceanVolume)
      oceanVolume.geometry?.dispose()
      oceanVolume.material?.dispose()
    }
    if (oceanRoot) {
      scene.remove(oceanRoot)
    }
    oceanRoot = null
    oceanSurface = null
    oceanVolume = null
    surfaceMaterial = null
    volumeMaterial = null
    isInitialized = false
    scene = null
    camera = null
    console.log('[CoastletOceanSystem] Disposed')
  },
}

/**
 * Create ocean surface + volume meshes
 */
function _createOcean() {
  // Root group
  oceanRoot = new THREE.Group()
  oceanRoot.name = 'oceanRoot'
  oceanRoot.position.set(camera.position.x, seaLevel, camera.position.z)
  scene.add(oceanRoot)

  // === Surface ===
  // Surface: 4 vertices, 2 triangles (ultra lightweight)
  const surfaceVertices = new Float32Array([
    -HALF_SIZE, 0, -HALF_SIZE,
    HALF_SIZE, 0, -HALF_SIZE,
    -HALF_SIZE, 0, HALF_SIZE,
    HALF_SIZE, 0, HALF_SIZE,
  ])

  const surfaceIndices = [2, 3, 0, 3, 1, 0]

  const surfaceGeometry = new THREE.BufferGeometry()
  surfaceGeometry.setAttribute('position', new THREE.BufferAttribute(surfaceVertices, 3))
  surfaceGeometry.setIndex(surfaceIndices)

  surfaceMaterial = CoastletOceanMaterial.createSurface()
  oceanSurface = new THREE.Mesh(surfaceGeometry, surfaceMaterial)
  oceanSurface.name = 'oceanSurface'
  oceanSurface.userData.ignoreRaycast = true
  oceanSurface.renderOrder = -1  // Render before buildings
  oceanRoot.add(oceanSurface)

  // === Volume ===
  // Volume: box below surface for underwater fog
  const volumeVertices = new Float32Array([
    // Bottom face
    -HALF_SIZE, -VOLUME_DEPTH, -HALF_SIZE,
    HALF_SIZE, -VOLUME_DEPTH, -HALF_SIZE,
    -HALF_SIZE, -VOLUME_DEPTH, HALF_SIZE,
    HALF_SIZE, -VOLUME_DEPTH, HALF_SIZE,
    // Top face (at surface)
    -HALF_SIZE, 0, -HALF_SIZE,
    HALF_SIZE, 0, -HALF_SIZE,
    -HALF_SIZE, 0, HALF_SIZE,
    HALF_SIZE, 0, HALF_SIZE,
  ])

  const volumeIndices = [
    2, 3, 0, 3, 1, 0,      // bottom
    0, 1, 4, 1, 5, 4,      // front
    1, 3, 5, 3, 7, 5,      // right
    3, 2, 7, 2, 6, 7,      // back
    2, 0, 6, 0, 4, 6,      // left
  ]

  const volumeGeometry = new THREE.BufferGeometry()
  volumeGeometry.setAttribute('position', new THREE.BufferAttribute(volumeVertices, 3))
  volumeGeometry.setIndex(volumeIndices)

  volumeMaterial = CoastletOceanMaterial.createVolume()
  oceanVolume = new THREE.Mesh(volumeGeometry, volumeMaterial)
  oceanVolume.name = 'oceanVolume'
  oceanVolume.userData.ignoreRaycast = true
  oceanVolume.renderOrder = -2  // Render before surface
  oceanRoot.add(oceanVolume)

  // Debug logs
  console.log('[CoastletOceanSystem] surface added:', !!oceanSurface.parent)
  console.log('[CoastletOceanSystem] normal maps:', !!surfaceMaterial?.uniforms?._NormalMap1?.value)
  console.log('[CoastletOceanSystem] time:', elapsedTime)
}

export { CoastletOceanSystem }
