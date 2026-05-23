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
import { BuildingGrammarEngine } from './BuildingGrammarEngine.js'
import { VisualRecipeRenderer } from './VisualRecipeRenderer.js'
import { PrefabPlacementMode } from './PrefabPlacementMode.js'
import { AmbientLifeSystem } from '../world/AmbientLifeSystem.js'

const CELL_SIZE = 1
const CELL_HEIGHT = 1

let scene = null
let gridManager = null
let ruleEngine = null
let assetManager = null
let undoStack = null
let activeColor = '#F5DEB3'  // màu mặc định — Wheat
let activeMaterial = 'stone_quay'
let activeCategory = 'auto'
let activeAssetId = 'auto'
let activeAutoMode = true

const FOUNDATION_MATERIALS = new Set(['stone_quay', 'stone_plaza', 'rock_edge', 'harbor_pier'])
const BUILDING_MATERIAL_ALIASES = {
  stone_quay: 'plaster',
  stone_plaza: 'stone',
  rock_edge: 'stone',
  harbor_pier: 'wood',
  coast: 'plaster',
}
const ENTRANCE_DIRECTION_ORDER = [2, 1, 0, 3]

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
  build(gridPos, color, material) {
    const { x, z } = gridPos

    if (PrefabPlacementMode.isPrefabAsset(activeAssetId)) {
      return _buildPrefab(x, z, color || activeColor, activeAssetId)
    }

    // Xác định y: stack lên trên cell cao nhất tại cột x,z
    const topCell = gridManager.getTopCell(x, z)
    if (topCell?.metadata?.reservedBy && topCell.y === 0) {
      console.warn(`[BuildController] Cell ${topCell.id} is reserved by ${topCell.metadata.reservedBy}`)
      return null
    }
    const y = topCell ? topCell.y + 1 : 0

    // Không thể build lên đúng vị trí đã có cell
    if (gridManager.hasCell(x, y, z)) {
      console.warn(`[BuildController] Cell already exists at ${x}_${y}_${z}`)
      return null
    }

    const cellColor = color || activeColor
    const cellMaterial = _resolveMaterialForCell(y, material || activeMaterial)

    const autoSupportSpecs = y === 1 ? _planAutoEntranceSupport(x, z) : []
    const affectedCells = _collectCellsForRefresh(x, y, z)
    for (const spec of autoSupportSpecs) {
      affectedCells.push(..._collectCellsForRefresh(spec.x, spec.y, spec.z))
    }

    // Lưu snapshot của neighbors trước khi add (cho undo)
    const affectedSnapshots = _snapshotCells(affectedCells)

    const autoSupportCells = []
    for (const spec of autoSupportSpecs) {
      const support = gridManager.addCell(spec.x, spec.y, spec.z, cellColor)
      support.material = spec.material
      support.metadata = { ...(spec.metadata ?? {}) }
      _resolveAndRespawn(support)
      autoSupportCells.push(support)
    }

    // Thêm cell vào grid
    const cell = gridManager.addCell(x, y, z, cellColor)
    cell.material = cellMaterial

    // Resolve assetType + rotation cho cell mới VÀ tất cả neighbors bị ảnh hưởng
    _resolveAndRespawn(cell)
    _resolveNeighborsOf(x, y, z)
    for (const support of autoSupportCells) {
      _resolveNeighborsOf(support.x, support.y, support.z)
    }

    // Bridge detection
    _detectAndRenderBridges()

    // Undo stack
    undoStack.push({
      type: 'add',
      cell,
      autoCells: autoSupportCells.map(_snapshotCell),
      affectedSnapshots,
    })

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
    let affectedCells = _collectCellsForRefresh(x, y, z)
    if (topCell.metadata?.prefabInstanceId) {
      affectedCells = [
        ...affectedCells,
        ..._prefabOwnedCells(topCell.metadata.prefabInstanceId).flatMap(cell => _collectCellsForRefresh(cell.x, cell.y, cell.z)),
      ]
    }
    const affectedSnapshots = _snapshotCells(affectedCells)

    // Xóa mesh khỏi scene
    _removeMesh(topCell)

    // Xóa khỏi GridManager
    gridManager.removeCell(x, y, z)

    let removedAutoCells = []
    if (topCell.metadata?.prefabInstanceId) {
      removedAutoCells = _removePrefabOwnedAutoCells(topCell.metadata.prefabInstanceId)
      _clearPrefabReservations(topCell.metadata.prefabInstanceId)
    }

    // Remove khỏi buildable objects
    const idx = _buildableObjects.indexOf(topCell.mesh)
    if (idx !== -1) _buildableObjects.splice(idx, 1)

    // Re-resolve neighbors (tầng dưới, xung quanh)
    _resolveNeighborsOf(x, y, z)

    // Bridge re-detection
    _detectAndRenderBridges()

    undoStack.push({ type: 'remove', cell: topCell, affectedSnapshots, removedAutoCells })

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
      _removeAutoCells(command.autoCells, command.cell.id)
    } else if (command.type === 'prefab_add') {
      for (const snap of command.cells) {
        const cell = gridManager.getCell(snap.x, snap.y, snap.z)
        if (!cell) continue
        _removeMesh(cell)
        gridManager.removeCell(snap.x, snap.y, snap.z)
      }
    } else if (command.type === 'remove') {
      // Undo remove → re-add cell
      for (const snap of command.removedAutoCells ?? []) {
        if (gridManager.hasCell(snap.x, snap.y, snap.z)) continue
        const autoCell = gridManager.addCell(snap.x, snap.y, snap.z, snap.color)
        _applySnapshotToCell(autoCell, snap)
        _resolveAndRespawn(autoCell)
      }

      const { x, y, z, color, material } = command.cell
      const cell = gridManager.addCell(x, y, z, color)
      cell.material = material ?? _resolveMaterialForCell(y)
      cell.assetType = command.cell.assetType
      cell.rotation = command.cell.rotation
      cell.metadata = { ...(command.cell.metadata ?? {}) }
      _spawnMesh(cell)
    }

    // Restore affected neighbors
    _restoreSnapshots(command.affectedSnapshots)

    // Re-detect bridges
    _detectAndRenderBridges()

    // Play sound based on undo action
    if (command.type === 'add' || command.type === 'prefab_add') {
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
      const { x, y, z, color, material } = command.cell
      const restoredAuto = []
      for (const snap of command.autoCells ?? []) {
        if (gridManager.hasCell(snap.x, snap.y, snap.z)) continue
        const support = gridManager.addCell(snap.x, snap.y, snap.z, snap.color ?? color)
        _applySnapshotToCell(support, snap)
        restoredAuto.push(support)
      }
      for (const support of restoredAuto) _resolveAndRespawn(support)

      const cell = gridManager.addCell(x, y, z, color)
      cell.material = material ?? _resolveMaterialForCell(y)
      cell.metadata = { ...(command.cell.metadata ?? {}) }
      _resolveAndRespawn(cell)
    } else if (command.type === 'prefab_add') {
      const restored = []
      for (const snap of command.cells) {
        const cell = gridManager.addCell(snap.x, snap.y, snap.z, snap.color)
        _applySnapshotToCell(cell, snap)
        restored.push(cell)
      }
      for (const cell of restored) _resolveAndRespawn(cell)
    } else if (command.type === 'remove') {
      // Redo remove → delete cell
      const { x, y, z } = command.cell
      const cell = gridManager.getCell(x, y, z)
      if (cell) {
        _removeMesh(cell)
        gridManager.removeCell(x, y, z)
        if (cell.metadata?.prefabInstanceId) {
          _removePrefabOwnedAutoCells(cell.metadata.prefabInstanceId)
          _clearPrefabReservations(cell.metadata.prefabInstanceId)
        }
      }
    }

    if (command.type === 'prefab_add') {
      for (const snap of command.cells) {
        _resolveNeighborsOf(snap.x, snap.y, snap.z)
      }
    } else if (command.type === 'add' && command.autoCells?.length) {
      _resolveNeighborsOf(command.cell.x, command.cell.y, command.cell.z)
      for (const snap of command.autoCells) {
        _resolveNeighborsOf(snap.x, snap.y, snap.z)
      }
    } else {
      _resolveNeighborsOf(command.cell.x, command.cell.y, command.cell.z)
    }
    _detectAndRenderBridges()

    // Play sound based on redo action
    if (command.type === 'add' || command.type === 'prefab_add') {
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

  setActiveMaterial(materialId) {
    activeMaterial = materialId || 'stone_quay'
    _syncActiveKitForSelection()
  },

  getActiveMaterial: () => activeMaterial,

  setBuildSelection(selection = {}) {
    activeMaterial = selection.material || activeMaterial || 'stone_quay'
    activeCategory = selection.category || 'auto'
    activeAssetId = selection.assetId || 'auto'
    activeAutoMode = selection.autoMode !== false
    _syncActiveKitForSelection()
  },

  getBuildSelection: () => ({
    material: activeMaterial,
    category: activeCategory,
    assetId: activeAssetId,
    autoMode: activeAutoMode,
  }),

  /**
   * Trả về danh sách objects cho raycaster.
   * Gồm: tất cả block meshes (KHÔNG gồm bridge — overlay, không pickable).
   */
  getBuildableObjects: () => _buildableObjects,

  registerBuildableObject(object) {
    if (object && !_buildableObjects.includes(object)) {
      _buildableObjects.push(object)
    }
  },

  clearBuildableObjects() {
    _buildableObjects.length = 0
    _bridgeMeshes.clear()
  },
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

function _resolveMaterialForCell(y, requestedMaterial = activeMaterial) {
  const requested = requestedMaterial || 'stone_quay'

  if (y === 0) {
    return FOUNDATION_MATERIALS.has(requested) ? requested : 'stone_quay'
  }

  return BUILDING_MATERIAL_ALIASES[requested] ?? requested
}

function _planAutoEntranceSupport(x, z) {
  const supportedDirection = ENTRANCE_DIRECTION_ORDER.find(direction => {
    const [dx, dz] = _directionOffset(direction)
    const topCell = gridManager.getTopCell(x + dx, z + dz)
    return topCell?.y === 0 && !topCell.metadata?.reservedBy
  })
  if (supportedDirection !== undefined) return []

  const direction = ENTRANCE_DIRECTION_ORDER.find(candidate => {
    const [dx, dz] = _directionOffset(candidate)
    return !gridManager.getTopCell(x + dx, z + dz)
  })
  if (direction === undefined) return []

  const [dx, dz] = _directionOffset(direction)
  const ownerCellId = `${x}_1_${z}`
  const specs = [{
    x: x + dx,
    y: 0,
    z: z + dz,
    material: 'stone_quay',
    metadata: {
      autoGenerated: true,
      autoReason: 'entrance_path',
      ownerCellId,
      surfaceAssetType: 'surface_entrance',
      surfaceRole: 'entrance',
      surfaceDirection: direction,
    },
  }]

  if (activeMaterial === 'suburban') {
    const planned = new Set(specs.map(spec => `${spec.x}_${spec.y}_${spec.z}`))
    const back = _oppositeDirection(direction)
    const sideDirs = direction === 0 || direction === 1 ? [2, 3] : [0, 1]
    for (const lotDirection of [...sideDirs, back]) {
      const [ldx, ldz] = _directionOffset(lotDirection)
      const key = `${x + ldx}_0_${z + ldz}`
      if (planned.has(key) || gridManager.getTopCell(x + ldx, z + ldz)) continue
      planned.add(key)
      specs.push({
        x: x + ldx,
        y: 0,
        z: z + ldz,
        material: 'stone_quay',
        metadata: {
          autoGenerated: true,
          autoReason: lotDirection === back ? 'suburban_backyard' : 'suburban_side_yard',
          ownerCellId,
          surfaceAssetType: lotDirection === back ? 'surface_plaza_center' : 'surface_plaza_edge',
          surfaceRole: 'plaza',
          surfaceDirection: lotDirection,
        },
      })
    }
  }

  return specs
}

function _removeAutoCells(autoCellSnapshots = [], ownerCellId) {
  for (const snap of autoCellSnapshots) {
    const cell = gridManager.getCell(snap.x, snap.y, snap.z)
    if (!cell) continue
    if (!cell.metadata?.autoGenerated || cell.metadata?.ownerCellId !== ownerCellId) continue
    if (gridManager.getTopCell(cell.x, cell.z)?.id !== cell.id) continue

    _removeMesh(cell)
    gridManager.removeCell(cell.x, cell.y, cell.z)
    _resolveNeighborsOf(cell.x, cell.y, cell.z)
  }
}

function _prefabOwnedCells(prefabInstanceId) {
  return gridManager.getAllCells().filter(cell =>
    cell.metadata?.ownerPrefabInstanceId === prefabInstanceId ||
    cell.metadata?.reservedBy === prefabInstanceId
  )
}

function _removePrefabOwnedAutoCells(prefabInstanceId) {
  const removed = []
  for (const cell of _prefabOwnedCells(prefabInstanceId)) {
    if (!cell.metadata?.autoGenerated) continue
    if (gridManager.getTopCell(cell.x, cell.z)?.id !== cell.id) continue

    removed.push(_snapshotCell(cell))
    _removeMesh(cell)
    gridManager.removeCell(cell.x, cell.y, cell.z)
    _resolveNeighborsOf(cell.x, cell.y, cell.z)
  }
  return removed
}

function _buildPrefab(x, z, color, prefabId) {
  const plan = PrefabPlacementMode.createPlan(gridManager, x, z, prefabId)
  if (!plan) {
    console.warn(`[BuildController] Cannot place prefab ${prefabId} at ${x}_${z}`)
    return null
  }

  const affectedCells = []
  for (const pos of plan.affectedPositions) {
    affectedCells.push(..._collectCellsForRefresh(pos.x, pos.y, pos.z))
  }
  const affectedSnapshots = _snapshotCells(affectedCells)
  const addedCells = []

  for (const spec of plan.updateCells) {
    const cell = gridManager.getCell(spec.x, spec.y, spec.z)
    if (!cell) continue
    cell.metadata = { ...(cell.metadata ?? {}), ...(spec.metadata ?? {}) }
    _resolveAndRespawn(cell)
  }

  for (const spec of plan.addCells) {
    const cell = gridManager.addCell(spec.x, spec.y, spec.z, color)
    cell.material = spec.material
    cell.metadata = { ...(spec.metadata ?? {}) }
    _resolveAndRespawn(cell)
    addedCells.push(cell)
  }

  for (const pos of plan.affectedPositions) {
    _resolveNeighborsOf(pos.x, pos.y, pos.z)
  }

  _detectAndRenderBridges()
  undoStack.push({
    type: 'prefab_add',
    cells: addedCells.map(_snapshotCell),
    affectedSnapshots,
  })

  AudioSystem.playBuild()

  const houseCell = addedCells.find(cell => cell.metadata?.prefabId === prefabId) ?? null
  console.log(`[BuildController] Placed prefab ${prefabId} at ${x}_1_${z}`)
  return houseCell
}

function _clearPrefabReservations(prefabInstanceId) {
  for (const cell of gridManager.getAllCells()) {
    if (
      cell.metadata?.reservedBy !== prefabInstanceId &&
      cell.metadata?.ownerPrefabInstanceId !== prefabInstanceId
    ) continue

    const metadata = { ...(cell.metadata ?? {}) }
    delete metadata.reservedBy
    delete metadata.reservationRole
    delete metadata.prefabProfile
    delete metadata.ownerPrefabInstanceId
    delete metadata.ownerPrefabId
    delete metadata.surfaceAssetType
    delete metadata.surfaceRole
    delete metadata.surfaceDirection
    cell.metadata = metadata
    _resolveAndRespawn(cell)
  }
}

/**
 * Resolve và spawn/update mesh cho một cell.
 */
function _resolveAndRespawn(cell) {
  const neighbors = gridManager.getNeighbors(cell.x, cell.y, cell.z)
  const result = ruleEngine.resolve(cell, neighbors)
  const recipe = BuildingGrammarEngine.resolveCell(cell, gridManager, _buildContextSelection(cell))
  cell.visualRecipe = recipe
  cell.assetType = recipe.primaryAssetType ?? _applyGrammarOverrides(cell, neighbors, result.assetType)
  cell.rotation = recipe.primaryRotation ?? result.rotation

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
  const cellsToResolve = _collectCellsForRefresh(x, y, z)

  // Sắp xếp từ dưới lên trên (y tăng dần) để cấu trúc nền tảng được định hình trước
  cellsToResolve.sort((a, b) => a.y - b.y)

  for (const cell of cellsToResolve) {
    _resolveAndRespawn(cell)
  }
}

function _collectCellsForRefresh(x, y, z) {
  return BuildingGrammarEngine.resolveAffectedCells({ x, y, z }, gridManager)
}

/**
 * Spawn mesh từ AssetManager, add vào scene, chạy scale-in animation.
 * Theo TASKS.md P5-05: 0 → 1 trong 150ms, easeOutBack
 */
function _spawnMesh(cell) {
  const neighbors = gridManager.getNeighbors(cell.x, cell.y, cell.z)
  const recipe = cell.visualRecipe ?? BuildingGrammarEngine.resolveCell(cell, gridManager, _buildContextSelection(cell))
  cell.visualRecipe = recipe
  cell.assetType = recipe.primaryAssetType ?? cell.assetType
  cell.rotation = recipe.primaryRotation ?? cell.rotation

  const grammar = _buildGrammarContext(cell, neighbors, recipe)
  let proto
  try {
    proto = VisualRecipeRenderer.createCellGroup(cell, recipe, assetManager)
  } catch (err) {
    console.warn('[BuildController] VisualRecipeRenderer failed, using primary asset fallback', err)
    proto = assetManager.get(cell.assetType, cell.material, cell.id, grammar)
  }

  // Apply cell color
  _applyColor(proto, cell.color)

  // World position
  proto.position.set(
    cell.x * CELL_SIZE,
    cell.y * CELL_HEIGHT + CELL_HEIGHT / 2,
    cell.z * CELL_SIZE
  )
  proto.rotation.y = proto.userData?.visualRecipe ? 0 : cell.rotation

  // Tag userData
  proto.userData = {
    ...proto.userData,
    cellId: cell.id,
    isBuilding: true,
  }
  proto.name = 'building'

  // Bắt đầu từ scale=0 → animation smooth
  proto.scale.set(0, 0, 0)

  scene.add(proto)
  cell.mesh = proto
  AmbientLifeSystem.registerObject(proto, 'auto', { cellId: cell.id })

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

function _applyGrammarOverrides(cell, neighbors, assetType) {
  if (assetType !== 'wall_flat' && assetType !== 'wall_window') return assetType
  if (!_hasExteriorFace(neighbors)) return 'wall_flat'

  const access = _hasAccessFromExterior(cell, neighbors)
  if (access && _grammarHash(cell, 'door') % 5 === 0) {
    return 'wall_door'
  }

  if (assetType === 'wall_window' || _grammarHash(cell, 'window') % 4 === 0) {
    return 'wall_window'
  }

  return 'wall_flat'
}

function _buildGrammarContext(cell, neighbors, recipe = null) {
  const openDirections = _getOpenDirections(neighbors)
  const primaryOpenDirection = openDirections[0] ?? 2
  const hasTop = Boolean(neighbors.top)
  const hasBottom = Boolean(neighbors.bottom)
  const topologySignature = _topologySignature(neighbors)

  return {
    cellId: cell.id,
    height: cell.y,
    materialFamily: recipe?.materialFamily ?? cell.material ?? 'stone_quay',
    foundationStyle: recipe?.foundationStyle ?? (cell.material === 'harbor_pier' ? 'harbor_pier' : 'stone_quay'),
    activeKit: assetManager?.getActiveKit?.() ?? 'kenney-town-kit',
    surfaceStyle: recipe?.surfaceStyle ?? (assetManager?.getActiveKit?.() === 'kenney-city-suburban' ? 'suburban' : 'stone_quay'),
    topologySignature,
    rotation: cell.rotation,
    openDirections: recipe?.openDirections ?? openDirections,
    primaryOpenDirection: recipe?.primaryOpenDirection ?? primaryOpenDirection,
    isExterior: openDirections.length > 0,
    hasSupport: cell.y === 0 || hasBottom,
    topExposed: !hasTop,
    allowDoor: recipe?.allowDoor ?? _hasAccessFromExterior(cell, neighbors),
    allowWindow: recipe?.allowWindow ?? (cell.y > 0 && openDirections.length > 0),
    allowBalcony: recipe?.allowBalcony ?? (cell.y >= 2 && hasBottom && openDirections.length > 0 && _grammarHash(cell, 'balcony') % 3 === 0),
    useHighRoof: recipe?.useHighRoof ?? (!hasTop && cell.y >= 3),
    tower: recipe?.tower ?? (cell.y >= 3 && _countHorizontalNeighbors(neighbors) <= 1),
    visualRecipe: recipe,
    foundationLayer: recipe?.foundationLayer ?? [],
    surfaceLayer: recipe?.surfaceLayer ?? [],
    prefabLayer: recipe?.prefabLayer ?? [],
    facadeLayer: recipe?.facadeLayer ?? [],
    roofLayer: recipe?.roofLayer ?? [],
    propLayer: recipe?.propLayer ?? [],
  }
}

function _buildContextSelection(cell) {
  const activeKit = assetManager?.getActiveKit?.() ?? 'kenney-town-kit'
  const surfaceStyle = activeMaterial === 'suburban' || activeKit === 'kenney-city-suburban'
    ? 'suburban'
    : 'stone_quay'
  return {
    activeMaterial,
    activeCategory,
    activeAssetId,
    autoMode: activeAutoMode,
    activeKit,
    surfaceStyle,
    materialFamily: cell.y === 0 ? cell.material : _resolveMaterialForCell(cell.y, cell.material),
    foundationStyle: cell.y === 0 && cell.material === 'harbor_pier' ? 'harbor_pier' : 'stone_quay',
  }
}

function _syncActiveKitForSelection() {
  if (!assetManager?.setActiveKit) return
  const useSuburban = activeMaterial === 'suburban' ||
    activeCategory === 'prefab' ||
    PrefabPlacementMode.isPrefabAsset(activeAssetId)
  assetManager.setActiveKit(useSuburban ? 'kenney-city-suburban' : 'kenney-town-kit')
}

function _hasExteriorFace(neighbors) {
  return _getOpenDirections(neighbors).length > 0
}

function _hasAccessFromExterior(cell, neighbors) {
  if (cell.y !== 1) return false
  const openDirections = _getOpenDirections(neighbors)
  if (openDirections.length === 0) return false
  return Boolean(neighbors.bottom)
}

function _getOpenDirections(neighbors) {
  const open = []
  if (!neighbors.left) open.push(0)
  if (!neighbors.right) open.push(1)
  if (!neighbors.front) open.push(2)
  if (!neighbors.back) open.push(3)
  return open
}

function _directionOffset(direction) {
  if (direction === 0) return [-1, 0]
  if (direction === 1) return [1, 0]
  if (direction === 2) return [0, 1]
  return [0, -1]
}

function _oppositeDirection(direction) {
  if (direction === 0) return 1
  if (direction === 1) return 0
  if (direction === 2) return 3
  return 2
}

function _countHorizontalNeighbors(neighbors) {
  let count = 0
  if (neighbors.left) count++
  if (neighbors.right) count++
  if (neighbors.front) count++
  if (neighbors.back) count++
  return count
}

function _topologySignature(neighbors) {
  return [
    neighbors.top ? 'T1' : 'T0',
    neighbors.bottom ? 'B1' : 'B0',
    neighbors.left ? 'L1' : 'L0',
    neighbors.right ? 'R1' : 'R0',
    neighbors.front ? 'F1' : 'F0',
    neighbors.back ? 'K1' : 'K0',
  ].join('_')
}

function _grammarHash(cell, salt) {
  const input = `${cell.id}:${cell.material ?? 'stone_quay'}:${salt}`
  let hash = 5381
  for (let i = 0; i < input.length; i++) {
    hash = ((hash << 5) + hash) + input.charCodeAt(i)
    hash = hash & hash
  }
  return Math.abs(hash)
}

/**
 * Remove mesh: chạy scale-out animation 100ms easeInBack, rồi dispose.
 * Theo TASKS.md P5-05: scale 1→0.1,0,0.1 trong 100ms
 */
function _removeMesh(cell) {
  if (!cell.mesh) return

  const mesh = cell.mesh
  AmbientLifeSystem.unregisterObject(mesh)

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

      const bridgeMaterial = _bridgeMaterialFor(cellA, cellB)
      if (!bridgeMaterial) continue

      // Tạo bridge mesh (overlay)
      const key = `${Math.min(cellA.x,cellB.x)}_${y}_${Math.min(cellA.z,cellB.z)}__${Math.max(cellA.x,cellB.x)}_${y}_${Math.max(cellA.z,cellB.z)}`
      if (_bridgeMeshes.has(key)) continue

      const bridgeMesh = assetManager.get('bridge_span', bridgeMaterial, key)
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

function _bridgeMaterialFor(cellA, cellB) {
  if (
    activeMaterial === 'harbor_pier' ||
    cellA.material === 'harbor_pier' ||
    cellB.material === 'harbor_pier'
  ) {
    return 'harbor_pier'
  }
  return null
}

function _snapshotCells(cells) {
  const snapshots = []
  for (const cell of cells) {
    if (!cell) continue
    snapshots.push(_snapshotCell(cell))
  }
  return snapshots
}

function _restoreSnapshots(snapshots) {
  for (const snap of snapshots) {
    // Parse cellId "x_y_z"
    const [x, y, z] = snap.cellId.split('_').map(Number)
    const cell = gridManager.getCell(x, y, z)
    if (!cell) continue

    _applySnapshotToCell(cell, snap)
    cell.visualRecipe = BuildingGrammarEngine.resolveCell(cell, gridManager, _buildContextSelection(cell))

    // Respawn với assetType đã restore
    if (cell.mesh) _removeMesh(cell)
    _spawnMesh(cell)
  }
}

function _snapshotCell(cell) {
  return {
    cellId: cell.id,
    x: cell.x,
    y: cell.y,
    z: cell.z,
    color: cell.color,
    assetType: cell.assetType,
    rotation: cell.rotation,
    material: cell.material,
    metadata: { ...(cell.metadata ?? {}) },
  }
}

function _applySnapshotToCell(cell, snap) {
  cell.color = snap.color ?? cell.color
  cell.assetType = snap.assetType ?? cell.assetType
  cell.rotation = snap.rotation ?? cell.rotation
  if (snap.material) cell.material = snap.material
  cell.metadata = { ...(snap.metadata ?? {}) }
}

export { BuildController }
