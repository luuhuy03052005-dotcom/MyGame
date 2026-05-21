/**
 * ProceduralRuleEngine.js — Singleton quyết định assetType và rotation
 *
 * Theo RULES_REFERENCE.md — nguồn sự thật duy nhất cho rules.
 *
 * Public API:
 *   ProceduralRuleEngine.resolve(cell, neighbors) → { assetType, rotation }
 *   ProceduralRuleEngine.resolveAll(gridManager) → void  (re-resolve toàn bộ grid)
 *
 * Tính tất định: KHÔNG dùng Math.random() — chỉ dùng cellHash() cho wall_window.
 */

const PI2 = Math.PI / 2

// === Rotation Constants (theo RULES_REFERENCE.md mục 4) ===
const ROTATION = {
  NORTH: 0,            // hướng về back (Z-)
  EAST:  PI2,          // hướng về right (X+)
  SOUTH: Math.PI,      // hướng về front (Z+)
  WEST:  PI2 * 3,      // hướng về left (X-)
}

const ProceduralRuleEngine = {
  /**
   * Resolve assetType và rotation cho một cell.
   * @param {import('./Cell.js').Cell} cell
   * @param {{ top, bottom, left, right, front, back }} neighbors
   * @returns {{ assetType: string, rotation: number }}
   */
  resolve(cell, neighbors) {
    // 1. Foundation check
    if (cell.y === 0) {
      return _resolveFoundation(cell, neighbors)
    }

    // 2. Roof check (không có top neighbor)
    if (!neighbors.top) {
      return _resolveRoof(neighbors)
    }

    // 3. Wall (mọi trường hợp còn lại — có top neighbor)
    return _resolveWall(cell, neighbors)
  },

  /**
   * Re-resolve tất cả cells trong GridManager.
   * Gọi sau mỗi build/delete để cập nhật neighbors đã thay đổi.
   * @param {import('./GridManager.js').GridManager} gridManager
   * @param {Function} onResolved - callback(cell, result) để spawn/update mesh
   */
  resolveAll(gridManager, onResolved) {
    for (const cell of gridManager.getAllCells()) {
      const neighbors = gridManager.getNeighbors(cell.x, cell.y, cell.z)
      const result = ProceduralRuleEngine.resolve(cell, neighbors)
      cell.assetType = result.assetType
      cell.rotation = result.rotation
      if (onResolved) onResolved(cell, result)
    }
  },
}

// ===== Foundation Rules (RULES_REFERENCE.md mục 5) =====
// F-2 TRƯỚC, F-1 SAU — "edge wins over interior"

function _resolveFoundation(cell, neighbors) {
  const open = _getOpenDirections(neighbors)
  const count = open.length

  if (count === 0) {
    return { assetType: 'foundation_plaza_tile', rotation: 0 }
  }

  if (count === 1) {
    return {
      assetType: 'foundation_seawall_straight',
      rotation: _calcRotationFromOpenDir(open),
    }
  }

  if (count === 2) {
    if (_areOppositeDirections(open[0], open[1])) {
      return {
        assetType: 'foundation_seawall_straight',
        rotation: _calcRotationFromOpenDir(open),
      }
    }
    return {
      assetType: 'foundation_seawall_corner',
      rotation: _calcFoundationCornerRotation(open),
    }
  }

  if (count === 3) {
    return {
      assetType: 'foundation_seawall_end',
      rotation: _calcRotationFromOpenDir(open),
    }
  }

  return { assetType: 'foundation_seawall_round', rotation: 0 }
}

// ===== Roof Rules (RULES_REFERENCE.md mục 7) =====

function _resolveRoof(neighbors) {
  const N = _countHorizontalNeighbors(neighbors)

  if (N === 0 || N === 1) {
    const open = _getOpenDirections(neighbors)
    return {
      assetType: 'roof_peak',
      rotation: N === 0 ? 0 : _calcRotationFromOpenDir(open),
    }
  }

  if (N === 2) {
    const LR = neighbors.left && neighbors.right
    const FB = neighbors.front && neighbors.back

    if (LR || FB) {
      // 2 neighbor đối diện nhau → roof_gable
      return {
        assetType: 'roof_gable',
        rotation: LR ? ROTATION.NORTH : ROTATION.EAST,
      }
    }
    // 2 neighbor liền kề (góc) → roof_hip_corner
    return {
      assetType: 'roof_hip_corner',
      rotation: _calcCornerRotation(neighbors),
    }
  }

  if (N === 3) {
    // Ngã ba → roof_t_junction
    return {
      assetType: 'roof_t_junction',
      rotation: _calcTJunctionRotation(neighbors),
    }
  }

  // N === 4 → roof_flat
  return { assetType: 'roof_flat', rotation: 0 }
}

// ===== Wall Rules (RULES_REFERENCE.md mục 6) =====

function _resolveWall(cell, neighbors) {
  const y = cell.y
  const open = _getOpenDirections(neighbors)

  // W-1: corner (Ưu tiên corner hơn foundation_wall)
  if (_isCorner(neighbors)) {
    return {
      assetType: 'wall_corner',
      rotation: _calcCornerRotation(neighbors),
    }
  }

  // Sub-rule foundation_wall cho cell không có bottom neighbor (hoặc mọc lơ lửng) (FIX-02)
  if (!neighbors.bottom && y > 0) {
    return {
      assetType: 'foundation_wall',
      rotation: open.length > 0 ? _calcRotationFromOpenDir(open) : 0,
    }
  }

  // Phase C: Seeded Façade Variation
  // Tính topology signature để đảm bảo tính deterministic theo neighbors
  const top = neighbors.top ? 1 : 0
  const bot = neighbors.bottom ? 1 : 0
  const left = neighbors.left ? 1 : 0
  const right = neighbors.right ? 1 : 0
  const front = neighbors.front ? 1 : 0
  const back = neighbors.back ? 1 : 0
  const topologySignature = `T${top}_BT${bot}_L${left}_R${right}_F${front}_BK${back}`

  // W-2: Seeded Façade Variation (deterministic hash kết hợp cell.id và topologySignature)
  if (open.length > 0) {
    // 40% window (hash % 10 < 4), 60% flat
    if (_facadeHash(cell.id, topologySignature) % 10 < 4) {
      return {
        assetType: 'wall_window',
        rotation: _calcRotationFromOpenDir(open),
      }
    } else {
      return {
        assetType: 'wall_flat',
        rotation: _calcRotationFromOpenDir(open),
      }
    }
  }

  // W-DEFAULT: wall_flat (nếu kẹt giữa 4 bề)
  return {
    assetType: 'wall_flat',
    rotation: 0,
  }
}

// ===== Helpers =====

function _countHorizontalNeighbors(neighbors) {
  let count = 0
  if (neighbors.left)  count++
  if (neighbors.right) count++
  if (neighbors.front) count++
  if (neighbors.back)  count++
  return count
}

// Direction index: 0=left, 1=right, 2=front, 3=back
function _getOpenDirections(neighbors) {
  const open = []
  if (!neighbors.left)  open.push(0)
  if (!neighbors.right) open.push(1)
  if (!neighbors.front) open.push(2)
  if (!neighbors.back)  open.push(3)
  return open
}

const _dirToRotation = [
  Math.PI / 2,        // LEFT (0)
  -Math.PI / 2,       // RIGHT (1)
  0,                  // FRONT (2)
  Math.PI             // BACK (3)
]

function _calcRotationFromOpenDir(openDirections) {
  return _dirToRotation[openDirections[0]] ?? 0
}

function _isCorner(neighbors) {
  return (
    (neighbors.left  && neighbors.front) ||
    (neighbors.left  && neighbors.back)  ||
    (neighbors.right && neighbors.front) ||
    (neighbors.right && neighbors.back)
  )
}

function _calcCornerRotation(neighbors) {
  if (!neighbors.left  && !neighbors.front) return ROTATION.NORTH  // góc right-back
  if (!neighbors.left  && !neighbors.back)  return ROTATION.EAST   // góc right-front
  if (!neighbors.right && !neighbors.front) return ROTATION.WEST   // góc left-back
  if (!neighbors.right && !neighbors.back)  return ROTATION.SOUTH  // góc left-front
  return 0
}

function _calcTJunctionRotation(neighbors) {
  if (!neighbors.left)  return ROTATION.WEST
  if (!neighbors.right) return ROTATION.EAST
  if (!neighbors.front) return ROTATION.SOUTH
  if (!neighbors.back)  return ROTATION.NORTH
  return 0
}

function _areOppositeDirections(a, b) {
  return (
    (a === 0 && b === 1) ||
    (a === 1 && b === 0) ||
    (a === 2 && b === 3) ||
    (a === 3 && b === 2)
  )
}

function _calcFoundationCornerRotation(openDirections) {
  const dirs = new Set(openDirections)
  if (dirs.has(2) && dirs.has(1)) return ROTATION.NORTH
  if (dirs.has(1) && dirs.has(3)) return ROTATION.EAST
  if (dirs.has(3) && dirs.has(0)) return ROTATION.SOUTH
  if (dirs.has(0) && dirs.has(2)) return ROTATION.WEST
  return _calcRotationFromOpenDir(openDirections)
}

/**
 * djb2 hash từ cell.id string.
 * Deterministic — cùng id → luôn cùng kết quả.
 * Dùng cho wall_window ~40% distribution mà không cần randomSeed.
 *
 * @param {string} cellId - "x_y_z"
 * @returns {number} non-negative integer
 */
function _cellHash(cellId) {
  let hash = 5381
  for (let i = 0; i < cellId.length; i++) {
    hash = ((hash << 5) + hash) + cellId.charCodeAt(i)
    hash = hash & hash  // convert to 32-bit int
  }
  return Math.abs(hash)
}

/**
 * Hash kết hợp cell.id và topology signature.
 * Dùng cho Seeded Façade Variation đảm bảo kiến trúc không đổi khi load lại,
 * nhưng có biến đổi nếu hàng xóm thay đổi.
 *
 * @param {string} cellId
 * @param {string} topologySignature
 * @returns {number} non-negative integer
 */
function _facadeHash(cellId, topologySignature) {
  return _cellHash(cellId + '|' + topologySignature)
}

export { ProceduralRuleEngine }
