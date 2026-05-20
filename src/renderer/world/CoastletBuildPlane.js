/**
 * CoastletBuildPlane.js — Invisible Raycast Plane
 *
 * Render target cho build interaction.
 * Ocean chỉ là visual, không phải raycast target.
 * BuildPlane nằm ở seaLevel hoặc trên cùng của stack.
 *
 * Public API:
 *   CoastletBuildPlane.init({ scene, camera, seaLevel })
 *   CoastletBuildPlane.getObject() → THREE.Mesh
 *   CoastletBuildPlane.dispose()
 */

import * as THREE from 'three'

let scene = null
let camera = null
let seaLevel = -0.03
let buildPlane = null

const BUILD_PLANE_SIZE = 500

const CoastletBuildPlane = {
  /**
   * @param {{ scene: THREE.Scene, camera: THREE.Camera, seaLevel: number }} options
   */
  init({ scene: sceneRef, camera: cameraRef, seaLevel: seaLevelRef }) {
    scene = sceneRef
    camera = cameraRef
    seaLevel = seaLevelRef ?? -0.03

    // Create invisible build plane
    const geometry = new THREE.PlaneGeometry(BUILD_PLANE_SIZE, BUILD_PLANE_SIZE)
    
    const material = new THREE.MeshBasicMaterial({
      visible: false,  // Invisible
      side: THREE.DoubleSide,
    })

    buildPlane = new THREE.Mesh(geometry, material)
    buildPlane.name = 'buildPlane'
    buildPlane.rotation.x = -Math.PI / 2  // Horizontal
    buildPlane.position.y = seaLevel
    buildPlane.userData.isBuildTarget = true
    buildPlane.userData.ignoreRaycast = false  // IS raycast target

    scene.add(buildPlane)

    console.log('[CoastletBuildPlane] Initialized at y=', seaLevel)
    return buildPlane
  },

  /**
   * @returns {THREE.Mesh|null}
   */
  getObject() {
    return buildPlane
  },

  /**
   * Update build plane position (follows nothing - stays at sea level)
   * Called by EnvironmentManager every frame
   */
  update() {
    if (!buildPlane) return
    // Build plane stays at sea level, centered at origin
    // No camera following needed - it's a large static plane
  },

  dispose() {
    if (buildPlane) {
      scene.remove(buildPlane)
      buildPlane.geometry?.dispose()
      buildPlane.material?.dispose()
    }
    buildPlane = null
    scene = null
    camera = null
  },
}

export { CoastletBuildPlane }
