/**
 * GerstnerOceanSystem.js — Professional-grade ocean with Gerstner waves
 *
 * A realistic ocean surface using 5 layers of Gerstner waves with:
 * - Sharp wave peaks (Gerstner formula)
 * - Dynamic normals from wave derivatives
 * - Fresnel reflections
 * - Depth-based water color
 * - Foam at wave crests
 * - Specular sun highlights
 * - Atmospheric fog
 *
 * Public API:
 *   GerstnerOceanSystem.init({ scene, camera, seaLevel, sunDirection })
 *   GerstnerOceanSystem.update(deltaTime)
 *   GerstnerOceanSystem.setSunDirection(dir)
 *   GerstnerOceanSystem.setSunColor(color)
 *   GerstnerOceanSystem.setSunIntensity(intensity)
 *   GerstnerOceanSystem.getSurface() → THREE.Mesh
 *   GerstnerOceanSystem.isReady() → boolean
 *   GerstnerOceanSystem.dispose()
 */

import * as THREE from 'three'
import { loadTextures as loadOceanTextures, create as createOceanMaterial } from './GerstnerOceanMaterial.js'

let scene = null
let camera = null
let seaLevel = -0.03
let sunDirection = new THREE.Vector3(0.5, 0.7, 0.4).normalize()
let sunColor = new THREE.Color(1.0, 0.98, 0.9)
let sunIntensity = 2.0

let oceanRoot = null
let oceanMesh = null
let oceanMaterial = null
let elapsedTime = 0
let isInitialized = false

// Ocean geometry parameters
const OCEAN_SIZE = 2000
const OCEAN_SEGMENTS = 256

const GerstnerOceanSystem = {
  /**
   * Initialize the ocean system
   * @param {{ scene: THREE.Scene, camera: THREE.Camera, seaLevel?: number, sunDirection?: THREE.Vector3 }} options
   */
  async init({ scene: sceneRef, camera: cameraRef, seaLevel: sl = -0.03, sunDirection: sunDir }) {
    scene = sceneRef
    camera = cameraRef
    seaLevel = sl

    if (sunDir) {
      sunDirection = sunDir.clone().normalize()
    }

    // Create root group
    oceanRoot = new THREE.Group()
    oceanRoot.name = 'gerstnerOceanRoot'
    scene.add(oceanRoot)

    // === DEBUG: Skip texture loading, use MeshBasicMaterial ===
    // Commenting out loadOceanTextures() to isolate geometry/sky issues
    // const textures = await loadOceanTextures()
    // _createOcean(textures)
    _createOcean(null)

    isInitialized = true
    console.log('[GerstnerOceanSystem] Initialized with Gerstner waves')

    return this
  },

  /**
   * Update every frame
   * @param {number} deltaTime
   */
  update(deltaTime) {
    if (!isInitialized || !oceanRoot || !oceanMaterial) return

    elapsedTime += deltaTime

    // NOTE: Shader uniform updates are skipped during debug (using MeshBasicMaterial)
    // Re-enable when switching back to createOceanMaterial()

    // Follow camera on XZ plane to avoid floating point precision issues
    oceanRoot.position.set(camera.position.x, seaLevel, camera.position.z)
  },

  /**
   * Set sun light direction
   * @param {THREE.Vector3} dir
   */
  setSunDirection(dir) {
    sunDirection = dir.clone().normalize()
  },

  /**
   * Set sun color
   * @param {THREE.Color} color
   */
  setSunColor(color) {
    sunColor = color.clone()
  },

  /**
   * Set sun intensity
   * @param {number} intensity
   */
  setSunIntensity(intensity) {
    sunIntensity = intensity
  },

  /**
   * Set sky colors for reflections
   * @param {THREE.Color} skyColor
   * @param {THREE.Color} horizonColor
   */
  setSkyColors(skyColor, horizonColor) {
    if (oceanMaterial?.uniforms) {
      oceanMaterial.uniforms.uSkyColor.value.copy(skyColor)
      oceanMaterial.uniforms.uHorizonColor.value.copy(horizonColor)
    }
  },

  /**
   * Get the ocean surface mesh
   * @returns {THREE.Mesh|null}
   */
  getSurface() {
    return oceanMesh
  },

  /**
   * Check if ocean is ready
   * @returns {boolean}
   */
  isReady() {
    return isInitialized
  },

  /**
   * Dispose of all resources
   */
  dispose() {
    if (oceanMesh) {
      scene.remove(oceanMesh)
      oceanMesh.geometry?.dispose()
      oceanMesh.material?.dispose()
      oceanMesh = null
    }

    if (oceanRoot) {
      scene.remove(oceanRoot)
      oceanRoot = null
    }

    oceanMaterial = null
    isInitialized = false
    elapsedTime = 0
    scene = null
    camera = null

    console.log('[GerstnerOceanSystem] Disposed')
  },
}

/**
 * Create the ocean mesh
 * @param {{ normalMap1, normalMap2, normalMap3 }} textures
 */
function _createOcean(textures) {
  // Create high-resolution plane geometry
  const geometry = new THREE.PlaneGeometry(
    OCEAN_SIZE,
    OCEAN_SIZE,
    OCEAN_SEGMENTS,
    OCEAN_SEGMENTS
  )

  // Rotate to be horizontal (X-Z plane)
  geometry.rotateX(-Math.PI / 2)

  // === DEBUG: Use simple MeshBasicMaterial instead of shader ===
  // If blue plane appears → geometry/camera/scene are OK, shader is the problem
  // If nothing appears → geometry/camera/scene have other issues
  oceanMaterial = new THREE.MeshBasicMaterial({
    color: 0x1e9fd0,
    side: THREE.DoubleSide,
  })
  console.log('[GerstnerOceanSystem] DEBUG: using MeshBasicMaterial instead of shader')
  console.log('[GerstnerOceanSystem] Geometry vertices:', geometry.attributes.position.count)
  console.log('[GerstnerOceanSystem] Ocean size:', OCEAN_SIZE, 'segments:', OCEAN_SEGMENTS)

  // NOTE: Skipping normal map assignment (MeshBasicMaterial has no uniforms)
  // Re-enable when switching back to createOceanMaterial()

  // Create mesh
  oceanMesh = new THREE.Mesh(geometry, oceanMaterial)
  oceanMesh.name = 'gerstnerOcean'
  oceanMesh.userData.ignoreRaycast = true
  oceanMesh.renderOrder = -5  // Render early so buildings appear on top
  oceanMesh.frustumCulled = false

  // Add to root group (centered at camera position on XZ)
  oceanRoot.add(oceanMesh)

  console.log('[GerstnerOceanSystem] Ocean mesh created with', OCEAN_SEGMENTS * OCEAN_SEGMENTS, 'vertices')
  console.log('[GerstnerOceanSystem] Normal maps assigned:', !!textures?.normalMap1, !!textures?.normalMap2, !!textures?.normalMap3)
}

export { GerstnerOceanSystem }
