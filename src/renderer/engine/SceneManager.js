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
let canvasRef = null
let lastRenderWidth = 0
let lastRenderHeight = 0

const SceneManager = {
  /**
   * Khởi tạo scene, renderer và camera.
   * Phải gọi trước tất cả các module khác.
   * @param {HTMLCanvasElement} canvas
   */
  init(canvas) {
    canvasRef = canvas

    // === Scene ===
    scene = new THREE.Scene()
    scene.background = null  // Skybox sets background
    scene.fog = null      // Horizon handled by skybox shader (Phase E)

    // === Camera ===
    // far = 10000: SkySystem creates sky sphere radius 1500, far must exceed this
    camera = new THREE.PerspectiveCamera(
      45,
      _getViewportSize().width / _getViewportSize().height,
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
    const initialSize = _getViewportSize()
    renderer.setSize(initialSize.width, initialSize.height, false)
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
    _syncRendererSize()
    window.addEventListener('resize', _syncRendererSize)
    if (window.ResizeObserver) {
      const resizeObserver = new ResizeObserver(_syncRendererSize)
      resizeObserver.observe(canvas)
    }
    requestAnimationFrame(_syncRendererSize)

    console.log('[SceneManager] Initialized')
  },

  getScene: () => scene,
  getCamera: () => camera,
  getRenderer: () => renderer,

  /** Render 1 frame — gọi từ RenderLoop */
  render() {
    _syncRendererSize()
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

function _getViewportSize() {
  const rect = canvasRef?.getBoundingClientRect()
  const width = Math.max(
    1,
    Math.floor(window.innerWidth || 0),
    Math.floor(rect?.width || 0),
    Math.floor(canvasRef?.clientWidth || 0)
  )
  const height = Math.max(
    1,
    Math.floor(window.innerHeight || 0),
    Math.floor(rect?.height || 0),
    Math.floor(canvasRef?.clientHeight || 0)
  )

  return { width, height }
}

function _syncRendererSize() {
  if (!renderer || !camera || !canvasRef) return

  const { width, height } = _getViewportSize()
  if (width === lastRenderWidth && height === lastRenderHeight) return

  lastRenderWidth = width
  lastRenderHeight = height

  camera.aspect = width / height
  camera.updateProjectionMatrix()
  renderer.setSize(width, height, false)
  PostProcessing.resize(width, height)
}

export { SceneManager }
