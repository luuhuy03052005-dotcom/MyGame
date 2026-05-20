import * as THREE from 'three'

const MAX_INTERACTORS = 32

const positions = Array.from(
  { length: MAX_INTERACTORS },
  () => new THREE.Vector4(99999, 99999, 0, 0)
)
const radii = new Float32Array(MAX_INTERACTORS)
const strengths = new Float32Array(MAX_INTERACTORS)

let count = 0
let seaLevel = 0
let oceanMaterial = null

const OceanInteractionManager = {
  init({ oceanSurface, seaLevel: sl = 0 }) {
    seaLevel = sl
    oceanMaterial = oceanSurface.material
    ensureUniforms(oceanMaterial)
  },

  updateFromBuildings(buildingObjects) {
    count = 0

    for (const obj of buildingObjects) {
      if (!obj || !obj.userData?.isBuilding) continue
      if (count >= MAX_INTERACTORS) break

      const p = obj.position
      const nearWater = Math.abs(p.y - 0.5 - seaLevel) < 1.5
      if (!nearWater) continue

      positions[count].set(p.x, p.z, 0, 0)
      radii[count] = 1.15
      strengths[count] = 1.0
      count++
    }

    if (oceanMaterial) {
      ensureUniforms(oceanMaterial)
      oceanMaterial.uniforms._InteractorCount.value = count
      oceanMaterial.uniforms._InteractorPositions.value = positions
      oceanMaterial.uniforms._InteractorRadii.value = radii
      oceanMaterial.uniforms._InteractorStrengths.value = strengths
    }
  },

  applyToMaterial(material) {
    oceanMaterial = material
    ensureUniforms(oceanMaterial)
  },

  clear() {
    count = 0
    if (oceanMaterial) {
      ensureUniforms(oceanMaterial)
      oceanMaterial.uniforms._InteractorCount.value = 0
    }
  },
}

function ensureUniforms(material) {
  if (!material) return
  if (!material.uniforms) material.uniforms = {}
  material.uniforms._InteractorCount ??= new THREE.Uniform(0)
  material.uniforms._InteractorPositions ??= new THREE.Uniform(positions)
  material.uniforms._InteractorRadii ??= new THREE.Uniform(radii)
  material.uniforms._InteractorStrengths ??= new THREE.Uniform(strengths)
  material.uniforms._InteractionFoamColor ??= new THREE.Uniform(new THREE.Color(0.92, 0.97, 1.0))
  material.uniforms._InteractionFoamStrength ??= new THREE.Uniform(0.65)
  material.uniforms._InteractionRippleStrength ??= new THREE.Uniform(0.07)
}

export { OceanInteractionManager }
