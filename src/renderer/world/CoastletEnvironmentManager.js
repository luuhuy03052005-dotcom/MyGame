/**
 * CoastletEnvironmentManager.js
 * Manages Nugget8 Ocean Scene skybox + ocean + build plane
 *
 * Startup order mirrors nugget-demo.js:
 * 1. Settings.Start() — inject ShaderChunk (#include overrides)
 * 2. Time.Start() — start clock + expose timeUniform
 * 3. SkyboxMaterial.Start() — load Nugget8 bluenoise texture
 * 4. Skybox.Start() — create skybox mesh
 * 5. OceanMaterial.Start() — load Nugget8 water normal maps
 * 6. Ocean.Start() — create ocean surface + volume
 * 7. SetSkyboxUniforms() — connect skybox uniforms to all materials
 * 8. Add to scene
 */
import * as THREE from 'three'
import { PostProcessing } from '../engine/PostProcessing.js'
import { NuggetOceanSceneAdapter } from './NuggetOceanSceneAdapter.js'

let scene = null
let buildPlane = null
let cameraRef = null

const CoastletEnvironmentManager = {
  /**
   * @param {{ scene: THREE.Scene, camera: THREE.Camera, seaLevel?: number }} options
   */
  init({ scene: sc, camera, seaLevel: sl }) {
    scene = sc
    cameraRef = camera

    NuggetOceanSceneAdapter.init({ scene, camera })
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
    await NuggetOceanSceneAdapter.waitForReady()
    console.log('[CoastletEnvironmentManager] Ready ✅')
  },

  update(dt) {
    if (!cameraRef) return

    NuggetOceanSceneAdapter.update(dt)
  },

  getBuildPlane() { return buildPlane },
  getOceanSurface() { return NuggetOceanSceneAdapter.getOceanSurface() },
  getSkybox() { return NuggetOceanSceneAdapter.getSkybox() },
  isReady() { return true },

  dispose() {
    NuggetOceanSceneAdapter.dispose()
    if (buildPlane) {
      scene.remove(buildPlane)
      buildPlane.geometry?.dispose()
      buildPlane.material?.dispose()
      buildPlane = null
    }
  }
}

export { CoastletEnvironmentManager }
