/**
 * InputHandler.js — Mouse Events → Raycaster → Custom Events
 *
 * Theo TASKS.md P1-06 và ARCHITECTURE.md 2.4:
 *
 * Events emitted (trên window):
 *   'build:hover'      → detail: { worldPos, gridPos: {x,y,z} } | null
 *   'build:click'      → detail: { worldPos, gridPos: {x,y,z} }
 *   'build:rightclick' → detail: { worldPos, gridPos: {x,y,z} } | null
 *   'ui:keydown'       → detail: { key, ctrl, shift }
 *
 * Quan trọng:
 * - Raycaster CHỈ check buildableObjects — không cast vào toàn scene
 * - Ghost cube phải được exclude khỏi buildableObjects
 * - mousemove throttle 16ms (~60fps) để không spam events
 */

import * as THREE from 'three'
// GridManager được inject thông qua setBuildableObjects — không import trực tiếp
// Thay vào đó snapToGrid tính y từ intersected object's userData

const CELL_SIZE = 1

let camera = null
let domElement = null
let buildableObjects = []  // array THREE.Object3D để raycast

const raycaster = new THREE.Raycaster()
const mouse = new THREE.Vector2()

// Throttle state
let lastHoverTime = 0
const HOVER_THROTTLE_MS = 16

// Track right mouse drag để phân biệt drag vs click
let rightMouseDownPos = { x: 0, y: 0 }
const DRAG_THRESHOLD = 5  // pixels

const InputHandler = {
  /**
   * @param {HTMLElement} element - canvas DOM element
   * @param {THREE.Camera} cam
   */
  init(element, cam) {
    camera = cam
    domElement = element

    element.addEventListener('mousemove', onMouseMove)
    element.addEventListener('click', onLeftClick)
    element.addEventListener('mousedown', onMouseDown)
    element.addEventListener('mouseup', onMouseUp)
    element.addEventListener('contextmenu', onRightClick)
    window.addEventListener('keydown', onKeyDown)

    console.log('[InputHandler] Initialized')
  },

  /**
   * Set danh sách objects để raycast.
   * Filter rules:
   * - name === 'ghostCube' → EXCLUDE (preview only)
   * - userData.ignoreRaycast → EXCLUDE (sky, fog, etc.)
   * - name === 'bridgeOverlay' → EXCLUDE (bridge là overlay, không buildable)
   * - oceanWater (name='oceanWater') → INCLUDE (build target chính)
   * @param {THREE.Object3D[]} objects
   */
  setBuildableObjects(objects) {
    buildableObjects = objects.filter((o) => {
      if (o.name === 'ghostCube') return false
      if (o.userData.ignoreRaycast) return false
      if (o.name === 'bridgeOverlay') return false
      // oceanWater (buildable=true) → INCLUDE
      return true
    })
  },

  dispose() {
    if (!domElement) return
    domElement.removeEventListener('mousemove', onMouseMove)
    domElement.removeEventListener('click', onLeftClick)
    domElement.removeEventListener('mousedown', onMouseDown)
    domElement.removeEventListener('mouseup', onMouseUp)
    domElement.removeEventListener('contextmenu', onRightClick)
    window.removeEventListener('keydown', onKeyDown)
    domElement = null
  },
}

// ===== Helpers =====

/**
 * Cập nhật normalized mouse coordinates từ DOM event.
 * Three.js dùng NDC: (-1, -1) bottom-left, (1, 1) top-right.
 */
function updateMouseCoords(event) {
  mouse.x = (event.clientX / domElement.clientWidth) * 2 - 1
  mouse.y = -(event.clientY / domElement.clientHeight) * 2 + 1
}

/**
 * Thực hiện raycast và trả về intersection đầu tiên.
 * @returns {THREE.Intersection | null}
 */
function castRay() {
  if (!camera || buildableObjects.length === 0) return null
  raycaster.setFromCamera(mouse, camera)
  const hits = raycaster.intersectObjects(buildableObjects, false)
  return hits.length > 0 ? hits[0] : null
}

/**
 * Snap world position về grid coordinate.
 * Nếu click trên water plane → y=0.
 * Nếu click trên building mesh → y từ userData.cellId (để BuildController tự tính topCell).
 *
 * BuildController.build() sẽ tự tìm topCell.y + 1 tại cột x,z.
 * Nên ở đây chỉ cần x, z là đủ.
 */
function snapToGrid(worldPos) {
  return {
    x: Math.round(worldPos.x / CELL_SIZE),
    y: 0,  // BuildController tự xác định y từ getTopCell()
    z: Math.round(worldPos.z / CELL_SIZE),
  }
}

// ===== Event Handlers =====

function onMouseMove(event) {
  const now = performance.now()
  if (now - lastHoverTime < HOVER_THROTTLE_MS) return
  lastHoverTime = now

  updateMouseCoords(event)
  const hit = castRay()

  if (hit) {
    const gridPos = snapToGrid(hit.point)
    window.dispatchEvent(new CustomEvent('build:hover', {
      detail: { worldPos: hit.point.clone(), gridPos },
    }))
  } else {
    // Không có gì dưới con trỏ → ẩn ghost
    window.dispatchEvent(new CustomEvent('build:hover', { detail: null }))
  }
}

function onMouseDown(event) {
  if (event.button === 2) {
    rightMouseDownPos = { x: event.clientX, y: event.clientY }
  }
}

function onMouseUp(event) {
  // Reset right mouse pos
  if (event.button === 2) {
    rightMouseDownPos = { x: -9999, y: -9999 }
  }
}

function onLeftClick(event) {
  updateMouseCoords(event)
  const hit = castRay()
  if (!hit) return

  const gridPos = snapToGrid(hit.point)
  window.dispatchEvent(new CustomEvent('build:click', {
    detail: { worldPos: hit.point.clone(), gridPos },
  }))
}

function onRightClick(event) {
  event.preventDefault()  // tắt context menu của OS

  // Phân biệt drag vs click: nếu chuột di chuyển > threshold thì là drag (orbit), không phải delete
  const dx = Math.abs(event.clientX - rightMouseDownPos.x)
  const dy = Math.abs(event.clientY - rightMouseDownPos.y)
  if (dx > DRAG_THRESHOLD || dy > DRAG_THRESHOLD) return

  updateMouseCoords(event)
  const hit = castRay()

  if (hit) {
    const gridPos = snapToGrid(hit.point)
    window.dispatchEvent(new CustomEvent('build:rightclick', {
      detail: { worldPos: hit.point.clone(), gridPos, object: hit.object },
    }))
  } else {
    window.dispatchEvent(new CustomEvent('build:rightclick', { detail: null }))
  }
}

function onKeyDown(event) {
  // Không emit nếu đang gõ trong input/textarea
  if (['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) return

  window.dispatchEvent(new CustomEvent('ui:keydown', {
    detail: {
      key: event.key,
      ctrl: event.ctrlKey,
      shift: event.shiftKey,
      alt: event.altKey,
    },
  }))
}

export { InputHandler }
