/**
 * EnvironmentManager.js — Single Source of Truth for Sun
 *
 * Điều phối SkySystem, OceanSystem, AtmosphereSystem và DirectionalLight.
 * Một nguồn sự thật duy nhất cho mặt trời:
 *   SkySystem.sunPosition
 *       -> DirectionalLight.position
 *       -> OceanSystem.water.material.uniforms.sunDirection
 *       -> scene.environment / PMREM nếu dùng
 *
 * Public API:
 *   EnvironmentManager.init({ scene, renderer, sceneManager })
 *   EnvironmentManager.update(deltaTime)
 *   EnvironmentManager.setTimeOfDay({ elevation, azimuth })  // degrees
 *   EnvironmentManager.getSunDirection() → THREE.Vector3
 *   EnvironmentManager.getSunPosition() → THREE.Vector3
 *   EnvironmentManager.getWaterMesh() → THREE.Object3D
 *   EnvironmentManager.dispose()
 */

import * as THREE from 'three'
import { SkySystem } from './SkySystem.js'
import { OceanSystem } from './OceanSystem.js'
import { AtmosphereSystem } from './AtmosphereSystem.js'

let scene = null
let renderer = null
let sceneManager = null
let directionalLight = null
let pmremGenerator = null
let isInitialized = false

const SUN_CONFIG = {
  elevation: 8,   // degrees - mặt trời low-angle cho dramatic coastal
  azimuth: 145,    // degrees - hướng đẹp
}

const EnvironmentManager = {
  /**
   * @param {{ scene: THREE.Scene, renderer: THREE.WebGLRenderer, sceneManager: object }} options
   */
  init({ scene: sceneRef, renderer: rendererRef, sceneManager: sm }) {
    scene = sceneRef
    renderer = rendererRef
    sceneManager = sm

    // 1. Init AtmosphereSystem (fog) trước — Sky/Ocean dùng fog reference
    const fog = AtmosphereSystem.init(scene)

    // 2. Init SkySystem
    SkySystem.init(scene)

    // 3. Init OceanSystem với sun direction từ SkySystem
    // NOTE: OceanSystem.init là async vì load texture
    // Chờ nó xong trong bootstrap
    console.log('[EnvironmentManager] Sky & Atmosphere initialized, Ocean pending texture load')

    // 4. Sync DirectionalLight với Sky sun position
    _setupDirectionalLight()

    // 5. PMREMGenerator cho scene.environment (nếu cần)
    _setupPMREM()

    isInitialized = true
    console.log('[EnvironmentManager] Initialized')
  },

  /**
   * Async init cho OceanSystem — gọi sau khi texture loaded.
   * @returns {Promise<THREE.Object3D>}
   */
  async initOcean() {
    const sunDir = SkySystem.getSunDirection()
    const fog = AtmosphereSystem.getFog()
    const waterMesh = await OceanSystem.init(scene, sunDir, fog)
    return waterMesh
  },

  /**
   * Update mỗi frame — sync sun direction cho all systems.
   * @param {number} deltaTime
   */
  update(deltaTime) {
    if (!isInitialized) return

    // Update Ocean time uniform
    OceanSystem.update(deltaTime)

    // Sync sun direction nếu cần (trường hợp sun position thay đổi)
    const sunDir = SkySystem.getSunDirection()
    OceanSystem.syncSunDirection(sunDir)
  },

  /**
   * Cập nhật vị trí mặt trời
   * @param {{ elevation: number, azimuth: number }} options - degrees
   */
  setTimeOfDay({ elevation, azimuth }) {
    if (elevation !== undefined) SUN_CONFIG.elevation = elevation
    if (azimuth !== undefined) SUN_CONFIG.azimuth = azimuth

    // Update SkySystem
    SkySystem.updateSun(SUN_CONFIG.elevation, SUN_CONFIG.azimuth)

    // Sync DirectionalLight
    _syncLightToSun()

    // Sync Ocean
    const sunDir = SkySystem.getSunDirection()
    OceanSystem.syncSunDirection(sunDir)

    // Update PMREM environment
    _updateEnvironment()
  },

  /** @returns {THREE.Vector3} sun direction (normalized) */
  getSunDirection() {
    return SkySystem.getSunDirection()
  },

  /** @returns {THREE.Vector3} sun world position */
  getSunPosition() {
    return SkySystem.getSunPosition()
  },

  /** @returns {THREE.Object3D|null} water mesh */
  getWaterMesh() {
    return OceanSystem.getMesh()
  },

  /** @returns {boolean} */
  isReady() {
    return isInitialized && OceanSystem.getMesh() !== null
  },

  dispose() {
    SkySystem.dispose()
    OceanSystem.dispose()
    AtmosphereSystem.dispose()
    if (pmremGenerator) {
      pmremGenerator.dispose()
      pmremGenerator = null
    }
    directionalLight = null
    scene = null
    renderer = null
    sceneManager = null
    isInitialized = false
    console.log('[EnvironmentManager] Disposed')
  },
}

/**
 * Setup DirectionalLight để thấy shadow trên buildings.
 */
function _setupDirectionalLight() {
  // Tìm hoặc tạo DirectionalLight trong scene
  directionalLight = scene.children.find(
    (child) => child.isDirectionalLight
  )

  if (!directionalLight) {
    directionalLight = new THREE.DirectionalLight(0xffffff, 1.5)
    directionalLight.castShadow = true
    directionalLight.shadow.mapSize.width = 2048
    directionalLight.shadow.mapSize.height = 2048
    directionalLight.shadow.camera.near = 0.5
    directionalLight.shadow.camera.far = 100
    directionalLight.shadow.camera.left = -25
    directionalLight.shadow.camera.right = 25
    directionalLight.shadow.camera.top = 25
    directionalLight.shadow.camera.bottom = -25
    directionalLight.shadow.bias = -0.001
    scene.add(directionalLight)
  }

  _syncLightToSun()
}

/**
 * Sync DirectionalLight position với sun position từ SkySystem.
 */
function _syncLightToSun() {
  if (!directionalLight) return

  const sunPos = SkySystem.getSunPosition()
  directionalLight.position.copy(sunPos)

  // Light color: warm golden hour tone
  const sunElevation = SUN_CONFIG.elevation
  if (sunElevation < 15) {
    // Golden hour - warm orange
    directionalLight.color.setHex(0xffd4a6)
    directionalLight.intensity = 1.8
  } else if (sunElevation < 30) {
    // Morning/afternoon - warm white
    directionalLight.color.setHex(0xfff0d6)
    directionalLight.intensity = 1.6
  } else {
    // Midday - neutral white
    directionalLight.color.setHex(0xfff8f0)
    directionalLight.intensity = 1.5
  }
}

/**
 * Setup PMREMGenerator để tạo environment map từ Sky.
 * Dùng cho reflective materials trên buildings.
 */
function _setupPMREM() {
  if (!renderer || !scene) return

  try {
    pmremGenerator = new THREE.PMREMGenerator(renderer)
    pmremGenerator.compileEquirectangularShader()
    _updateEnvironment()
    console.log('[EnvironmentManager] PMREMGenerator initialized')
  } catch (err) {
    console.warn('[EnvironmentManager] PMREMGenerator failed:', err)
    pmremGenerator = null
  }
}

/**
 * Update scene.environment từ sky.
 */
function _updateEnvironment() {
  if (!pmremGenerator || !scene || !renderer) return

  try {
    // Sky addon không có renderTarget đơn giản như vậy
    // Tạm thời skip PMREM, dùng DirectionalLight thuần
    // Future: có thể render sky vào CubeCamera để tạo env map
    // scene.environment = pmremGenerator.fromScene(scene).texture
    console.log('[EnvironmentManager] Environment update skipped (Sky lacks render target)')
  } catch (err) {
    console.warn('[EnvironmentManager] Environment update failed:', err)
  }
}

export { EnvironmentManager, SUN_CONFIG }
