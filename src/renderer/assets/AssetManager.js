/**
 * AssetManager.js — Asset Loading + Placeholder Mode
 *
 * Phase 0-4: Dùng Three.js primitives thay vì GLB thật.
 * Phase 4+: Swap sang GLTFLoader với cùng interface.
 *
 * Lý do dùng placeholder: không phải chờ GLB assets — game logic có thể
 * develop và test đầy đủ với colored primitives.
 *
 * Convention Blender (Phase 4+): mesh tên _Colorable sẽ được clone material
 * và apply cell.color.
 *
 * Public API:
 *   AssetManager.get(assetType) → THREE.Object3D (clone)
 *   AssetManager.preload(keys[]) → Promise<void>
 *   AssetManager.isReady() → boolean
 *
 * Events emitted:
 *   'assetmanager:progress' → detail: { loaded, total }
 *   'assetmanager:ready'
 */

import * as THREE from 'three'

// Cache của prototype objects — clone khi dùng
const _cache = new Map()
let _ready = false

// ===== Placeholder Geometry Definitions =====
// Theo DATA_MODELS.md mục 8 — Placeholder primitives (Phase 0-4)
const PLACEHOLDER_DEFS = {
  foundation_solid: () => _makePlaceholder(
    new THREE.BoxGeometry(0.99, 1, 0.99),
    0x8B7355  // màu bê tông/móng gỗ
  ),
  foundation_arch: () => {
    const group = new THREE.Group()
    const deckMat = new THREE.MeshStandardMaterial({ color: 0x8B7355, roughness: 0.9 })
    const pillarMat = new THREE.MeshStandardMaterial({ color: 0x5C4033, roughness: 0.95 })

    // Sàn gỗ trên cọc: dày 0.15, nằm ở đỉnh ô lưới (từ 0.35 đến 0.5)
    // Tọa độ y trung tâm = 0.5 - 0.075 = 0.425
    const deckGeo = new THREE.BoxGeometry(0.99, 0.15, 0.99)
    const deck = new THREE.Mesh(deckGeo, deckMat)
    deck.position.y = 0.425
    deck.castShadow = true
    deck.receiveShadow = true
    group.add(deck)

    // 4 cọc gỗ ở 4 góc: cao 0.85 (từ -0.5 đáy ô lưới lên đến 0.35 đáy sàn gỗ)
    // Tọa độ y trung tâm = -0.5 + 0.425 = -0.075
    const pillarGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.85, 6)
    const positions = [
      [-0.4, -0.075, -0.4],
      [0.4, -0.075, -0.4],
      [-0.4, -0.075, 0.4],
      [0.4, -0.075, 0.4],
    ]

    for (const [px, py, pz] of positions) {
      const pillar = new THREE.Mesh(pillarGeo, pillarMat)
      pillar.position.set(px, py, pz)
      pillar.castShadow = true
      pillar.receiveShadow = true
      group.add(pillar)
    }

    group.userData.isColorable = false
    return group
  },
  wall_mid: () => _makePlaceholder(
    new THREE.BoxGeometry(0.99, 1, 0.99),
    0xF5DEB3
  ),
  foundation_wall: () => _makePlaceholder(
    new THREE.BoxGeometry(0.99, 1, 0.99),
    0x8B7355
  ),
  wall_flat: () => _makePlaceholder(
    new THREE.BoxGeometry(1, 1, 0.1),
    0xF5DEB3  // Wheat (màu theo cell color — override sau)
  ),
  wall_window: () => {
    // Wall với "lỗ" giả — thực ra là 2 box nhỏ xếp lại
    const group = new THREE.Group()
    const mat = new THREE.MeshStandardMaterial({ color: 0xF5DEB3, roughness: 0.8 })

    // Phần trên cửa sổ
    const topGeo = new THREE.BoxGeometry(1, 0.25, 0.1)
    const top = new THREE.Mesh(topGeo, mat)
    top.position.y = 0.375
    group.add(top)

    // Phần dưới cửa sổ
    const botGeo = new THREE.BoxGeometry(1, 0.25, 0.1)
    const bot = new THREE.Mesh(botGeo, mat)
    bot.position.y = -0.375
    group.add(bot)

    // Thanh giữa trái/phải
    const sideGeo = new THREE.BoxGeometry(0.15, 0.5, 0.1)
    const leftSide = new THREE.Mesh(sideGeo, mat)
    leftSide.position.set(-0.425, 0, 0)
    group.add(leftSide)

    const rightSide = new THREE.Mesh(sideGeo, mat)
    rightSide.position.set(0.425, 0, 0)
    group.add(rightSide)

    group.userData.isColorable = true
    return group
  },
  wall_corner: () => _makePlaceholder(
    new THREE.BoxGeometry(1, 1, 1),
    0xF5DEB3
  ),
  roof_peak: () => {
    const group = new THREE.Group()
    const wallMat = new THREE.MeshStandardMaterial({ color: 0xF5DEB3, roughness: 0.9, metalness: 0.0 })
    const wallGeo = new THREE.BoxGeometry(0.99, 1, 0.99)
    const wall = new THREE.Mesh(wallGeo, wallMat)
    wall.castShadow = true
    wall.receiveShadow = true
    wall.userData.isColorable = true
    group.add(wall)

    const roofMat = new THREE.MeshStandardMaterial({ color: 0x3D5A47, roughness: 0.7, metalness: 0.1 })
    const roofGeo = new THREE.ConeGeometry(0.72, 0.6, 4)
    const roof = new THREE.Mesh(roofGeo, roofMat)
    roof.position.y = 0.5 + 0.3
    roof.rotation.y = Math.PI / 4 // xoay 45 độ để cạnh phẳng trùng tường
    roof.castShadow = true
    roof.receiveShadow = true
    group.add(roof)

    group.userData.isColorable = true
    return group
  },
  roof_gable: () => {
    const group = new THREE.Group()
    const wallMat = new THREE.MeshStandardMaterial({ color: 0xF5DEB3, roughness: 0.9, metalness: 0.0 })
    const wallGeo = new THREE.BoxGeometry(0.99, 1, 0.99)
    const wall = new THREE.Mesh(wallGeo, wallMat)
    wall.castShadow = true
    wall.receiveShadow = true
    wall.userData.isColorable = true
    group.add(wall)

    const roofMat = new THREE.MeshStandardMaterial({ color: 0x3D5A47, roughness: 0.7, metalness: 0.1 })
    const roofGeo = new THREE.BoxGeometry(1.02, 0.4, 0.99)
    const roof = new THREE.Mesh(roofGeo, roofMat)
    roof.position.y = 0.5 + 0.2
    roof.castShadow = true
    roof.receiveShadow = true
    group.add(roof)

    group.userData.isColorable = true
    return group
  },
  roof_hip_corner: () => {
    const group = new THREE.Group()
    const wallMat = new THREE.MeshStandardMaterial({ color: 0xF5DEB3, roughness: 0.9, metalness: 0.0 })
    const wallGeo = new THREE.BoxGeometry(0.99, 1, 0.99)
    const wall = new THREE.Mesh(wallGeo, wallMat)
    wall.castShadow = true
    wall.receiveShadow = true
    wall.userData.isColorable = true
    group.add(wall)

    const roofMat = new THREE.MeshStandardMaterial({ color: 0x3D5A47, roughness: 0.7, metalness: 0.1 })
    const roofGeo = new THREE.BoxGeometry(1.02, 0.4, 1.02)
    const roof = new THREE.Mesh(roofGeo, roofMat)
    roof.position.y = 0.5 + 0.2
    roof.castShadow = true
    roof.receiveShadow = true
    group.add(roof)

    group.userData.isColorable = true
    return group
  },
  roof_t_junction: () => {
    const group = new THREE.Group()
    const wallMat = new THREE.MeshStandardMaterial({ color: 0xF5DEB3, roughness: 0.9, metalness: 0.0 })
    const wallGeo = new THREE.BoxGeometry(0.99, 1, 0.99)
    const wall = new THREE.Mesh(wallGeo, wallMat)
    wall.castShadow = true
    wall.receiveShadow = true
    wall.userData.isColorable = true
    group.add(wall)

    const roofMat = new THREE.MeshStandardMaterial({ color: 0x3D5A47, roughness: 0.7, metalness: 0.1 })
    const roofGeo = new THREE.BoxGeometry(1.02, 0.4, 1.02)
    const roof = new THREE.Mesh(roofGeo, roofMat)
    roof.position.y = 0.5 + 0.2
    roof.castShadow = true
    roof.receiveShadow = true
    group.add(roof)

    group.userData.isColorable = true
    return group
  },
  roof_flat: () => {
    const group = new THREE.Group()
    const wallMat = new THREE.MeshStandardMaterial({ color: 0xF5DEB3, roughness: 0.9, metalness: 0.0 })
    const wallGeo = new THREE.BoxGeometry(0.99, 1, 0.99)
    const wall = new THREE.Mesh(wallGeo, wallMat)
    wall.castShadow = true
    wall.receiveShadow = true
    wall.userData.isColorable = true
    group.add(wall)

    const roofMat = new THREE.MeshStandardMaterial({ color: 0x3D5A47, roughness: 0.8, metalness: 0.0 })
    const roofGeo = new THREE.BoxGeometry(1.02, 0.1, 1.02)
    const roof = new THREE.Mesh(roofGeo, roofMat)
    roof.position.y = 0.5 + 0.05
    roof.castShadow = true
    roof.receiveShadow = true
    group.add(roof)

    group.userData.isColorable = true
    return group
  },
  bridge_span: () => _makePlaceholder(
    new THREE.BoxGeometry(1, 0.2, 1),
    0x808080
  ),
  _fallback: () => _makePlaceholder(
    new THREE.BoxGeometry(1, 1, 1),
    0xFF00FF  // magenta — dễ nhận biết bug
  ),
}

const AssetManager = {
  /**
   * Preload tất cả assets (Phase 0-4: instant vì chỉ tạo primitives).
   * @param {string[]} keys - assetType keys cần load
   * @returns {Promise<void>}
   */
  async preload(keys) {
    const total = keys.length

    for (let i = 0; i < keys.length; i++) {
      const key = keys[i]
      _buildPlaceholder(key)

      // Emit progress
      window.dispatchEvent(new CustomEvent('assetmanager:progress', {
        detail: { loaded: i + 1, total },
      }))

      // Yield control mỗi 5 items để không block UI
      if (i % 5 === 4) {
        await new Promise(r => setTimeout(r, 0))
      }
    }

    _ready = true
    console.log(`[AssetManager] Ready — ${total} placeholder assets built`)
    window.dispatchEvent(new CustomEvent('assetmanager:ready'))
  },

  /**
   * Lấy clone của asset prototype.
   * PHẢI gọi preload trước — nhưng có fallback nếu key chưa sẵn sàng.
   *
   * @param {string} assetType
   * @returns {THREE.Object3D}
   */
  get(assetType) {
    let proto = _cache.get(assetType)
    if (!proto) {
      console.warn(`[AssetManager] '${assetType}' not in cache — building now`)
      proto = _buildPlaceholder(assetType)
    }
    // Clone để mỗi cell có mesh riêng, không share geometry/material state
    return proto.clone()
  },

  isReady: () => _ready,
}

// ===== Internal Helpers =====

/**
 * Tạo prototype và lưu vào cache.
 * @param {string} key
 * @returns {THREE.Object3D}
 */
function _buildPlaceholder(key) {
  const factory = PLACEHOLDER_DEFS[key] ?? PLACEHOLDER_DEFS._fallback
  const obj = factory()
  _cache.set(key, obj)
  return obj
}

/**
 * Tạo Mesh từ geometry và color.
 * @param {THREE.BufferGeometry} geometry
 * @param {number} color - hex number
 * @returns {THREE.Mesh}
 */
function _makePlaceholder(geometry, color) {
  const material = new THREE.MeshStandardMaterial({
    color,
    roughness: 0.8,
    metalness: 0,
  })
  const mesh = new THREE.Mesh(geometry, material)
  mesh.castShadow = true
  mesh.receiveShadow = true
  mesh.userData.isColorable = true  // tag để biết có thể tint màu cell
  return mesh
}

export { AssetManager }
