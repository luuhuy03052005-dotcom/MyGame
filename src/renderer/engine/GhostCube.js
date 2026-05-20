/**
 * GhostCube.js — Hover Highlight Preview
 *
 * Theo TASKS.md P1-07:
 * - BoxGeometry(1, 1, 1) với MeshBasicMaterial semi-transparent
 * - Hiển thị vị trí buildable dưới con trỏ
 * - Update mỗi 'build:hover' event
 * - name: 'ghostCube' — phải exclude khỏi raycaster targets
 * - Không có shadow
 *
 * Public API:
 *   GhostCube.init(scene)
 *   GhostCube.dispose()
 */

import * as THREE from 'three'

const CELL_SIZE = 1
const CELL_HEIGHT = 1

let mesh = null
let scene = null
let isVisible = false

const GhostCube = {
  /**
   * @param {THREE.Scene} sceneRef
   */
  init(sceneRef) {
    scene = sceneRef

    const geometry = new THREE.BoxGeometry(
      CELL_SIZE * 0.99,   // hơi nhỏ hơn để thấy grid lines
      CELL_HEIGHT * 0.99,
      CELL_SIZE * 0.99
    )

    // MeshBasicMaterial — không bị ảnh hưởng bởi lighting
    // Lý do: ghost cube cần visible rõ ngay cả ở góc tối
    const material = new THREE.MeshBasicMaterial({
      color: 0xFFFFFF,
      transparent: true,
      opacity: 0.35,
      depthWrite: false,  // không ghi depth buffer — tránh artifact
    })

    // Wireframe overlay để thấy rõ hơn
    const wireframeGeo = new THREE.BoxGeometry(CELL_SIZE, CELL_HEIGHT, CELL_SIZE)
    const wireframeMat = new THREE.MeshBasicMaterial({
      color: 0xFFFFFF,
      transparent: true,
      opacity: 0.6,
      wireframe: true,
    })
    const wireframe = new THREE.Mesh(wireframeGeo, wireframeMat)

    mesh = new THREE.Mesh(geometry, material)
    mesh.name = 'ghostCube'       // tag để exclude khỏi raycaster
    mesh.castShadow = false       // ghost không có shadow
    mesh.receiveShadow = false
    mesh.visible = false          // ẩn khi không hover
    mesh.add(wireframe)

    scene.add(mesh)

    // Listen build:hover events
    window.addEventListener('build:hover', onBuildHover)

    console.log('[GhostCube] Initialized')
  },

  dispose() {
    window.removeEventListener('build:hover', onBuildHover)
    if (mesh && scene) {
      scene.remove(mesh)
      mesh.geometry.dispose()
      mesh.material.dispose()
      mesh = null
    }
  },

  getMesh: () => mesh,
}

// ===== Event Handler =====

function onBuildHover(event) {
  if (!mesh) return

  const detail = event.detail

  if (!detail) {
    // Không có buildable surface dưới con trỏ
    if (isVisible) {
      mesh.visible = false
      isVisible = false
    }
    return
  }

  const { gridPos } = detail

  // Snap ghost cube về đúng grid position
  // worldX = gridPos.x * CELL_SIZE, worldY = gridPos.y * CELL_HEIGHT + 0.5 (center of cube)
  mesh.position.set(
    gridPos.x * CELL_SIZE,
    gridPos.y * CELL_HEIGHT + CELL_HEIGHT / 2,
    gridPos.z * CELL_SIZE
  )

  if (!isVisible) {
    mesh.visible = true
    isVisible = true
  }
}

export { GhostCube }
