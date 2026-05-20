/**
 * SceneManager.js — Singleton quản lý THREE.Scene và WebGLRenderer
 *
 * Public API:
 *   SceneManager.init(canvas)
 *   SceneManager.getScene()
 *   SceneManager.getCamera()    ← camera được tạo tại đây, dùng chung
 *   SceneManager.getRenderer()
 *   SceneManager.render()
 *   SceneManager.addObject(object)
 *   SceneManager.removeObject(object)
 *   SceneManager.setBackground(color)
 */

import * as THREE from 'three'
import { PostProcessing } from './PostProcessing.js'

let scene = null
let renderer = null
let camera = null

const SceneManager = {
  /**
   * Khởi tạo scene, renderer và camera.
   * Phải gọi trước tất cả các module khác.
   * @param {HTMLCanvasElement} canvas
   */
  init(canvas) {
    // === Scene ===
    scene = new THREE.Scene()
    scene.background = null  // Skybox sets background
    scene.fog = null      // Horizon handled by skybox shader (Phase E)

    // === Camera ===
    // far = 10000: SkySystem creates sky sphere radius 1500, far must exceed this
    camera = new THREE.PerspectiveCamera(
      45,
      canvas.clientWidth / canvas.clientHeight,
      0.1,
      10000
    )
    camera.position.set(10, 8, 10)
    camera.lookAt(0, 0, 0)

    // === Renderer ===
    renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: false, // CLARIFICATION-02: Tắt antialias của WebGLRenderer vì đã có FXAAShader xử lý
    })
    renderer.setSize(canvas.clientWidth, canvas.clientHeight)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))

    // Output color space: SRGBColorSpace cho màu sắc đúng
    renderer.outputColorSpace = THREE.SRGBColorSpace

    // Shadows — bật ngay từ Phase 0 để Phase 1+ không phải refactor
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap

    // Tone mapping — ACESFilmic cho visual quality tốt hơn
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.25

    // === Lighting cơ bản ===
    // NOTE: DirectionalLight được sync bởi EnvironmentManager (Phase D)
    // Ở đây chỉ setup ambient/fill light nhẹ
    const hemiLight = new THREE.HemisphereLight(0x87CEEB, 0x8B7355, 0.4)
    scene.add(hemiLight)

    const ambLight = new THREE.AmbientLight(0xFFFFFF, 0.2)
    scene.add(ambLight)

    // === PostProcessing Hậu kỳ (SSAO + Bloom + FXAA) ===
    PostProcessing.init(renderer, scene, camera)

    // === Resize handler ===
    // Cập nhật camera aspect và renderer size khi resize window
    window.addEventListener('resize', () => {
      const w = canvas.clientWidth
      const h = canvas.clientHeight
      camera.aspect = w / h
      camera.updateProjectionMatrix()
      renderer.setSize(w, h)
      PostProcessing.resize(w, h)
    })

    console.log('[SceneManager] Initialized')
  },

  getScene: () => scene,
  getCamera: () => camera,
  getRenderer: () => renderer,

  /** Render 1 frame — gọi từ RenderLoop */
  render() {
    if (PostProcessing.isEnabled()) {
      PostProcessing.render()
    } else {
      renderer.render(scene, camera)
    }
  },

  /** @param {THREE.Object3D} object */
  addObject(object) {
    scene.add(object)
  },

  /** @param {THREE.Object3D} object */
  removeObject(object) {
    scene.remove(object)
  },

  /** @param {string} hexColor */
  setBackground(hexColor) {
    scene.background = new THREE.Color(hexColor)
  },
}

export { SceneManager }
