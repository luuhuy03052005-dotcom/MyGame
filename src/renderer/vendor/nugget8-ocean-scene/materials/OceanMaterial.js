/**
 * materials/OceanMaterial.js — Nugget8 Ocean Scene
 * Loads Nugget8's real PNG textures through Vite asset URLs.
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
export let textureLoadPromise = null
const waterNormal1Url = new URL('../images/waterNormal1.png', import.meta.url).href
const waterNormal2Url = new URL('../images/waterNormal2.png', import.meta.url).href
const basicCheckerUrl = new URL('../images/basicChecker.png', import.meta.url).href
const sandUrl = new URL('../images/sand.png', import.meta.url).href
const MAX_INTERACTORS = 32
const interactorPositions = Array.from(
  { length: MAX_INTERACTORS },
  () => new THREE.Vector4(99999, 99999, 0, 0)
)
const interactorRadii = new Float32Array(MAX_INTERACTORS)
const interactorStrengths = new Float32Array(MAX_INTERACTORS)

export function Start() {
  surface.vertexShader = OceanShaders.surfaceVertex
  surface.fragmentShader = OceanShaders.surfaceFragment
  surface.side = THREE.DoubleSide
  surface.transparent = true

  surface.uniforms = {
    _Time: timeUniform,
    _NormalMap1: normalMap1,
    _NormalMap2: normalMap2,
    _WaveJitterStrength: new THREE.Uniform(0.08),
    _WaveJitterScale: new THREE.Uniform(0.018),
    _WaveJitterSpeed: new THREE.Uniform(0.35),
    _WaveRandomSeed: new THREE.Uniform(12.37),
    _InteractorCount: new THREE.Uniform(0),
    _InteractorPositions: new THREE.Uniform(interactorPositions),
    _InteractorRadii: new THREE.Uniform(interactorRadii),
    _InteractorStrengths: new THREE.Uniform(interactorStrengths),
    _InteractionFoamColor: new THREE.Uniform(new THREE.Color(0.92, 0.97, 1.0)),
    _InteractionFoamStrength: new THREE.Uniform(0.65),
    _InteractionRippleStrength: new THREE.Uniform(0.07),
  }

  textureLoadPromise = _loadTextures()

  _loadTexture(basicCheckerUrl, objectTexture, 'basicChecker.png')
  _loadTexture(sandUrl, landTexture, 'sand.png')

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

async function _loadTextures() {
  const n1 = await _loadTexture(waterNormal1Url, normalMap1, 'waterNormal1.png')
  const n2 = await _loadTexture(waterNormal2Url, normalMap2, 'waterNormal2.png')
  n1.repeat.set(4, 4)
  n2.repeat.set(4, 4)
  normalMap1Loaded = true
  normalMap2Loaded = true
}

async function _loadTexture(url, uniform, label) {
  const texture = await new THREE.TextureLoader().loadAsync(url)
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  uniform.value = texture
  console.log('[OceanMaterial] Loaded ' + label + ':', texture.image?.width, 'x', texture.image?.height)
  return texture
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
