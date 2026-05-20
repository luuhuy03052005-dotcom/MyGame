/**
 * CoastletEnvironmentManager.js
 * Manages SkySystem, OceanSystem, and invisible build plane
 */
import * as THREE from 'three'
import { SkySystem } from './SkySystem.js'
import { GerstnerOceanSystem } from './GerstnerOceanSystem.js'
import { PostProcessing } from '../engine/PostProcessing.js'

let scene = null
let buildPlane = null
let gerstnerOceanSystem = null

// Lighting refs for sync
let hemiLight = null
let dirLight = null

const CoastletEnvironmentManager = {
  init({ scene: sc, camera, renderer, sceneManager, seaLevel: sl }) {
    scene = sc

    // Init skybox
    SkySystem.init({ scene, camera })

    // Init Gerstner ocean
    gerstnerOceanSystem = GerstnerOceanSystem
    GerstnerOceanSystem.init({ scene, camera, seaLevel: sl ?? -0.03 })

    // Restore lighting — Phase D had HemisphereLight + DirectionalLight
    hemiLight = new THREE.HemisphereLight(0xffffff, 0x8bb3c7, 0.6)
    scene.add(hemiLight)

    dirLight = new THREE.DirectionalLight(0xfff2d6, 1.6)
    dirLight.position.set(100, 200, 100)
    dirLight.castShadow = false // Disable for perf during debug
    scene.add(dirLight)

    // Create build plane for raycasting
    const geo = new THREE.PlaneGeometry(500, 500)
    geo.rotateX(-Math.PI / 2)
    // Transparent invisible material — NOT MeshBasicMaterial with visible:false
    // (visible:false makes the mesh invisible AND unraycastable in some Three.js versions)
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

    // TEMPORARILY DISABLE PostProcessing to debug ocean/sky without post-fx
    // Re-enable once visual is stable
    PostProcessing.setEnabled(false)
    console.log('[CoastletEnvironmentManager] PostProcessing DISABLED for debug')

    return this
  },

  async waitForReady() {
    // Wait for Gerstner ocean system to be ready
    while (!GerstnerOceanSystem.isReady()) {
      await new Promise(r => setTimeout(r, 100))
    }
    // Additional settling time for textures
    await new Promise(r => setTimeout(r, 500))
  },

  update(dt) {
    SkySystem.update(dt)
    if (GerstnerOceanSystem) {
      GerstnerOceanSystem.update(dt)
    }
    // Sync directional light direction with sky
    if (dirLight) {
      const lightDir = SkySystem.getLightDirection?.()
      if (lightDir) {
        dirLight.position.copy(lightDir.clone().multiplyScalar(200))
      }
    }
  },

  getBuildPlane() { return buildPlane },
  getOceanSurface() { return GerstnerOceanSystem ? GerstnerOceanSystem.getSurface() : null },
  getSkybox() { return SkySystem.getSkybox?.() ?? null },
  isReady() { return GerstnerOceanSystem ? GerstnerOceanSystem.isReady() : false },

  dispose() {
    SkySystem.dispose()
    if (GerstnerOceanSystem) {
      GerstnerOceanSystem.dispose()
    }
    if (hemiLight) { scene.remove(hemiLight); hemiLight = null }
    if (dirLight) { scene.remove(dirLight); dirLight = null }
    if (buildPlane) {
      scene.remove(buildPlane)
      buildPlane.geometry?.dispose()
      buildPlane.material?.dispose()
      buildPlane = null
    }
  }
}

export { CoastletEnvironmentManager }
