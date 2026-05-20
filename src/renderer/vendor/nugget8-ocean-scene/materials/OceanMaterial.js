/**
 * materials/OceanMaterial.js — Nugget8 Ocean Scene
 * CHANGED:
 * - Procedural texture generation (images/waterNormal1.png, waterNormal2.png don't exist)
 * - Static import of SetSkyboxUniforms from SkyboxMaterial
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

// Procedural normal maps (replaces missing images/waterNormal1.png, waterNormal2.png)
function createProceduralWaterNormal(size = 512, seed = 0) {
  const data = new Uint8Array(size * size * 4)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4
      const nx = Math.sin((x / size) * 8 * Math.PI + seed * 10) * 0.3 +
                  Math.cos((y / size) * 12 * Math.PI + seed * 7) * 0.2
      const ny = Math.cos((x / size) * 10 * Math.PI + seed * 13) * 0.2 +
                  Math.sin((y / size) * 6 * Math.PI + seed * 11) * 0.3
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
  return tex
}

function createProceduralCheckerTexture(size = 64) {
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

function createProceduralSandTexture(size = 256) {
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

const normalMap1 = new THREE.Uniform(createProceduralWaterNormal(512, 0))
const normalMap2 = new THREE.Uniform(createProceduralWaterNormal(512, 0.5))
const objectTexture = new THREE.Uniform(createProceduralCheckerTexture(64))
const landTexture = new THREE.Uniform(createProceduralSandTexture(256))
const blendSharpness = 3
const triplanarScale = 1

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

  console.log('[OceanMaterial] waterNormal1:', normalMap1.value.image.width, 'x', normalMap1.value.image.height)
  console.log('[OceanMaterial] waterNormal2:', normalMap2.value.image.width, 'x', normalMap2.value.image.height)
  console.log('[OceanMaterial] sand texture:', landTexture.value.image.width, 'x', landTexture.value.image.height)
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
