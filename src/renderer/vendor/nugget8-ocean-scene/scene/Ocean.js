/**
 * scene/Ocean.js — Nugget8 Ocean Scene
 * CHANGED: No circular imports. Material is set by demo harness.
 */
import * as THREE from 'three'
import * as oceanMaterials from '../materials/OceanMaterial.js'

export const surface = new THREE.Mesh()
export const volume = new THREE.Mesh()

// camera is set via setCamera()
let camera = null
export function setCamera(cam) { camera = cam }

export function Start() {
  const halfSize = 1500
  const depth = 1000

  // Surface — flat quad (no vertex displacement, uses normal maps in fragment shader)
  const surfaceVertices = new Float32Array([
    -halfSize, 0, -halfSize,
    halfSize, 0, -halfSize,
    -halfSize, 0, halfSize,
    halfSize, 0, halfSize,
  ])

  const surfaceIndices = [
    2, 3, 0,
    3, 1, 0,
  ]

  const surfaceGeometry = new THREE.BufferGeometry()
  surfaceGeometry.setAttribute('position', new THREE.BufferAttribute(surfaceVertices, 3))
  surfaceGeometry.setIndex(surfaceIndices)

  surface.geometry = surfaceGeometry
  surface.material = oceanMaterials.surface

  // Volume — underwater box
  const volumeVertices = new Float32Array([
    -halfSize, -depth, -halfSize,
    halfSize, -depth, -halfSize,
    -halfSize, -depth, halfSize,
    halfSize, -depth, halfSize,

    -halfSize, 0, -halfSize,
    halfSize, 0, -halfSize,
    -halfSize, 0, halfSize,
    halfSize, 0, halfSize,
  ])

  const volumeIndices = [
    2, 3, 0, 3, 1, 0,
    0, 1, 4, 1, 5, 4,
    1, 3, 5, 3, 7, 5,
    3, 2, 7, 2, 6, 7,
    2, 0, 6, 0, 4, 6,
  ]

  const volumeGeometry = new THREE.BufferGeometry()
  volumeGeometry.setAttribute('position', new THREE.BufferAttribute(volumeVertices, 3))
  volumeGeometry.setIndex(volumeIndices)

  volume.geometry = volumeGeometry
  volume.material = oceanMaterials.volume

  volume.parent = surface
  surface.add(volume)

  console.log('[Ocean] Surface added:', !!surface.parent)
  console.log('[Ocean] Surface position:', surface.position.x, surface.position.y, surface.position.z)
  console.log('[Ocean] Volume added:', !!volume.parent)
}

export function Update() {
  // Ocean surface follows camera on XZ plane (keeps ocean around player)
  if (camera) {
    surface.position.set(camera.position.x, 0, camera.position.z)
  }
}
