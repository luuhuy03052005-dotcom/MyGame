/**
 * materials/SkyboxMaterial.js — Nugget8 Ocean Scene
 * CHANGED:
 * - SetSkyboxUniforms accepts explicit rotMatrix and dirLight refs
 * - No circular imports
 * - Procedural texture generation replaces missing images/bluenoise.png
 */
import * as THREE from 'three'
const { MathUtils } = THREE
import { fragment, vertex } from '../shaders/SkyboxShader.js'
import { Random } from '../scripts/Random.js'

export const material = new THREE.ShaderMaterial()

const ditherSize = new THREE.Uniform(new THREE.Vector2())
const dither = new THREE.Uniform()
const sunVisibility = new THREE.Uniform(1)
const twilightTime = new THREE.Uniform(0)
const twilightVisibility = new THREE.Uniform(0)

const starsSeed = 87
const gridSize = 64
const starsCount = 10000
const maxOffset = 0.43
const starsMap = new Uint8Array(gridSize * gridSize * 24)
const stars = new THREE.Uniform()

const specularVisibility = new THREE.Uniform(Math.sqrt(sunVisibility.value))
const light = new THREE.Uniform(new THREE.Vector3(1, 1, 1))

const up = new THREE.Vector3(0, 1, 0)

let intensity = 0
let l = 0

// Store refs passed via SetSkyboxUniforms so Update() can use them
let _skyRotationMatrix = null
let _dirToLight = null

function Vector3ToStarMap(dir, value) {
  const absDir = new THREE.Vector3(Math.abs(dir.x), Math.abs(dir.y), Math.abs(dir.z))
  const xPositive = dir.x > 0
  const yPositive = dir.y > 0
  const zPositive = dir.z > 0

  let maxAxis = 0, u = 0, v = 0, i = 0

  if (xPositive && absDir.x >= absDir.y && absDir.x >= absDir.z) {
    maxAxis = absDir.x; u = -dir.z; v = dir.y; i = 0
  }
  if (!xPositive && absDir.x >= absDir.y && absDir.x >= absDir.z) {
    maxAxis = absDir.x; u = dir.z; v = dir.y; i = 1
  }
  if (yPositive && absDir.y >= absDir.x && absDir.y >= absDir.z) {
    maxAxis = absDir.y; u = dir.x; v = -dir.z; i = 2
  }
  if (!yPositive && absDir.y >= absDir.x && absDir.y >= absDir.z) {
    maxAxis = absDir.y; u = dir.x; v = dir.z; i = 3
  }
  if (zPositive && absDir.z >= absDir.x && absDir.z >= absDir.y) {
    maxAxis = absDir.z; u = dir.x; v = dir.y; i = 4
  }
  if (!zPositive && absDir.z >= absDir.x && absDir.z >= absDir.y) {
    maxAxis = absDir.z; u = -dir.x; v = dir.y; i = 5
  }

  u = Math.floor((u / maxAxis + 1) * 0.5 * gridSize)
  v = Math.floor((v / maxAxis + 1) * 0.5 * gridSize)
  const j = (v * gridSize * 6 + i * gridSize + u) * 4
  starsMap[j] = value[0]; starsMap[j + 1] = value[1]
  starsMap[j + 2] = value[2]; starsMap[j + 3] = value[3]
}

// Procedural noise texture (replaces images/bluenoise.png)
function createProceduralNoiseTexture(size = 256) {
  const data = new Uint8Array(size * size * 4)
  for (let i = 0; i < data.length; i += 4) {
    const noise = Math.random()
    const val = Math.floor(noise * 255)
    data[i] = val; data[i + 1] = val; data[i + 2] = val; data[i + 3] = 255
  }
  const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat)
  texture.needsUpdate = true
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  return texture
}

export function Start() {
  const noiseTexture = createProceduralNoiseTexture(256)
  dither.value = noiseTexture
  ditherSize.value.set(noiseTexture.image.width, noiseTexture.image.height)

  console.log('[SkyboxMaterial] Bluenoise:', noiseTexture.image.width, 'x', noiseTexture.image.height)

  const random = new Random(starsSeed)
  for (let i = 0; i < starsCount; i++) {
    const a = random.Next() * Math.PI * 2
    const b = random.Next() * 2 - 1
    const c = Math.sqrt(1 - b * b)
    const target = new THREE.Vector3(Math.cos(a) * c, Math.sin(a) * c, b)
    Vector3ToStarMap(target, [
      MathUtils.lerp(0.5 - maxOffset, 0.5 + maxOffset, random.Next()) * 255,
      MathUtils.lerp(0.5 - maxOffset, 0.5 + maxOffset, random.Next()) * 255,
      Math.pow(random.Next(), 6) * 255,
      random.Next() * 255,
    ])
  }

  stars.value = new THREE.DataTexture(starsMap, gridSize * 6, gridSize)
  stars.value.needsUpdate = true

  material.vertexShader = vertex
  material.fragmentShader = fragment

  // Initial values (will be updated in Update() using _dirToLight)
  sunVisibility.value = 1
  twilightTime.value = 0
  twilightVisibility.value = 0
}

/**
 * Apply skybox uniforms to any ShaderMaterial.
 * @param {THREE.ShaderMaterial} targetMaterial
 * @param {THREE.Uniform} rotMatrix - rotation matrix uniform (from Skybox.rotationMatrix)
 * @param {THREE.Vector3} dirLight - direction to light (from Skybox.dirToLight)
 */
export function SetSkyboxUniforms(targetMaterial, rotMatrix, dirLight) {
  _skyRotationMatrix = rotMatrix
  _dirToLight = dirLight

  if (!targetMaterial.uniforms) targetMaterial.uniforms = {}

  targetMaterial.uniforms._SkyRotationMatrix = rotMatrix
  targetMaterial.uniforms._DitherTexture = dither
  targetMaterial.uniforms._DitherTextureSize = ditherSize
  targetMaterial.uniforms._SunVisibility = sunVisibility
  targetMaterial.uniforms._TwilightTime = twilightTime
  targetMaterial.uniforms._TwilightVisibility = twilightVisibility
  targetMaterial.uniforms._GridSize = new THREE.Uniform(gridSize)
  targetMaterial.uniforms._GridSizeScaled = new THREE.Uniform(gridSize * 6)
  targetMaterial.uniforms._Stars = stars
  targetMaterial.uniforms._SpecularVisibility = specularVisibility
  targetMaterial.uniforms._DirToLight = dirLight
  targetMaterial.uniforms._Light = light
}

export function Update() {
  // Use stored refs for intensity calculation
  const _intensity = _dirToLight ? _dirToLight.dot(up) : 0
  sunVisibility.value = MathUtils.clamp((_intensity + 0.1) * 2, 0, 1)
  twilightTime.value = MathUtils.clamp((_intensity + 0.1) * 3, 0, 1)
  twilightVisibility.value = 1 - Math.min(Math.abs(_intensity * 3), 1)
  specularVisibility.value = Math.sqrt(sunVisibility.value)
  l = Math.min(sunVisibility.value + 0.333, 1)
  light.value.set(l, l, l)
}
