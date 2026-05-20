/**
 * CoastletEnvironmentManager.js
 * Manages Nugget8 Ocean Scene skybox + ocean + build plane
 *
 * Startup order mirrors nugget-demo.js:
 * 1. Settings.Start() — inject ShaderChunk (#include overrides)
 * 2. Time.Start() — start clock + expose timeUniform
 * 3. SkyboxMaterial.Start() — init procedural textures
 * 4. Skybox.Start() — create skybox mesh
 * 5. OceanMaterial.Start() — init procedural normal maps
 * 6. Ocean.Start() — create ocean surface + volume
 * 7. SetSkyboxUniforms() — connect skybox uniforms to all materials
 * 8. Add to scene
 */
import * as THREE from 'three'
import { PostProcessing } from '../engine/PostProcessing.js'

// ===== Nugget8 Vendor Imports =====
import { Start as SettingsStart } from '../vendor/nugget8-ocean-scene/shaders/Settings.js'
import { Start as TimeStart, Update as TimeUpdate, timeUniform } from '../vendor/nugget8-ocean-scene/scripts/Time.js'
import {
  Start as SkyboxMaterialStart,
  material as skyboxMaterial,
  SetSkyboxUniforms
} from '../vendor/nugget8-ocean-scene/materials/SkyboxMaterial.js'
import {
  Start as SkyboxStart,
  Update as SkyboxUpdate,
  skybox,
  dirToLight,
  rotationMatrix,
  setCamera as setSkyboxCamera,
} from '../vendor/nugget8-ocean-scene/scene/Skybox.js'
import {
  Start as OceanMaterialsStart,
  surface as oceanSurface,
  volume as oceanVolume,
  applySkyboxUniforms,
  setCameraForward as setOceanCameraForward,
  normalMap1,
  normalMap2,
} from '../vendor/nugget8-ocean-scene/materials/OceanMaterial.js'
import {
  Start as OceanStart,
  Update as OceanUpdate,
  surface as oceanSurfaceMesh,
  setCamera as setOceanCamera,
} from '../vendor/nugget8-ocean-scene/scene/Ocean.js'

// DEBUG: Set to true to use MeshBasicMaterial instead of ocean shader
const DEBUG_OCEAN_BASIC = false
// DEBUG: Minimum opacity to prevent invisible ocean
const DEBUG_MIN_ALPHA = true
const MIN_OCEAN_ALPHA = 0.3

let scene = null
let buildPlane = null
let cameraRef = null

// Camera forward for ocean spot lighting (per-frame)
const cameraForward = new THREE.Vector3(0, 0, -1)

const CoastletEnvironmentManager = {
  /**
   * @param {{ scene: THREE.Scene, camera: THREE.Camera, seaLevel?: number }} options
   */
  init({ scene: sc, camera, seaLevel: sl }) {
    scene = sc
    cameraRef = camera

    // === STARTUP ORDER (mirrors nugget-demo.js) ===

    // 1. Inject ShaderChunk overrides for #include directives
    SettingsStart()

    // 2. Start clock — exposes timeUniform
    TimeStart()

    // 3. Init skybox material + procedural textures (bluenoise)
    SkyboxMaterialStart()

    // 4. Create skybox mesh
    SkyboxStart()

    // === CRITICAL FIX: BackSide is required for skybox seen from inside ===
    skyboxMaterial.side = THREE.BackSide
    skybox.material = skyboxMaterial
    skybox.frustumCulled = false
    setSkyboxCamera(camera)

    // 5. Init ocean materials + procedural normal maps
    OceanMaterialsStart()

    // 6. Create ocean surface + volume
    OceanStart()

    // Set camera references for ocean
    setOceanCamera(camera)

    // DEBUG: Test ocean geometry visibility with MeshBasicMaterial
    if (DEBUG_OCEAN_BASIC) {
      console.log('[CoastletEnvironmentManager] DEBUG MODE: Using MeshBasicMaterial for ocean')
      oceanSurfaceMesh.material = new THREE.MeshBasicMaterial({
        color: 0x1e90ff,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.8,
      })
      console.log('[CoastletEnvironmentManager] Ocean surface:', oceanSurfaceMesh)
      console.log('[CoastletEnvironmentManager] Ocean position:', oceanSurfaceMesh.position.x, oceanSurfaceMesh.position.y, oceanSurfaceMesh.position.z)
    } else {
      // CRITICAL: Force minimum opacity on transparent ocean surface
      // Nugget8 ocean shader outputs alpha based on reflectivity which can be ~0 for calm water
      // Without this, the ocean surface is invisible
      if (oceanSurfaceMesh.material.transparent) {
        oceanSurfaceMesh.material.opacity = 1.0
        oceanSurfaceMesh.material.depthWrite = true
        console.log('[CoastletEnvironmentManager] Ocean shader active (transparent mode)')
      }
    }

    // 7. Connect skybox uniforms to ALL materials (skybox + ocean surface + volume)
    // Apply to skybox material
    SetSkyboxUniforms(skybox.material, rotationMatrix, dirToLight)
    // Apply to ocean materials
    applySkyboxUniforms(rotationMatrix, dirToLight)

    // 8. Add to scene
    scene.add(skybox)
    scene.add(oceanSurfaceMesh)

    console.log('[CoastletEnvironmentManager] Skybox added:', !!skybox.parent)
    console.log('[CoastletEnvironmentManager] Skybox material:', !!skybox.material)
    console.log('[CoastletEnvironmentManager] Ocean surface added:', !!oceanSurfaceMesh.parent)
    console.log('[CoastletEnvironmentManager] Nugget8 Ocean Scene initialized ✅')

    // === Lighting (game objects need some ambient/directional light) ===
    const hemiLight = new THREE.HemisphereLight(0x87CEEB, 0x8B7355, 0.5)
    scene.add(hemiLight)

    const dirLight = new THREE.DirectionalLight(0xfff2d6, 1.2)
    dirLight.position.set(100, 200, 100)
    dirLight.castShadow = false
    scene.add(dirLight)

    // === Build plane (invisible, for raycasting) ===
    const geo = new THREE.PlaneGeometry(500, 500)
    geo.rotateX(-Math.PI / 2)
    const mat = new THREE.MeshBasicMaterial({
      transparent: true,
      opacity: 0,
      depthWrite: false,
      colorWrite: false,
    })
    buildPlane = new THREE.Mesh(geo, mat)
    buildPlane.name = 'buildPlane'
    buildPlane.userData.isBuildTarget = true
    buildPlane.userData.ignoreRaycast = false
    scene.add(buildPlane)

    // === TEMPORARILY DISABLE PostProcessing during debug ===
    // Re-enable once visual is stable
    PostProcessing.setEnabled(false)
    console.log('[CoastletEnvironmentManager] PostProcessing DISABLED for debug')

    return this
  },

  async waitForReady() {
    // Wait for ocean textures to load (TextureLoader.loadAsync)
    await new Promise(r => setTimeout(r, 800))
    // Log texture status - normalMap1.value is the texture, .image is the HTMLImageElement
    if (normalMap1 && normalMap1.value && normalMap1.value.image) {
      console.log('[CoastletEnvironmentManager] NormalMap1 ready:', normalMap1.value.image.width, 'x', normalMap1.value.image.height)
    }
    if (normalMap2 && normalMap2.value && normalMap2.value.image) {
      console.log('[CoastletEnvironmentManager] NormalMap2 ready:', normalMap2.value.image.width, 'x', normalMap2.value.image.height)
    }
    if (!normalMap1?.value?.image || !normalMap2?.value?.image) {
      console.warn('[CoastletEnvironmentManager] WARNING: Textures may not be loaded yet, using procedural fallbacks')
    }
    console.log('[CoastletEnvironmentManager] Ready ✅')
  },

  update(dt) {
    if (!cameraRef) return

    // Update Nugget8 time system
    TimeUpdate()

    // Update skybox (rotates sun, follows camera)
    SkyboxUpdate()

    // Update ocean (follows camera on XZ)
    OceanUpdate()

    // Update camera forward for ocean spot lighting
    cameraForward.set(0, 0, -1).applyQuaternion(cameraRef.quaternion)
    setOceanCameraForward(cameraForward)
  },

  getBuildPlane() { return buildPlane },
  getOceanSurface() { return oceanSurfaceMesh },
  getSkybox() { return skybox },
  isReady() { return true },

  dispose() {
    if (skybox) { scene.remove(skybox); skybox.geometry?.dispose(); skybox.material?.dispose() }
    if (oceanSurfaceMesh) { scene.remove(oceanSurfaceMesh); oceanSurfaceMesh.geometry?.dispose() }
    if (buildPlane) {
      scene.remove(buildPlane)
      buildPlane.geometry?.dispose()
      buildPlane.material?.dispose()
      buildPlane = null
    }
  }
}

export { CoastletEnvironmentManager }
