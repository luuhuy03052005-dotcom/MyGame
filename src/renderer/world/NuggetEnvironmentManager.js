import * as THREE from 'three'
import { PostProcessing } from '../engine/PostProcessing.js'

import * as Settings from '../vendor/nugget8-ocean-scene/shaders/Settings.js'
import * as Skybox from '../vendor/nugget8-ocean-scene/scene/Skybox.js'
import * as Ocean from '../vendor/nugget8-ocean-scene/scene/Ocean.js'
import * as SkyboxMaterial from '../vendor/nugget8-ocean-scene/materials/SkyboxMaterial.js'
import * as OceanMaterial from '../vendor/nugget8-ocean-scene/materials/OceanMaterial.js'
import * as Time from '../vendor/nugget8-ocean-scene/scripts/Time.js'

let sceneRef = null
let cameraRef = null
let buildPlane = null
let dirLight = null
let hemiLight = null
let seaLevelRef = -0.03

const NuggetEnvironmentManager = {
  init({ scene, camera, seaLevel = -0.03 }) {
    sceneRef = scene
    cameraRef = camera
    seaLevelRef = seaLevel

    Settings.Start()
    Time.Start()

    SkyboxMaterial.Start()
    OceanMaterial.Start()

    Skybox.setCamera(camera)
    Skybox.Start()
    Skybox.skybox.material = SkyboxMaterial.material
    Skybox.skybox.userData.ignoreRaycast = true
    Skybox.skybox.frustumCulled = false
    Skybox.skybox.renderOrder = -100
    scene.add(Skybox.skybox)

    SkyboxMaterial.SetSkyboxUniforms(
      Skybox.skybox.material,
      Skybox.rotationMatrix,
      Skybox.dirToLight
    )
    OceanMaterial.applySkyboxUniforms(
      Skybox.rotationMatrix,
      Skybox.dirToLight
    )

    Ocean.setCamera(camera)
    Ocean.Start()
    Ocean.surface.position.y = seaLevel
    Ocean.surface.userData.ignoreRaycast = true
    Ocean.surface.frustumCulled = false
    Ocean.surface.renderOrder = -10
    Ocean.volume.userData.ignoreRaycast = true
    scene.add(Ocean.surface)

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
    buildPlane.position.y = seaLevel
    scene.add(buildPlane)

    hemiLight = new THREE.HemisphereLight(0xffffff, 0x8bb3c7, 0.6)
    scene.add(hemiLight)

    dirLight = new THREE.DirectionalLight(0xfff2d6, 1.4)
    dirLight.castShadow = false
    dirLight.position.copy(Skybox.dirToLight.clone().multiplyScalar(200))
    scene.add(dirLight)

    PostProcessing.setEnabled(false)
    console.log('[NuggetEnvironmentManager] Vendor Nugget8 skybox/ocean initialized')
    return this
  },

  async waitForReady() {
    await OceanMaterial.textureLoadPromise
    console.log('[NuggetEnvironmentManager] normal1:', OceanMaterial.normalMap1.value?.image?.width, OceanMaterial.normalMap1.value?.image?.height)
    console.log('[NuggetEnvironmentManager] normal2:', OceanMaterial.normalMap2.value?.image?.width, OceanMaterial.normalMap2.value?.image?.height)
  },

  update(deltaTime) {
    if (!cameraRef) return

    if (Time.setDeltaTime) {
      Time.setDeltaTime(deltaTime)
    } else {
      Time.Update()
    }

    Skybox.Update()
    Ocean.Update()
    Ocean.surface.position.y = seaLevelRef

    if (dirLight) {
      dirLight.position.copy(Skybox.dirToLight.clone().multiplyScalar(200))
    }
  },

  getBuildPlane() {
    return buildPlane
  },

  getOceanSurface() {
    return Ocean.surface
  },

  getSkybox() {
    return Skybox.skybox
  },

  isReady() {
    return !!sceneRef
  },

  dispose() {
    if (Skybox.skybox?.parent) sceneRef.remove(Skybox.skybox)
    if (Ocean.surface?.parent) sceneRef.remove(Ocean.surface)
    if (buildPlane) {
      sceneRef.remove(buildPlane)
      buildPlane.geometry?.dispose()
      buildPlane.material?.dispose()
      buildPlane = null
    }
    if (hemiLight) {
      sceneRef.remove(hemiLight)
      hemiLight = null
    }
    if (dirLight) {
      sceneRef.remove(dirLight)
      dirLight = null
    }
    sceneRef = null
    cameraRef = null
  },
}

export { NuggetEnvironmentManager }
