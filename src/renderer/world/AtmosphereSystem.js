/**
 * AtmosphereSystem.js — Fog and horizon management
 *
 * Thay thế FogExp2 trắng xóa trong SceneManager bằng fog nhẹ
 * cho phép thấy rõ mặt nước, horizon và silhouette công trình.
 *
 * Public API:
 *   AtmosphereSystem.init(scene)
 *   AtmosphereSystem.setFogMode(mode)  // 'linear' | 'exponential' | 'none'
 *   AtmosphereSystem.setFogColor(hexColor)
 *   AtmosphereSystem.setFogParams(params)
 *   AtmosphereSystem.getFog() → THREE.Fog|THREE.FogExp2|null
 *   AtmosphereSystem.dispose()
 */

import * as THREE from 'three'

let scene = null
let fog = null

// Default fog params - nhẹ nhàng, không trắng xóa
const FOG_CONFIG = {
  mode: 'exponential',  // 'linear' | 'exponential' | 'none'
  color: 0xddebf0,      // Soft blue-white horizon
  density: 0.0012,       // FogExp2 density
  near: 80,              // Fog near distance
  far: 650,              // Fog far distance
}

const AtmosphereSystem = {
  /**
   * @param {THREE.Scene} sceneRef
   */
  init(sceneRef) {
    scene = sceneRef

    // Xóa fog cũ nếu có
    if (scene.fog) {
      scene.fog = null
    }

    _createFog(FOG_CONFIG.mode)
    console.log('[AtmosphereSystem] Initialized with', FOG_CONFIG.mode, 'fog')
    return fog
  },

  /**
   * @param {'linear' | 'exponential' | 'none'} mode
   */
  setFogMode(mode) {
    FOG_CONFIG.mode = mode
    if (scene) {
      _createFog(mode)
    }
  },

  /**
   * @param {number} hexColor
   */
  setFogColor(hexColor) {
    FOG_CONFIG.color = hexColor
    if (fog) {
      fog.color.setHex(hexColor)
    }
  },

  /**
   * @param {{ density?: number, near?: number, far?: number }} params
   */
  setFogParams(params) {
    if (params.density !== undefined) FOG_CONFIG.density = params.density
    if (params.near !== undefined) FOG_CONFIG.near = params.near
    if (params.far !== undefined) FOG_CONFIG.far = params.far
    if (fog) {
      if (fog.isFog) {
        fog.near = FOG_CONFIG.near
        fog.far = FOG_CONFIG.far
      } else if (fog.isFogExp2) {
        fog.density = FOG_CONFIG.density
      }
    }
  },

  /** @returns {THREE.Fog|THREE.FogExp2|null} */
  getFog() {
    return fog
  },

  /** @returns {number} fog color hex */
  getFogColor() {
    return FOG_CONFIG.color
  },

  dispose() {
    if (scene) {
      scene.fog = null
    }
    fog = null
    scene = null
  },
}

function _createFog(mode) {
  scene.fog = null
  fog = null

  switch (mode) {
    case 'linear':
      fog = new THREE.Fog(FOG_CONFIG.color, FOG_CONFIG.near, FOG_CONFIG.far)
      break
    case 'exponential':
      fog = new THREE.FogExp2(FOG_CONFIG.color, FOG_CONFIG.density)
      break
    case 'none':
    default:
      fog = null
      break
  }

  scene.fog = fog
}

export { AtmosphereSystem, FOG_CONFIG }
