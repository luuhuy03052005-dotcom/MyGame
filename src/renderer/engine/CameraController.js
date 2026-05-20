/**
 * CameraController.js — Tự implement orbit controls
 *
 * Lý do không dùng OrbitControls của Three.js:
 * - Giảm dependency ngoài
 * - Kiểm soát chính xác clamp và damping
 *
 * Controls:
 *   - Chuột phải + drag → xoay (azimuth + elevation)
 *   - Scroll → zoom
 *   - Phím F → reset về default
 *
 * Constraints (ARCHITECTURE.md 2.2):
 *   - Elevation: [5°, 85°] — không nhìn từ dưới lên
 *   - Distance: [3, 80]
 *   - Default position: (10, 8, 10), target (0, 0, 0)
 */

import * as THREE from 'three'

// Vị trí mặc định
const DEFAULT_AZIMUTH = Math.atan2(10, 10)    // ~0.785 rad (~45°)
const DEFAULT_ELEVATION = Math.atan2(8, Math.sqrt(10*10 + 10*10))  // ~0.611 rad
const DEFAULT_DISTANCE = Math.sqrt(10*10 + 8*8 + 10*10)  // ~15.6

const DEG = Math.PI / 180

let camera = null
let domElement = null

// Orbit state
let azimuth = DEFAULT_AZIMUTH
let elevation = DEFAULT_ELEVATION
let distance = DEFAULT_DISTANCE
const target = new THREE.Vector3(0, 0, 0)

// Damping — smooth movement
let azimuthVelocity = 0
let elevationVelocity = 0
let distanceVelocity = 0
const DAMPING = 0.85

// Mouse state cho orbit
let isRightMouseDown = false
let lastMouseX = 0
let lastMouseY = 0
const ORBIT_SPEED = 0.005
const ZOOM_SPEED = 0.1

const CameraController = {
  /**
   * @param {THREE.Camera} cam
   * @param {HTMLElement} element - DOM element để listen events
   */
  init(cam, element) {
    camera = cam
    domElement = element

    // Cập nhật vị trí camera ngay
    CameraController._applyOrbit()

    // Gắn event listeners
    element.addEventListener('mousedown', onMouseDown)
    element.addEventListener('mousemove', onMouseMove)
    element.addEventListener('mouseup', onMouseUp)
    element.addEventListener('mouseleave', onMouseUp)
    element.addEventListener('wheel', onWheel, { passive: false })
    window.addEventListener('keydown', onKeyDown)

    // Tắt context menu chuột phải để drag không bị gián đoạn
    element.addEventListener('contextmenu', e => e.preventDefault())

    console.log('[CameraController] Initialized')
  },

  /**
   * Update mỗi frame — xử lý smooth damping.
   * @param {number} delta - thời gian ms từ frame trước
   */
  update(delta) {
    if (Math.abs(azimuthVelocity) > 0.0001 ||
        Math.abs(elevationVelocity) > 0.0001 ||
        Math.abs(distanceVelocity) > 0.0001) {
      azimuth += azimuthVelocity
      elevation += elevationVelocity
      distance += distanceVelocity

      // Clamp elevation: [5°, 85°]
      elevation = Math.max(5 * DEG, Math.min(85 * DEG, elevation))

      // Clamp distance: [3, 80]
      distance = Math.max(3, Math.min(80, distance))

      azimuthVelocity *= DAMPING
      elevationVelocity *= DAMPING
      distanceVelocity *= DAMPING

      CameraController._applyOrbit()
    }
  },

  /** Reset về vị trí mặc định */
  resetToDefault() {
    azimuth = DEFAULT_AZIMUTH
    elevation = DEFAULT_ELEVATION
    distance = DEFAULT_DISTANCE
    target.set(0, 0, 0)
    azimuthVelocity = 0
    elevationVelocity = 0
    distanceVelocity = 0
    CameraController._applyOrbit()
  },

  getCamera: () => camera,

  /** Tính lại vị trí camera từ spherical coordinates */
  _applyOrbit() {
    const x = target.x + distance * Math.cos(elevation) * Math.sin(azimuth)
    const y = target.y + distance * Math.sin(elevation)
    const z = target.z + distance * Math.cos(elevation) * Math.cos(azimuth)
    camera.position.set(x, y, z)
    camera.lookAt(target)
  },
}

// ===== Mouse Handlers =====

function onMouseDown(e) {
  if (e.button === 2) {  // chuột phải
    isRightMouseDown = true
    lastMouseX = e.clientX
    lastMouseY = e.clientY
  }
}

function onMouseMove(e) {
  if (!isRightMouseDown) return

  const dx = e.clientX - lastMouseX
  const dy = e.clientY - lastMouseY
  lastMouseX = e.clientX
  lastMouseY = e.clientY

  // Cộng thẳng vào velocity để damping xử lý
  azimuthVelocity += dx * ORBIT_SPEED
  elevationVelocity -= dy * ORBIT_SPEED  // đảo dấu: kéo lên → nhìn lên
}

function onMouseUp(e) {
  isRightMouseDown = false
}

function onWheel(e) {
  e.preventDefault()
  distanceVelocity += e.deltaY * ZOOM_SPEED * 0.05
}

function onKeyDown(e) {
  if (e.key === 'f' || e.key === 'F') {
    CameraController.resetToDefault()
  }
}

export { CameraController }
