/**
 * NuggetOceanSceneAdapter.js
 * Isolated adapter for Nugget8 Ocean Scene runtime objects.
 */
import * as THREE from 'three'

import { Start as SettingsStart } from '../vendor/nugget8-ocean-scene/shaders/Settings.js'
import { Start as TimeStart, Update as TimeUpdate } from '../vendor/nugget8-ocean-scene/scripts/Time.js'
import {
  Start as SkyboxMaterialStart,
  material as skyboxMaterial,
  SetSkyboxUniforms,
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
  applySkyboxUniforms,
  setCameraForward as setOceanCameraForward,
  normalMap1,
  normalMap2,
  textureLoadPromise,
} from '../vendor/nugget8-ocean-scene/materials/OceanMaterial.js'
import {
  Start as OceanStart,
  Update as OceanUpdate,
  surface as oceanSurfaceMesh,
  setCamera as setOceanCamera,
} from '../vendor/nugget8-ocean-scene/scene/Ocean.js'

let scene = null
let cameraRef = null
let initialized = false

const cameraForward = new THREE.Vector3(0, 0, -1)

const NuggetOceanSceneAdapter = {
  init({ scene: sceneRef, camera }) {
    scene = sceneRef
    cameraRef = camera

    SettingsStart()
    TimeStart()

    SkyboxMaterialStart()
    SkyboxStart()
    skyboxMaterial.side = THREE.BackSide
    skybox.material = skyboxMaterial
    skybox.frustumCulled = false
    setSkyboxCamera(camera)

    OceanMaterialsStart()
    OceanStart()
    setOceanCamera(camera)

    SetSkyboxUniforms(skybox.material, rotationMatrix, dirToLight)
    applySkyboxUniforms(rotationMatrix, dirToLight)

    scene.add(skybox)
    scene.add(oceanSurfaceMesh)

    initialized = true
    console.log('[NuggetOceanSceneAdapter] Skybox added:', !!skybox.parent)
    console.log('[NuggetOceanSceneAdapter] Ocean surface added:', !!oceanSurfaceMesh.parent)
    return this
  },

  async waitForReady() {
    await textureLoadPromise
    console.log('[NuggetOceanSceneAdapter] normal1:', normalMap1.value?.image?.width, normalMap1.value?.image?.height)
    console.log('[NuggetOceanSceneAdapter] normal2:', normalMap2.value?.image?.width, normalMap2.value?.image?.height)
  },

  update() {
    if (!initialized || !cameraRef) return
    TimeUpdate()
    SkyboxUpdate()
    OceanUpdate()
    cameraForward.set(0, 0, -1).applyQuaternion(cameraRef.quaternion)
    setOceanCameraForward(cameraForward)
  },

  getOceanSurface() { return oceanSurfaceMesh },
  getSkybox() { return skybox },
  isReady() { return initialized },

  dispose() {
    if (skybox?.parent) scene.remove(skybox)
    if (oceanSurfaceMesh?.parent) scene.remove(oceanSurfaceMesh)
    initialized = false
    scene = null
    cameraRef = null
  },
}

export { NuggetOceanSceneAdapter }
