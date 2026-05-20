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
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js'

// Cache của GLB prototype objects — clone khi dùng
const _cache = new Map()
const _placeholderCache = new Map()
const _loadErrors = new Map()
const _rawModelCache = new Map()
let _ready = false

const MODEL_PATHS = {
  foundation_arch: 'pillar-wood.glb',
  foundation_solid: 'planks.glb',
  foundation_wall: 'wall-block.glb',
  wall_mid: 'wall.glb',

  wall_flat: 'wall.glb',
  wall_window: 'wall-window-small.glb',
  wall_corner: 'wall-corner.glb',
  wall_door: 'wall-door.glb',

  roof_peak: 'roof-point.glb',
  roof_gable: 'roof-gable.glb',
  roof_flat: 'roof-flat.glb',
  roof_hip_corner: 'roof-corner.glb',
  roof_t_junction: 'roof-gable-top.glb',

  bridge_span: 'planks.glb',
}

const MODEL_SCALE_OVERRIDES = {
  foundation_arch: 1.0,
  foundation_solid: 1.0,
  foundation_wall: 1.0,
  wall_flat: 1.0,
  wall_window: 1.0,
  wall_corner: 1.0,
  wall_door: 1.0,
  wall_mid: 1.0,
  roof_peak: 1.0,
  roof_gable: 1.0,
  roof_flat: 1.0,
  roof_hip_corner: 1.0,
  roof_t_junction: 1.0,
  bridge_span: 1.0,
}

const MODEL_FILE_URLS = {
  'pillar-wood.glb': new URL('./models/kenney-town-kit/pillar-wood.glb', import.meta.url).href,
  'planks.glb': new URL('./models/kenney-town-kit/planks.glb', import.meta.url).href,
  'wall-block.glb': new URL('./models/kenney-town-kit/wall-block.glb', import.meta.url).href,
  'wall.glb': new URL('./models/kenney-town-kit/wall.glb', import.meta.url).href,
  'wall-window-small.glb': new URL('./models/kenney-town-kit/wall-window-small.glb', import.meta.url).href,
  'wall-corner.glb': new URL('./models/kenney-town-kit/wall-corner.glb', import.meta.url).href,
  'wall-door.glb': new URL('./models/kenney-town-kit/wall-door.glb', import.meta.url).href,
  'roof-point.glb': new URL('./models/kenney-town-kit/roof-point.glb', import.meta.url).href,
  'roof-gable.glb': new URL('./models/kenney-town-kit/roof-gable.glb', import.meta.url).href,
  'roof-flat.glb': new URL('./models/kenney-town-kit/roof-flat.glb', import.meta.url).href,
  'roof-corner.glb': new URL('./models/kenney-town-kit/roof-corner.glb', import.meta.url).href,
  'roof-gable-top.glb': new URL('./models/kenney-town-kit/roof-gable-top.glb', import.meta.url).href,
}

const COMPOSITE_ASSETS = {
  foundation_arch: [
    { file: 'planks.glb', size: 0.96, position: [0, 0.84, 0], colorable: false },
    { file: 'pillar-wood.glb', size: 0.86, position: [-0.36, 0, -0.36], colorable: false },
    { file: 'pillar-wood.glb', size: 0.86, position: [0.36, 0, -0.36], colorable: false },
    { file: 'pillar-wood.glb', size: 0.86, position: [-0.36, 0, 0.36], colorable: false },
    { file: 'pillar-wood.glb', size: 0.86, position: [0.36, 0, 0.36], colorable: false },
  ],
  roof_peak: [
    { file: 'wall-block.glb', size: 0.94, position: [0, 0, 0], colorable: true },
    { file: 'roof-point.glb', size: 1.08, position: [0, 0.94, 0], colorable: false },
  ],
  roof_gable: [
    { file: 'wall-block.glb', size: 0.94, position: [0, 0, 0], colorable: true },
    { file: 'roof-gable.glb', size: 1.08, position: [0, 0.94, 0], colorable: false },
  ],
  roof_flat: [
    { file: 'wall-block.glb', size: 0.94, position: [0, 0, 0], colorable: true },
    { file: 'roof-flat.glb', size: 1.08, position: [0, 0.94, 0], colorable: false },
  ],
  roof_hip_corner: [
    { file: 'wall-block.glb', size: 0.94, position: [0, 0, 0], colorable: true },
    { file: 'roof-corner.glb', size: 1.08, position: [0, 0.94, 0], colorable: false },
  ],
  roof_t_junction: [
    { file: 'wall-block.glb', size: 0.94, position: [0, 0, 0], colorable: true },
    { file: 'roof-gable-top.glb', size: 1.08, position: [0, 0.94, 0], colorable: false },
  ],
}

const colormapUrl = new URL(
  './models/kenney-town-kit/Textures/colormap.png',
  import.meta.url
).href

const _loadingManager = new THREE.LoadingManager()
_loadingManager.setURLModifier((url) => {
  const normalized = url.replace(/\\/g, '/')
  if (normalized.endsWith('Textures/colormap.png') || normalized.endsWith('/colormap.png')) {
    return colormapUrl
  }
  return url
})

const _loader = new GLTFLoader(_loadingManager)

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
    const keysToLoad = [...new Set([...keys, ...Object.keys(MODEL_PATHS)])]
    const total = keysToLoad.length

    for (let i = 0; i < keysToLoad.length; i++) {
      const key = keysToLoad[i]
      await _loadModel(key)

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
    console.log(`[AssetManager] Ready — ${_cache.size} GLB assets, ${_placeholderCache.size} placeholder fallbacks`)
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
      proto = _placeholderCache.get(assetType)
    }
    if (!proto) {
      console.warn(`[AssetManager] '${assetType}' not in cache — using placeholder fallback`)
      proto = _buildPlaceholder(assetType)
    }
    return _clonePrototype(proto)
  },

  isReady: () => _ready,
}

// ===== Internal Helpers =====

function modelUrl(fileName) {
  const url = MODEL_FILE_URLS[fileName]
  if (!url) {
    throw new Error(`No Vite asset URL registered for ${fileName}`)
  }
  return url
}

async function _loadModel(assetType) {
  if (_cache.has(assetType) || _placeholderCache.has(assetType)) return

  if (COMPOSITE_ASSETS[assetType]) {
    try {
      const prototype = await _buildCompositeModel(assetType, COMPOSITE_ASSETS[assetType])
      _cache.set(assetType, prototype)
      console.log(`[AssetManager] Loaded composite GLB ${assetType}`)
    } catch (err) {
      console.warn(`[AssetManager] Failed to build composite ${assetType}, using placeholder fallback`, err)
      _loadErrors.set(assetType, err)
      _buildPlaceholder(assetType)
    }
    return
  }

  const fileName = MODEL_PATHS[assetType]
  if (!fileName) {
    console.warn(`[AssetManager] Missing GLB for ${assetType}, using placeholder fallback`)
    _buildPlaceholder(assetType)
    return
  }

  try {
    const gltf = await _loader.loadAsync(modelUrl(fileName))
    const prototype = gltf.scene
    _prepareModel(prototype, assetType)
    _cache.set(assetType, prototype)
    console.log(`[AssetManager] Loaded GLB ${assetType} -> ${fileName}`)
  } catch (err) {
    console.warn(`[AssetManager] Failed to load ${fileName}, using placeholder fallback`, err)
    _loadErrors.set(assetType, err)
    _buildPlaceholder(assetType)
  }
}

async function _loadRawModel(fileName) {
  if (_rawModelCache.has(fileName)) {
    return _rawModelCache.get(fileName)
  }

  const gltf = await _loader.loadAsync(modelUrl(fileName))
  _rawModelCache.set(fileName, gltf.scene)
  return gltf.scene
}

async function _buildCompositeModel(assetType, parts) {
  const group = new THREE.Group()
  group.name = `kenney_${assetType}`
  group.userData.assetType = assetType

  for (const partDef of parts) {
    const raw = await _loadRawModel(partDef.file)
    const part = _clonePrototype(raw)
    normalizeToCell(part, partDef.size ?? 1)
    part.position.add(new THREE.Vector3(...(partDef.position ?? [0, 0, 0])))
    _prepareModelMeshes(part, assetType, partDef.colorable)
    group.add(part)
  }

  return group
}

/**
 * Tạo prototype và lưu vào cache.
 * @param {string} key
 * @returns {THREE.Object3D}
 */
function _buildPlaceholder(key) {
  const factory = PLACEHOLDER_DEFS[key] ?? PLACEHOLDER_DEFS._fallback
  const obj = factory()
  _preparePlaceholder(obj)
  _placeholderCache.set(key, obj)
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

function _prepareModel(prototype, assetType) {
  prototype.name = `kenney_${assetType}`
  prototype.userData.assetType = assetType

  normalizeToCell(prototype, MODEL_SCALE_OVERRIDES[assetType] ?? 1)
  _prepareModelMeshes(prototype, assetType)
}

function _prepareModelMeshes(object, assetType, forceColorable = null) {
  object.traverse((child) => {
    if (!child.isMesh) return

    child.castShadow = true
    child.receiveShadow = true
    child.frustumCulled = false

    const materialList = Array.isArray(child.material) ? child.material : [child.material]
    for (const material of materialList) {
      if (!material) continue
      if ('roughness' in material) material.roughness = 0.85
      if ('metalness' in material) material.metalness = 0
      material.needsUpdate = true
    }

    const meshName = child.name.toLowerCase()
    const inferredColorable = (
      meshName.includes('wall') ||
      meshName.includes('body') ||
      assetType.startsWith('wall') ||
      assetType.startsWith('foundation')
    )
    child.userData.isColorable = forceColorable ?? inferredColorable
  })
}

function _preparePlaceholder(object) {
  object.traverse?.((child) => {
    if (!child.isMesh) return
    child.castShadow = true
    child.receiveShadow = true
    if (child.userData.isColorable === undefined) {
      child.userData.isColorable = object.userData?.isColorable ?? true
    }
  })
}

function normalizeToCell(object, targetSize = 1) {
  object.updateMatrixWorld(true)

  const box = new THREE.Box3().setFromObject(object)
  const size = new THREE.Vector3()
  const center = new THREE.Vector3()

  box.getSize(size)
  box.getCenter(center)

  const maxAxis = Math.max(size.x, size.y, size.z)
  if (maxAxis > 0) {
    const scale = targetSize / maxAxis
    object.scale.multiplyScalar(scale)
  }

  object.updateMatrixWorld(true)

  const box2 = new THREE.Box3().setFromObject(object)
  const center2 = new THREE.Vector3()
  const min2 = new THREE.Vector3()

  box2.getCenter(center2)
  min2.copy(box2.min)

  object.position.x -= center2.x
  object.position.z -= center2.z
  object.position.y -= min2.y + 0.5
}

function _clonePrototype(prototype) {
  const clone = SkeletonUtils.clone(prototype)
  clone.traverse((child) => {
    if (!child.isMesh || !child.material) return
    if (Array.isArray(child.material)) {
      child.material = child.material.map(material => material.clone())
    } else {
      child.material = child.material.clone()
    }
  })
  return clone
}

export { AssetManager }
