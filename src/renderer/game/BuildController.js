/**
 * BuildController.js — Orchestrator cho build/delete flow
 *
 * Theo ARCHITECTURE.md 2.1 và TASKS.md P2-03/P3-07.
 *
 * Data Flow:
 *   'build:click' → BuildController.build(gridPos, color)
 *     → GridManager.addCell()
 *     → ProceduralRuleEngine.resolve() cho cell + neighbors lân cận
 *     → AssetManager.get() → spawn mesh → scene.add()
 *     → _detectAndRenderBridges()
 *     → UndoRedoStack.push()
 *
 *   'build:rightclick' → BuildController.delete(gridPos)
 *     → xóa cell từ GridManager
 *     → scene.remove() + dispose mesh
 *     → re-resolve neighbors
 *     → _detectAndRenderBridges()
 *     → UndoRedoStack.push()
 *
 * Bridge là DERIVED OVERLAY — không phải cell thật.
 * (theo RULES_REFERENCE.md mục 8 và deep-research-report (1).md)
 *
 * Public API:
 *   BuildController.init(scene, gridManager, ruleEngine, assetManager, undoStack)
 *   BuildController.build(gridPos, color) → Cell | null
 *   BuildController.delete(gridPos) → Cell | null
 *   BuildController.undo()
 *   BuildController.redo()
 *   BuildController.getBuildableObjects() → THREE.Object3D[]
 *   BuildController.setActiveColor(hex)
 */

import * as THREE from 'three'
import { RenderLoop }  from '../engine/RenderLoop.js'
import { AudioSystem } from '../engine/AudioSystem.js'
import { ParticleSystem } from '../engine/ParticleSystem.js'

const CELL_SIZE = 1
const CELL_HEIGHT = 1

let scene = null
let gridManager = null
let ruleEngine = null
let assetManager = null
let undoStack = null
let activeColor = '#F5DEB3'  // màu mặc định — Wheat

// Buildable objects cho raycaster — water + tất cả block meshes
const _buildableObjects = []

// Bridge overlay meshes — không phải real cells
// key: "x1_y_z1__x2_y_z2" (sorted), value: THREE.Object3D
const _bridgeMeshes = new Map()

const BuildController = {
  /**
   * @param {THREE.Scene} sceneRef
   * @param {object} gm - GridManager
   * @param {object} re - ProceduralRuleEngine
   * @param {object} am - AssetManager
   * @param {object} us - UndoRedoStack
   */
  init(sceneRef, gm, re, am, us) {
    scene = sceneRef
    gridManager = gm
    ruleEngine = re
    assetManager = am
    undoStack = us

    // Listen cho input events
    window.addEventListener('build:click', _onBuildClick)
    window.addEventListener('build:rightclick', _onBuildRightClick)

    console.log('[BuildController] Initialized')
  },

  /**
   * Build một block tại gridPos.
   * @param {{ x, y, z }} gridPos
   * @param {string} [color] - override color (optional, dùng activeColor nếu không có)
   * @returns {import('./Cell.js').Cell | null}
   */
  build(gridPos, color) {
    const { x, z } = gridPos

    // Xác định y: stack lên trên cell cao nhất tại cột x,z
    const topCell = gridManager.getTopCell(x, z)
    const y = topCell ? topCell.y + 1 : 0

    // Không thể build lên đúng vị trí đã có cell
    if (gridManager.hasCell(x, y, z)) {
      console.warn(`[BuildController] Cell already exists at ${x}_${y}_${z}`)
      return null
    }

    const cellColor = color || activeColor

    // Lưu snapshot của neighbors trước khi add (cho undo)
    const neighbors6 = gridManager.getNeighbors(x, y, z)
    const affectedSnapshots = _snapshotNeighbors(neighbors6)

    // Thêm cell vào grid
    const cell = gridManager.addCell(x, y, z, cellColor)

    // Resolve assetType + rotation cho cell mới VÀ tất cả neighbors bị ảnh hưởng
    _resolveAndRespawn(cell)
    _resolveNeighborsOf(x, y, z)

    // Bridge detection
    _detectAndRenderBridges()

    // Undo stack
    undoStack.push({ type: 'add', cell, affectedSnapshots })

    // Play synthesized Plop sound sweep (P5-06)
    AudioSystem.playBuild()

    console.log(`[BuildController] Built ${cell.id} → ${cell.assetType}`)
    return cell
  },

  /**
   * Delete block tại gridPos.
   * Nếu có stack, xóa tầng cao nhất tại x,z.
   * @param {{ x, y, z }} gridPos - gridPos.y được ignore, dùng topCell
   * @returns {import('./Cell.js').Cell | null}
   */
  delete(gridPos) {
    const { x, z } = gridPos

    // Tìm cell cao nhất tại cột x,z
    const topCell = gridManager.getTopCell(x, z)
    if (!topCell) return null

    const { y } = topCell

    // Snapshot trước khi xóa
    const neighbors6 = gridManager.getNeighbors(x, y, z)
    const affectedSnapshots = _snapshotNeighbors(neighbors6)

    // Xóa mesh khỏi scene
    _removeMesh(topCell)

    // Xóa khỏi GridManager
    gridManager.removeCell(x, y, z)

    // Remove khỏi buildable objects
    const idx = _buildableObjects.indexOf(topCell.mesh)
    if (idx !== -1) _buildableObjects.splice(idx, 1)

    // Re-resolve neighbors (tầng dưới, xung quanh)
    _resolveNeighborsOf(x, y, z)

    // Bridge re-detection
    _detectAndRenderBridges()

    undoStack.push({ type: 'remove', cell: topCell, affectedSnapshots })

    // Play synthesized Poof sound sweep (P5-06)
    AudioSystem.playDelete()

    console.log(`[BuildController] Deleted ${topCell.id}`)
    return topCell
  },

  /** Undo last action */
  undo() {
    const command = undoStack.undo()
    if (!command) return

    if (command.type === 'add') {
      // Undo add → delete cell
      const { x, y, z } = command.cell
      const cell = gridManager.getCell(x, y, z)
      if (cell) {
        _removeMesh(cell)
        gridManager.removeCell(x, y, z)
      }
    } else if (command.type === 'remove') {
      // Undo remove → re-add cell
      const { x, y, z, color } = command.cell
      const cell = gridManager.addCell(x, y, z, color)
      cell.assetType = command.cell.assetType
      cell.rotation = command.cell.rotation
      _spawnMesh(cell)
    }

    // Restore affected neighbors
    _restoreSnapshots(command.affectedSnapshots)

    // Re-detect bridges
    _detectAndRenderBridges()

    // Play sound based on undo action
    if (command.type === 'add') {
      AudioSystem.playDelete()
    } else if (command.type === 'remove') {
      AudioSystem.playBuild()
    }
  },

  /** Redo last undone action */
  redo() {
    const command = undoStack.redo()
    if (!command) return

    if (command.type === 'add') {
      // Redo add → re-add cell
      const { x, y, z, color } = command.cell
      const cell = gridManager.addCell(x, y, z, color)
      _resolveAndRespawn(cell)
    } else if (command.type === 'remove') {
      // Redo remove → delete cell
      const { x, y, z } = command.cell
      const cell = gridManager.getCell(x, y, z)
      if (cell) {
        _removeMesh(cell)
        gridManager.removeCell(x, y, z)
      }
    }

    _resolveNeighborsOf(command.cell.x, command.cell.y, command.cell.z)
    _detectAndRenderBridges()

    // Play sound based on redo action
    if (command.type === 'add') {
      AudioSystem.playBuild()
    } else if (command.type === 'remove') {
      AudioSystem.playDelete()
    }
  },

  /** @param {string} hex - "#RRGGBB" */
  setActiveColor(hex) {
    activeColor = hex
  },

  getActiveColor: () => activeColor,

  /**
   * Trả về danh sách objects cho raycaster.
   * Gồm: tất cả block meshes (KHÔNG gồm bridge — overlay, không pickable).
   */
  getBuildableObjects: () => _buildableObjects,
}

// ===== Internal Helpers =====

function _onBuildClick(event) {
  if (!event.detail) return
  BuildController.build(event.detail.gridPos)
}

function _onBuildRightClick(event) {
  if (!event.detail || !event.detail.object) return
  // Nếu click trên một block mesh → xóa tầng trên cùng của cột đó
  const { gridPos } = event.detail
  BuildController.delete(gridPos)
}

/**
 * Resolve và spawn/update mesh cho một cell.
 */
function _resolveAndRespawn(cell) {
  const neighbors = gridManager.getNeighbors(cell.x, cell.y, cell.z)
  const result = ruleEngine.resolve(cell, neighbors)
  cell.assetType = result.assetType
  cell.rotation = result.rotation

  // Xóa mesh cũ nếu có
  if (cell.mesh) _removeMesh(cell)

  // Spawn mesh mới
  _spawnMesh(cell)
}

/**
 * Re-resolve tất cả neighbors của cell tại x,y,z.
 * Cần gọi sau mỗi add/delete vì assetType của neighbors có thể thay đổi.
 */
function _resolveNeighborsOf(x, y, z) {
  // CLARIFICATION-03: Re-resolve toàn bộ 5 cột: chính nó (x, z) và 4 hướng lân cận
  const columns = [
    [x, z],
    [x + 1, z],
    [x - 1, z],
    [x, z + 1],
    [x, z - 1]
  ]

  const cellsToResolve = []
  for (const cell of gridManager.getAllCells()) {
    const match = columns.some(([cx, cz]) => cell.x === cx && cell.z === cz)
    if (match) {
      cellsToResolve.push(cell)
    }
  }

  // Sắp xếp từ dưới lên trên (y tăng dần) để cấu trúc nền tảng được định hình trước
  cellsToResolve.sort((a, b) => a.y - b.y)

  for (const cell of cellsToResolve) {
    _resolveAndRespawn(cell)
  }
}

/**
 * Spawn mesh từ AssetManager, add vào scene, chạy scale-in animation.
 * Theo TASKS.md P5-05: 0 → 1 trong 150ms, easeOutBack
 */
function _spawnMesh(cell) {
  const proto = assetManager.get(cell.assetType)

  // Apply cell color
  _applyColor(proto, cell.color)

  // World position
  proto.position.set(
    cell.x * CELL_SIZE,
    cell.y * CELL_HEIGHT + CELL_HEIGHT / 2,
    cell.z * CELL_SIZE
  )
  proto.rotation.y = cell.rotation

  // Tag userData
  proto.userData = { cellId: cell.id, isBuilding: true }
  proto.name = 'building'

  // Bắt đầu từ scale=0 → animation smooth
  proto.scale.set(0, 0, 0)

  scene.add(proto)
  cell.mesh = proto

  // Add vào buildable objects
  if (!_buildableObjects.includes(proto)) {
    _buildableObjects.push(proto)
  }

  // Phase B: Particle System
  ParticleSystem.spawnDust({ position: proto.position, color: cell.color, count: 12 })

  // Phase A: Squash & Stretch Animation
  RenderLoop.addTweenSequence([
    {
      object: proto.scale,
      from: { x: 0, y: 0, z: 0 },
      to:   { x: 1.2, y: 0.7, z: 1.2 },
      duration: 120,
      easing: 'power2Out',
    },
    {
      object: proto.scale,
      to:   { x: 0.9, y: 1.15, z: 0.9 },
      duration: 100,
      easing: 'power2InOut',
    },
    {
      object: proto.scale,
      to:   { x: 1, y: 1, z: 1 },
      duration: 120,
      easing: 'elasticOut',
    },
  ])
}

/**
 * Remove mesh: chạy scale-out animation 100ms easeInBack, rồi dispose.
 * Theo TASKS.md P5-05: scale 1→0.1,0,0.1 trong 100ms
 */
function _removeMesh(cell) {
  if (!cell.mesh) return

  const mesh = cell.mesh

  // Xóa ngay khỏi buildable objects (không pickable khi đang xóa)
  const idx = _buildableObjects.indexOf(mesh)
  if (idx !== -1) _buildableObjects.splice(idx, 1)

  cell.mesh = null  // clear reference

  // Phase B: Particle System
  ParticleSystem.spawnDust({ position: mesh.position, color: cell.color, count: 12 })

  // Phase A: Squash & Stretch Animation for Despawn
  RenderLoop.addTweenSequence([
    {
      object: mesh.scale,
      from: { x: mesh.scale.x, y: mesh.scale.y, z: mesh.scale.z },
      to:   { x: 1.15, y: 0.85, z: 1.15 },
      duration: 80,
      easing: 'power2Out',
    },
    {
      object: mesh.scale,
      to:   { x: 0, y: 0, z: 0 },
      duration: 120,
      easing: 'power2In',
      onComplete() {
        // Dispose + remove SAU khi animation xong
        mesh.traverse((obj) => {
          if (obj.isMesh) {
            obj.geometry?.dispose()
            if (Array.isArray(obj.material)) {
              obj.material.forEach(m => m.dispose())
            } else {
              obj.material?.dispose()
            }
          }
        })
        scene.remove(mesh)
      },
    },
  ])
}

/**
 * Apply hex color vào tất cả mesh trong object có userData.isColorable.
 */
function _applyColor(obj, hexColor) {
  const color = new THREE.Color(hexColor)
  obj.traverse((child) => {
    if (child.isMesh && child.userData.isColorable) {
      // Clone material để tránh share màu giữa các cells
      child.material = child.material.clone()
      child.material.color = color
    }
  })
}

/**
 * Bridge detection — DERIVED OVERLAY (RULES_REFERENCE.md mục 8)
 * Rebuild hoàn toàn mỗi lần.
 */
function _detectAndRenderBridges() {
  // Step 1: Clear all existing bridge overlays
  _bridgeMeshes.forEach(mesh => {
    scene.remove(mesh)
    mesh.geometry?.dispose()
    mesh.material?.dispose()
  })
  _bridgeMeshes.clear()

  // Step 2: Connected Components tìm các cụm cell cùng độ cao
  const allCells = gridManager.getAllCells()
  if (allCells.length < 2) return

  // Group cells by Y level
  const byY = new Map()
  for (const cell of allCells) {
    if (!byY.has(cell.y)) byY.set(cell.y, [])
    byY.get(cell.y).push(cell)
  }

  // Step 3: Scan bridge opportunities tại mỗi Y level
  for (const [y, cells] of byY.entries()) {
    const components = _findComponents(cells)

    if (components.length < 2) continue

    // Check từng cặp cụm
    for (let i = 0; i < components.length; i++) {
      for (let j = i + 1; j < components.length; j++) {
        _checkAndRenderBridge(components[i], components[j], y)
      }
    }
  }
}

function _findComponents(cells) {
  const cellSet = new Set(cells.map(c => c.id))
  const visited = new Set()
  const components = []

  for (const cell of cells) {
    if (visited.has(cell.id)) continue

    const component = []
    const queue = [cell]
    visited.add(cell.id)

    while (queue.length > 0) {
      const current = queue.shift()
      component.push(current)

      // Neighbors theo X và Z (cùng Y)
      const dirs = [[1,0], [-1,0], [0,1], [0,-1]]
      for (const [dx, dz] of dirs) {
        const nId = `${current.x + dx}_${current.y}_${current.z + dz}`
        if (cellSet.has(nId) && !visited.has(nId)) {
          visited.add(nId)
          queue.push(gridManager.getCell(current.x + dx, current.y, current.z + dz))
        }
      }
    }

    components.push(component)
  }

  return components
}

function _checkAndRenderBridge(compA, compB, y) {
  for (const cellA of compA) {
    for (const cellB of compB) {
      if (cellA.y !== cellB.y) continue

      const dx = Math.abs(cellA.x - cellB.x)
      const dz = Math.abs(cellA.z - cellB.z)

      let bridgeX, bridgeZ, rotation

      if (dx === 2 && cellA.z === cellB.z) {
        // Bridge theo X
        bridgeX = Math.min(cellA.x, cellB.x) + 1
        bridgeZ = cellA.z
        rotation = 0  // NORTH
      } else if (dz === 2 && cellA.x === cellB.x) {
        // Bridge theo Z
        bridgeX = cellA.x
        bridgeZ = Math.min(cellA.z, cellB.z) + 1
        rotation = Math.PI / 2  // EAST
      } else {
        continue
      }

      // Không spawn bridge nếu đã có cell tại vị trí đó
      if (gridManager.hasCell(bridgeX, y, bridgeZ)) continue

      // Tạo bridge mesh (overlay)
      const key = `${Math.min(cellA.x,cellB.x)}_${y}_${Math.min(cellA.z,cellB.z)}__${Math.max(cellA.x,cellB.x)}_${y}_${Math.max(cellA.z,cellB.z)}`
      if (_bridgeMeshes.has(key)) continue

      const bridgeMesh = assetManager.get('bridge_span')
      bridgeMesh.position.set(bridgeX * CELL_SIZE, y * CELL_HEIGHT + CELL_HEIGHT / 2, bridgeZ * CELL_SIZE)
      bridgeMesh.rotation.y = rotation
      bridgeMesh.name = 'bridgeOverlay'
      bridgeMesh.userData.isBridge = true

      scene.add(bridgeMesh)
      _bridgeMeshes.set(key, bridgeMesh)

      // Chỉ cần 1 bridge giữa 2 cụm tại vị trí này → return
      return
    }
  }
}

function _snapshotNeighbors(neighbors) {
  const snapshots = []
  for (const cell of Object.values(neighbors)) {
    if (cell) {
      snapshots.push({
        cellId: cell.id,
        assetType: cell.assetType,
        rotation: cell.rotation,
      })
    }
  }
  return snapshots
}

function _restoreSnapshots(snapshots) {
  for (const snap of snapshots) {
    // Parse cellId "x_y_z"
    const [x, y, z] = snap.cellId.split('_').map(Number)
    const cell = gridManager.getCell(x, y, z)
    if (!cell) continue

    cell.assetType = snap.assetType
    cell.rotation = snap.rotation

    // Respawn với assetType đã restore
    if (cell.mesh) _removeMesh(cell)
    _spawnMesh(cell)
  }
}

export { BuildController }
