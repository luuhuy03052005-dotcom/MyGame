/**
 * CoastletEnvironmentManager.js
 * Manages SkySystem, OceanSystem, and invisible build plane
 */
import * as THREE from 'three'
import { SkySystem } from './SkySystem.js'
import { GerstnerOceanSystem } from './GerstnerOceanSystem.js'

let scene = null
let buildPlane = null
let gerstnerOceanSystem = null

const CoastletEnvironmentManager = {
  init({ scene: sc, camera, renderer, sceneManager, seaLevel: sl }) {
    scene = sc

    // Init skybox
    SkySystem.init({ scene, camera })

    // Init Gerstner ocean
    gerstnerOceanSystem = GerstnerOceanSystem
    GerstnerOceanSystem.init({ scene, camera, seaLevel: sl ?? -0.03 })

    // Create invisible build plane for raycasting
    const geo = new THREE.PlaneGeometry(500, 500)
    geo.rotateX(-Math.PI / 2)
    const mat = new THREE.MeshBasicMaterial({ visible: false })
    buildPlane = new THREE.Mesh(geo, mat)
    buildPlane.name = 'buildPlane'
    buildPlane.userData.isBuildTarget = true
    buildPlane.userData.ignoreRaycast = false
    scene.add(buildPlane)

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
  },

  getBuildPlane() { return buildPlane },
  getOceanSurface() { return GerstnerOceanSystem ? GerstnerOceanSystem.getSurface() : null },
  getSkybox() { return null },
  isReady() { return GerstnerOceanSystem ? GerstnerOceanSystem.isReady() : false },

  dispose() {
    SkySystem.dispose()
    if (GerstnerOceanSystem) {
      GerstnerOceanSystem.dispose()
    }
    if (buildPlane) {
      scene.remove(buildPlane)
      buildPlane.geometry?.dispose()
      buildPlane.material?.dispose()
      buildPlane = null
    }
  }
}

export { CoastletEnvironmentManager }
