/**
 * materials/OceanMaterial.js — Nugget8 Ocean Scene
 * FIXED:
 * - Load real PNG textures from images/ folder
 * - Add minimum alpha to prevent invisible ocean surface
 */
import * as THREE from 'three'
import * as OceanShaders from '../shaders/OceanShaders.js'
import { timeUniform } from '../scripts/Time.js'
import { SetSkyboxUniforms as _ApplySkyboxUniforms } from '../materials/SkyboxMaterial.js'

export const surface = new THREE.ShaderMaterial()
export const volume = new THREE.ShaderMaterial()
export const object = new THREE.ShaderMaterial()
export const triplanar = new THREE.ShaderMaterial()

const spotLightSharpness = 10
export const spotLightDistance = 200
export const spotLightDistanceUniform = new THREE.Uniform(spotLightDistance)

// Uniforms that will hold textures
export const normalMap1 = new THREE.Uniform(null)
export const normalMap2 = new THREE.Uniform(null)
const objectTexture = new THREE.Uniform(null)
const landTexture = new THREE.Uniform(null)

const blendSharpness = 3
const triplanarScale = 1

// Track loaded textures for debug
export let normalMap1Loaded = false
export let normalMap2Loaded = false
let _normal1Loaded = false
let _normal2Loaded = false

export function Start() {
  surface.vertexShader = OceanShaders.surfaceVertex
  surface.fragmentShader = OceanShaders.surfaceFragment
  surface.side = THREE.DoubleSide
  surface.transparent = true

  surface.uniforms = {
    _Time: timeUniform,
    _NormalMap1: normalMap1,
    _NormalMap2: normalMap2,
  }

  // Load real PNG textures
  _loadTextures()

  // Also create procedural fallbacks for other materials
  objectTexture.value = _createProceduralCheckerTexture(64)
  landTexture.value = _createProceduralSandTexture(256)

  volume.vertexShader = OceanShaders.volumeVertex
  volume.fragmentShader = OceanShaders.volumeFragment

  object.uniforms = {
    _MainTexture: objectTexture,
    _CameraForward: new THREE.Uniform(new THREE.Vector3(0, 0, -1)),
    _SpotLightSharpness: new THREE.Uniform(spotLightSharpness),
    _SpotLightDistance: spotLightDistanceUniform,
  }

  triplanar.uniforms = {
    _MainTexture: landTexture,
    _CameraForward: new THREE.Uniform(new THREE.Vector3(0, 0, -1)),
    _BlendSharpness: new THREE.Uniform(blendSharpness),
    _Scale: new THREE.Uniform(triplanarScale),
    _SpotLightSharpness: new THREE.Uniform(spotLightSharpness),
    _SpotLightDistance: spotLightDistanceUniform,
  }
}

// Procedural texture helpers (fallbacks when PNGs fail to load)
function _createProceduralWaterNormal(size = 512, seed = 0) {
  const data = new Uint8Array(size * size * 4)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4
      const nx = Math.sin((x / size) * 8 * Math.PI + seed * 10) * 0.5 +
                  Math.cos((y / size) * 12 * Math.PI + seed * 7) * 0.4
      const ny = Math.cos((x / size) * 10 * Math.PI + seed * 13) * 0.4 +
                  Math.sin((y / size) * 6 * Math.PI + seed * 11) * 0.5
      data[i] = Math.floor((nx + 1) * 0.5 * 255)
      data[i + 1] = Math.floor((ny + 1) * 0.5 * 255)
      data[i + 2] = 255
      data[i + 3] = 255
    }
  }
  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat)
  tex.needsUpdate = true
  tex.wrapS = THREE.RepeatWrapping
  tex.wrapT = THREE.RepeatWrapping
  tex.repeat.set(4, 4)
  console.log('[OceanMaterial] Created procedural waterNormal (seed=' + seed + '):', size, 'x', size)
  return tex
}

function _createProceduralCheckerTexture(size = 64) {
  const data = new Uint8Array(size * size * 4)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4
      const c = ((x / size < 0.5) === (y / size < 0.5)) ? 220 : 80
      data[i] = c; data[i + 1] = c; data[i + 2] = c; data[i + 3] = 255
    }
  }
  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat)
  tex.needsUpdate = true
  tex.wrapS = THREE.RepeatWrapping
  tex.wrapT = THREE.RepeatWrapping
  return tex
}

function _createProceduralSandTexture(size = 256) {
  const data = new Uint8Array(size * size * 4)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4
      const n = (Math.random() - 0.5) * 20
      data[i] = Math.max(0, Math.min(255, 194 + n))
      data[i + 1] = Math.max(0, Math.min(255, 178 + n))
      data[i + 2] = Math.max(0, Math.min(255, 138 + n))
      data[i + 3] = 255
    }
  }
  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat)
  tex.needsUpdate = true
  tex.wrapS = THREE.RepeatWrapping
  tex.wrapT = THREE.RepeatWrapping
  return tex
}

async function _loadTextures() {
  const loader = new THREE.TextureLoader()

  // Load waterNormal1.png
  try {
    const n1 = await loader.loadAsync('./vendor/nugget8-ocean-scene/images/waterNormal1.png')
    n1.wrapS = THREE.RepeatWrapping
    n1.wrapT = THREE.RepeatWrapping
    n1.repeat.set(4, 4)
    normalMap1.value = n1
    _normal1Loaded = true
    normalMap1Loaded = true
    console.log('[OceanMaterial] Loaded waterNormal1.png:', n1.image.width, 'x', n1.image.height)
  } catch (e) {
    console.warn('[OceanMaterial] Failed to load waterNormal1.png:', e.message)
  }

  // Load waterNormal2.png
  try {
    const n2 = await loader.loadAsync('./vendor/nugget8-ocean-scene/images/waterNormal2.png')
    n2.wrapS = THREE.RepeatWrapping
    n2.wrapT = THREE.RepeatWrapping
    n2.repeat.set(4, 4)
    normalMap2.value = n2
    _normal2Loaded = true
    normalMap2Loaded = true
    console.log('[OceanMaterial] Loaded waterNormal2.png:', n2.image.width, 'x', n2.image.height)
  } catch (e) {
    console.warn('[OceanMaterial] Failed to load waterNormal2.png:', e.message)
  }

  // Fallback: if textures failed, create procedural ones
  if (!_normal1Loaded) {
    normalMap1.value = _createProceduralWaterNormal(512, 0)
    console.warn('[OceanMaterial] Using procedural fallback for waterNormal1')
  }
  if (!_normal2Loaded) {
    normalMap2.value = _createProceduralWaterNormal(512, 0.5)
    console.warn('[OceanMaterial] Using procedural fallback for waterNormal2')
  }
}

// Apply skybox uniforms to ocean materials
// rotMatrix and dirLight will be passed from the demo harness
export function applySkyboxUniforms(rotMatrix, dirLight) {
  _ApplySkyboxUniforms(surface, rotMatrix, dirLight)
  _ApplySkyboxUniforms(volume, rotMatrix, dirLight)
  _ApplySkyboxUniforms(object, rotMatrix, dirLight)
  _ApplySkyboxUniforms(triplanar, rotMatrix, dirLight)
  console.log('[OceanMaterial] Skybox uniforms applied ✅')
}

// cameraForward needs to be updated per frame
export function setCameraForward(vec3) {
  object.uniforms._CameraForward.value.copy(vec3)
  triplanar.uniforms._CameraForward.value.copy(vec3)
}
