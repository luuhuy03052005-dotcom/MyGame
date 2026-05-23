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
import { BUILD_MATERIALS, DEFAULT_MATERIAL } from './AssetRegistry.js'
import {
  getKit,
  getKitModelFiles,
  getKitModelUrl as resolveKitModelUrl,
  getKitTextureUrl as resolveKitTextureUrl,
} from './KitRegistry.js'

// Cache của GLB prototype objects — clone khi dùng
const _cache = new Map()
const _placeholderCache = new Map()
const _loadErrors = new Map()
const _rawModelCache = new Map()
const _textureCache = new Map()
const _textureLoader = new THREE.TextureLoader()
let _ready = false
let _activeKitId = 'kenney-city-suburban'
let _activeTextureVariation = 'original'

const MATERIAL_IDS = BUILD_MATERIALS.map(material => material.id)
const VISUAL_VARIANT_COUNT = 3
const RAW_MODEL_PRELOAD_FILES = [
  'planks.glb',
  'pillar-wood.glb',
  'road.glb',
  'road-edge.glb',
  'road-corner.glb',
  'road-corner-inner.glb',
  'road-bend.glb',
  'road-curb.glb',
  'road-curb-end.glb',
  'wall-arch.glb',
  'wall-arch-top.glb',
  'wall-block.glb',
  'wall-corner-edge.glb',
  'wall-rounded.glb',
  'rock-small.glb',
  'rock-wide.glb',
  'rock-large.glb',
  'wall.glb',
  'wall-window-small.glb',
  'wall-window-shutters.glb',
  'wall-window-round.glb',
  'wall-window-glass.glb',
  'wall-door.glb',
  'wall-corner.glb',
  'wall-wood.glb',
  'wall-wood-window-small.glb',
  'wall-wood-window-shutters.glb',
  'wall-wood-door.glb',
  'balcony-wall.glb',
  'balcony-wall-fence.glb',
  'overhang.glb',
  'roof-point.glb',
  'roof-window.glb',
  'roof-gable.glb',
  'roof-gable-detail.glb',
  'roof-flat.glb',
  'roof-corner.glb',
  'roof-corner-inner.glb',
  'roof-gable-top.glb',
  'roof-high-point.glb',
  'roof-high-gable.glb',
  'roof-high-flat.glb',
  'chimney.glb',
  'lantern.glb',
  'banner-green.glb',
  'banner-red.glb',
  'cart.glb',
  'fountain-round.glb',
  'fountain-square.glb',
  'hedge.glb',
  'stall.glb',
  'stairs-stone.glb',
]

const SUBURBAN_RAW_MODEL_PRELOAD_FILES = [
  'building-type-a.glb',
  'building-type-b.glb',
  'building-type-c.glb',
  'building-type-d.glb',
  'building-type-e.glb',
  'building-type-f.glb',
  'building-type-g.glb',
  'building-type-h.glb',
  'building-type-i.glb',
  'building-type-j.glb',
  'building-type-k.glb',
  'building-type-l.glb',
  'building-type-m.glb',
  'building-type-n.glb',
  'building-type-o.glb',
  'building-type-p.glb',
  'building-type-q.glb',
  'building-type-r.glb',
  'building-type-s.glb',
  'building-type-t.glb',
  'building-type-u.glb',
  'driveway-long.glb',
  'driveway-short.glb',
  'fence.glb',
  'fence-low.glb',
  'fence-1x2.glb',
  'fence-1x3.glb',
  'fence-1x4.glb',
  'path-long.glb',
  'path-short.glb',
  'path-stones-long.glb',
  'path-stones-short.glb',
  'path-stones-messy.glb',
  'planter.glb',
  'tree-small.glb',
  'tree-large.glb',
]

const BOOT_RAW_MODEL_PRELOAD_FILES = [
  'road.glb',
  'road-edge.glb',
  'road-corner.glb',
  'road-corner-inner.glb',
  'road-bend.glb',
  'road-curb.glb',
  'road-curb-end.glb',
  'wall-arch.glb',
  'wall-arch-top.glb',
  'wall-block.glb',
  'wall-corner-edge.glb',
  'wall-rounded.glb',
  'rock-wide.glb',
  'wall.glb',
  'wall-window-small.glb',
  'wall-window-shutters.glb',
  'wall-window-round.glb',
  'wall-door.glb',
  'wall-corner.glb',
  'roof-point.glb',
  'roof-gable.glb',
  'roof-gable-detail.glb',
  'roof-flat.glb',
  'roof-corner.glb',
  'roof-gable-top.glb',
  'chimney.glb',
  'lantern.glb',
  'hedge.glb',
]

const SUBURBAN_BOOT_RAW_MODEL_PRELOAD_FILES = [
  'building-type-a.glb',
  'building-type-b.glb',
  'building-type-c.glb',
  'driveway-long.glb',
  'driveway-short.glb',
  'fence.glb',
  'fence-low.glb',
  'path-long.glb',
  'path-short.glb',
  'path-stones-long.glb',
  'path-stones-short.glb',
  'path-stones-messy.glb',
  'planter.glb',
  'tree-small.glb',
  'tree-large.glb',
]

const RAW_ONLY_ASSET_TYPES = new Set([
  'surface_driveway_long',
  'prop_fence',
  'prop_fence_low',
  'prop_fence_1x2',
  'prop_fence_1x3',
  'prop_fence_1x4',
  'prop_fence_2x2',
  'prop_fence_2x3',
  'prop_fence_3x2',
  'prop_fence_3x3',
  'prop_planter',
  'prop_tree_small',
  'prop_tree_large',
  'prop_banner_green',
  'prop_banner_red',
  'prop_cart',
  'prop_fountain_round',
  'prop_fountain_square',
  'prop_hedge',
  'prop_stall',
  ...'abcdefghijklmnopqrstu'.split('').map(letter => `prefab_house_${letter}`),
])

const MODEL_PATHS = {
  foundation_seawall_straight: 'wall-arch.glb',
  foundation_seawall_corner: 'wall-corner-edge.glb',
  foundation_seawall_inner_corner: 'road-corner-inner.glb',
  foundation_seawall_end: 'wall-arch-top.glb',
  foundation_seawall_round: 'wall-rounded.glb',
  foundation_plaza_tile: 'road.glb',
  foundation_water_edge: 'road-edge.glb',
  foundation_stairs: 'stairs-stone.glb',
  foundation_rock_edge: 'rock-wide.glb',
  foundation_arch: 'pillar-stone.glb',
  foundation_solid: 'road.glb',
  foundation_wall: 'wall-block.glb',
  surface_building_footprint: 'road-curb.glb',
  surface_plaza_center: 'road.glb',
  surface_plaza_edge: 'road-edge.glb',
  surface_plaza_corner: 'road-corner.glb',
  surface_walkway_straight: 'road.glb',
  surface_walkway_corner: 'road-bend.glb',
  surface_walkway_t: 'road-corner-inner.glb',
  surface_walkway_cross: 'road.glb',
  surface_walkway_end: 'road-curb-end.glb',
  surface_entrance: 'road-curb.glb',
  surface_quay_promenade: 'road-edge.glb',
  surface_quay_corner: 'road-corner.glb',
  surface_garden_patch: 'hedge.glb',
  surface_waterfront_step: 'stairs-stone.glb',
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
  foundation_seawall_straight: 1.0,
  foundation_seawall_corner: 1.0,
  foundation_seawall_inner_corner: 1.0,
  foundation_seawall_end: 1.0,
  foundation_seawall_round: 1.0,
  foundation_plaza_tile: 1.0,
  foundation_water_edge: 1.0,
  foundation_stairs: 1.0,
  foundation_rock_edge: 1.0,
  foundation_arch: 1.0,
  foundation_solid: 1.0,
  foundation_wall: 1.0,
  surface_building_footprint: 1.0,
  surface_plaza_center: 1.0,
  surface_plaza_edge: 1.0,
  surface_plaza_corner: 1.0,
  surface_walkway_straight: 1.0,
  surface_walkway_corner: 1.0,
  surface_walkway_t: 1.0,
  surface_walkway_cross: 1.0,
  surface_walkway_end: 1.0,
  surface_entrance: 1.0,
  surface_quay_promenade: 1.0,
  surface_quay_corner: 1.0,
  surface_garden_patch: 1.0,
  surface_waterfront_step: 1.0,
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
  'pillar-stone.glb': new URL('./models/kenney-town-kit/pillar-stone.glb', import.meta.url).href,
  'planks.glb': new URL('./models/kenney-town-kit/planks.glb', import.meta.url).href,
  'planks-half.glb': new URL('./models/kenney-town-kit/planks-half.glb', import.meta.url).href,
  'road.glb': new URL('./models/kenney-town-kit/road.glb', import.meta.url).href,
  'road-edge.glb': new URL('./models/kenney-town-kit/road-edge.glb', import.meta.url).href,
  'road-corner.glb': new URL('./models/kenney-town-kit/road-corner.glb', import.meta.url).href,
  'road-corner-inner.glb': new URL('./models/kenney-town-kit/road-corner-inner.glb', import.meta.url).href,
  'road-bend.glb': new URL('./models/kenney-town-kit/road-bend.glb', import.meta.url).href,
  'road-curb.glb': new URL('./models/kenney-town-kit/road-curb.glb', import.meta.url).href,
  'road-curb-end.glb': new URL('./models/kenney-town-kit/road-curb-end.glb', import.meta.url).href,
  'wall-block.glb': new URL('./models/kenney-town-kit/wall-block.glb', import.meta.url).href,
  'wall-block-half.glb': new URL('./models/kenney-town-kit/wall-block-half.glb', import.meta.url).href,
  'wall.glb': new URL('./models/kenney-town-kit/wall.glb', import.meta.url).href,
  'wall-arch.glb': new URL('./models/kenney-town-kit/wall-arch.glb', import.meta.url).href,
  'wall-arch-top.glb': new URL('./models/kenney-town-kit/wall-arch-top.glb', import.meta.url).href,
  'wall-corner-edge.glb': new URL('./models/kenney-town-kit/wall-corner-edge.glb', import.meta.url).href,
  'wall-corner-diagonal.glb': new URL('./models/kenney-town-kit/wall-corner-diagonal.glb', import.meta.url).href,
  'wall-rounded.glb': new URL('./models/kenney-town-kit/wall-rounded.glb', import.meta.url).href,
  'wall-side.glb': new URL('./models/kenney-town-kit/wall-side.glb', import.meta.url).href,
  'wall-half.glb': new URL('./models/kenney-town-kit/wall-half.glb', import.meta.url).href,
  'wall-window-small.glb': new URL('./models/kenney-town-kit/wall-window-small.glb', import.meta.url).href,
  'wall-window-shutters.glb': new URL('./models/kenney-town-kit/wall-window-shutters.glb', import.meta.url).href,
  'wall-window-round.glb': new URL('./models/kenney-town-kit/wall-window-round.glb', import.meta.url).href,
  'wall-window-glass.glb': new URL('./models/kenney-town-kit/wall-window-glass.glb', import.meta.url).href,
  'wall-window-stone.glb': new URL('./models/kenney-town-kit/wall-window-stone.glb', import.meta.url).href,
  'wall-corner.glb': new URL('./models/kenney-town-kit/wall-corner.glb', import.meta.url).href,
  'wall-corner-detail.glb': new URL('./models/kenney-town-kit/wall-corner-detail.glb', import.meta.url).href,
  'wall-door.glb': new URL('./models/kenney-town-kit/wall-door.glb', import.meta.url).href,
  'wall-doorway-round.glb': new URL('./models/kenney-town-kit/wall-doorway-round.glb', import.meta.url).href,
  'wall-doorway-square.glb': new URL('./models/kenney-town-kit/wall-doorway-square.glb', import.meta.url).href,
  'wall-wood.glb': new URL('./models/kenney-town-kit/wall-wood.glb', import.meta.url).href,
  'wall-wood-window-small.glb': new URL('./models/kenney-town-kit/wall-wood-window-small.glb', import.meta.url).href,
  'wall-wood-window-shutters.glb': new URL('./models/kenney-town-kit/wall-wood-window-shutters.glb', import.meta.url).href,
  'wall-wood-window-round.glb': new URL('./models/kenney-town-kit/wall-wood-window-round.glb', import.meta.url).href,
  'wall-wood-window-glass.glb': new URL('./models/kenney-town-kit/wall-wood-window-glass.glb', import.meta.url).href,
  'wall-wood-corner.glb': new URL('./models/kenney-town-kit/wall-wood-corner.glb', import.meta.url).href,
  'wall-wood-door.glb': new URL('./models/kenney-town-kit/wall-wood-door.glb', import.meta.url).href,
  'overhang.glb': new URL('./models/kenney-town-kit/overhang.glb', import.meta.url).href,
  'lantern.glb': new URL('./models/kenney-town-kit/lantern.glb', import.meta.url).href,
  'chimney.glb': new URL('./models/kenney-town-kit/chimney.glb', import.meta.url).href,
  'balcony-wall.glb': new URL('./models/kenney-town-kit/balcony-wall.glb', import.meta.url).href,
  'balcony-wall-fence.glb': new URL('./models/kenney-town-kit/balcony-wall-fence.glb', import.meta.url).href,
  'rock-small.glb': new URL('./models/kenney-town-kit/rock-small.glb', import.meta.url).href,
  'rock-wide.glb': new URL('./models/kenney-town-kit/rock-wide.glb', import.meta.url).href,
  'rock-large.glb': new URL('./models/kenney-town-kit/rock-large.glb', import.meta.url).href,
  'hedge.glb': new URL('./models/kenney-town-kit/hedge.glb', import.meta.url).href,
  'stairs-stone.glb': new URL('./models/kenney-town-kit/stairs-stone.glb', import.meta.url).href,
  'stairs-wide-stone.glb': new URL('./models/kenney-town-kit/stairs-wide-stone.glb', import.meta.url).href,
  'fence.glb': new URL('./models/kenney-town-kit/fence.glb', import.meta.url).href,
  'fence-curved.glb': new URL('./models/kenney-town-kit/fence-curved.glb', import.meta.url).href,
  'roof-point.glb': new URL('./models/kenney-town-kit/roof-point.glb', import.meta.url).href,
  'roof-gable.glb': new URL('./models/kenney-town-kit/roof-gable.glb', import.meta.url).href,
  'roof-flat.glb': new URL('./models/kenney-town-kit/roof-flat.glb', import.meta.url).href,
  'roof-corner.glb': new URL('./models/kenney-town-kit/roof-corner.glb', import.meta.url).href,
  'roof-corner-inner.glb': new URL('./models/kenney-town-kit/roof-corner-inner.glb', import.meta.url).href,
  'roof-gable-top.glb': new URL('./models/kenney-town-kit/roof-gable-top.glb', import.meta.url).href,
  'roof-gable-detail.glb': new URL('./models/kenney-town-kit/roof-gable-detail.glb', import.meta.url).href,
  'roof-window.glb': new URL('./models/kenney-town-kit/roof-window.glb', import.meta.url).href,
  'roof-high-window.glb': new URL('./models/kenney-town-kit/roof-high-window.glb', import.meta.url).href,
  'roof-high-point.glb': new URL('./models/kenney-town-kit/roof-high-point.glb', import.meta.url).href,
  'roof-high-gable.glb': new URL('./models/kenney-town-kit/roof-high-gable.glb', import.meta.url).href,
  'roof-high-gable-detail.glb': new URL('./models/kenney-town-kit/roof-high-gable-detail.glb', import.meta.url).href,
  'roof-high-flat.glb': new URL('./models/kenney-town-kit/roof-high-flat.glb', import.meta.url).href,
  'roof-high-corner.glb': new URL('./models/kenney-town-kit/roof-high-corner.glb', import.meta.url).href,
  'roof-high-gable-top.glb': new URL('./models/kenney-town-kit/roof-high-gable-top.glb', import.meta.url).href,
}

const WALL_BODY_COLOR = 0xf0d2a4
const FOUNDATION_BODY_COLOR = 0x9c744f
const WOOD_COLOR = 0xb97942
const DARK_WOOD_COLOR = 0x5d3a28
const STONE_PLATFORM_COLOR = 0x8a8f92
const STONE_QUAY_COLOR = 0x9f9d91
const STONE_QUAY_DARK = 0x76786f
const STONE_QUAY_LIGHT = 0xb9b5a6

const COMPOSITE_ASSETS = {
  foundation_arch: [
    { file: 'road.glb', size: 1.08, position: [0, 0.9, 0], colorable: false },
    { kind: 'box', size: [1.08, 0.07, 1.08], position: [0, 0.39, 0], color: STONE_PLATFORM_COLOR, colorable: false },
    { file: 'pillar-stone.glb', size: 0.88, position: [-0.43, 0, -0.43], colorable: false },
    { file: 'pillar-stone.glb', size: 0.88, position: [0.43, 0, -0.43], colorable: false },
    { file: 'pillar-stone.glb', size: 0.88, position: [-0.43, 0, 0.43], colorable: false },
    { file: 'pillar-stone.glb', size: 0.88, position: [0.43, 0, 0.43], colorable: false },
  ],
  foundation_solid: [
    { kind: 'box', size: [1.06, 0.18, 1.06], position: [0, 0.34, 0], color: STONE_PLATFORM_COLOR, colorable: false },
    { file: 'road.glb', size: 1.08, position: [0, 0.9, 0], colorable: false },
  ],
  foundation_wall: [
    { kind: 'box', size: [1.04, 1.0, 1.04], position: [0, 0, 0], color: FOUNDATION_BODY_COLOR, colorable: true },
  ],
  wall_mid: [
    { kind: 'box', size: [1.04, 1.0, 1.04], position: [0, 0, 0], color: WALL_BODY_COLOR, colorable: true },
  ],
  wall_flat: [
    { kind: 'box', size: [1.04, 1.0, 1.04], position: [0, 0, 0], color: WALL_BODY_COLOR, colorable: true },
    { file: 'wall.glb', size: 1.01, position: [0.015, 0, 0], centerXZ: false, colorable: false },
  ],
  wall_window: [
    { kind: 'box', size: [1.04, 1.0, 1.04], position: [0, 0, 0], color: WALL_BODY_COLOR, colorable: true },
    { file: 'wall-window-small.glb', size: 1.01, position: [0.015, 0, 0], centerXZ: false, colorable: false },
  ],
  wall_corner: [
    { kind: 'box', size: [1.04, 1.0, 1.04], position: [0, 0, 0], color: WALL_BODY_COLOR, colorable: true },
    { file: 'wall-corner.glb', size: 1.02, position: [0, 0, 0], colorable: false },
  ],
  wall_door: [
    { kind: 'box', size: [1.04, 1.0, 1.04], position: [0, 0, 0], color: WALL_BODY_COLOR, colorable: true },
    { file: 'wall-door.glb', size: 1.01, position: [0.015, 0, 0], centerXZ: false, colorable: false },
  ],
  roof_peak: [
    { kind: 'box', size: [1.04, 0.94, 1.04], position: [0, -0.03, 0], color: WALL_BODY_COLOR, colorable: true },
    { file: 'roof-point.glb', size: 1.14, position: [0, 0.92, 0], colorable: false },
  ],
  roof_gable: [
    { kind: 'box', size: [1.04, 0.94, 1.04], position: [0, -0.03, 0], color: WALL_BODY_COLOR, colorable: true },
    { file: 'roof-gable.glb', size: 1.14, position: [0, 0.92, 0], colorable: false },
  ],
  roof_flat: [
    { kind: 'box', size: [1.04, 0.96, 1.04], position: [0, -0.02, 0], color: WALL_BODY_COLOR, colorable: true },
    { file: 'roof-flat.glb', size: 1.12, position: [0, 0.91, 0], colorable: false },
  ],
  roof_hip_corner: [
    { kind: 'box', size: [1.04, 0.94, 1.04], position: [0, -0.03, 0], color: WALL_BODY_COLOR, colorable: true },
    { file: 'roof-corner.glb', size: 1.14, position: [0, 0.92, 0], colorable: false },
  ],
  roof_t_junction: [
    { kind: 'box', size: [1.04, 0.94, 1.04], position: [0, -0.03, 0], color: WALL_BODY_COLOR, colorable: true },
    { file: 'roof-gable-top.glb', size: 1.12, position: [0, 0.92, 0], colorable: false },
  ],
}

const MATERIAL_CONFIGS = {
  plaster: {
    foundationMode: 'seawall',
    bodyColor: WALL_BODY_COLOR,
    foundationColor: STONE_QUAY_COLOR,
    foundationDarkColor: STONE_QUAY_DARK,
    copingColor: STONE_QUAY_LIGHT,
    foundationSurface: ['road.glb', 'road-edge.glb', 'road-corner.glb'],
    seawallSide: ['wall-arch.glb', 'wall-arch-top.glb', 'wall-block.glb'],
    seawallCorner: ['wall-corner-edge.glb', 'wall-corner.glb', 'wall-rounded.glb'],
    seawallInnerCorner: ['road-corner-inner.glb', 'wall-corner-diagonal.glb', 'road-bend.glb'],
    rockEdge: ['rock-wide.glb', 'rock-small.glb', 'rock-large.glb'],
    wall: 'wall.glb',
    wallWindow: ['wall-window-small.glb', 'wall-window-shutters.glb', 'wall-window-round.glb'],
    wallCorner: 'wall-corner.glb',
    wallDoor: 'wall-door.glb',
    balcony: [null, 'balcony-wall.glb', 'balcony-wall-fence.glb'],
    roofs: {
      roof_peak: ['roof-point.glb', 'roof-window.glb', 'roof-point.glb'],
      roof_gable: ['roof-gable.glb', 'roof-gable-detail.glb', 'roof-gable.glb'],
      roof_flat: ['roof-flat.glb', 'roof-flat.glb', 'roof-gable-top.glb'],
      roof_hip_corner: ['roof-corner.glb', 'roof-corner-inner.glb', 'roof-corner.glb'],
      roof_t_junction: ['roof-gable-top.glb', 'roof-gable-detail.glb', 'roof-gable-top.glb'],
    },
  },
  stone_quay: {
    foundationMode: 'seawall',
    bodyColor: WALL_BODY_COLOR,
    foundationColor: STONE_QUAY_COLOR,
    foundationDarkColor: STONE_QUAY_DARK,
    copingColor: STONE_QUAY_LIGHT,
    foundationSurface: ['road.glb', 'road-edge.glb', 'road-corner.glb'],
    seawallSide: ['wall-arch.glb', 'wall-arch-top.glb', 'wall-block.glb'],
    seawallCorner: ['wall-corner-edge.glb', 'wall-corner.glb', 'wall-rounded.glb'],
    seawallInnerCorner: ['road-corner-inner.glb', 'wall-corner-diagonal.glb', 'road-bend.glb'],
    rockEdge: ['rock-wide.glb', 'rock-small.glb', 'rock-large.glb'],
    pillar: 'pillar-stone.glb',
    wall: 'wall.glb',
    wallWindow: ['wall-window-small.glb', 'wall-window-shutters.glb', 'wall-window-stone.glb'],
    wallCorner: 'wall-corner.glb',
    wallDoor: 'wall-door.glb',
    balcony: [null, 'balcony-wall.glb', null],
    roofs: {
      roof_peak: ['roof-point.glb', 'roof-window.glb', 'roof-point.glb'],
      roof_gable: ['roof-gable.glb', 'roof-gable-detail.glb', 'roof-gable.glb'],
      roof_flat: ['roof-flat.glb', 'roof-flat.glb', 'roof-gable-top.glb'],
      roof_hip_corner: ['roof-corner.glb', 'roof-corner.glb', 'roof-gable-top.glb'],
      roof_t_junction: ['roof-gable-top.glb', 'roof-gable-detail.glb', 'roof-gable-top.glb'],
    },
  },
  stone_plaza: {
    foundationMode: 'seawall',
    bodyColor: 0xa7a399,
    foundationColor: 0x90928a,
    foundationDarkColor: 0x6f756f,
    copingColor: 0xb4b1a5,
    foundationSurface: ['road.glb', 'road-curb.glb', 'road-edge.glb'],
    seawallSide: ['wall-block.glb', 'wall-arch.glb', 'wall-side.glb'],
    seawallCorner: ['wall-corner.glb', 'wall-corner-edge.glb', 'wall-rounded.glb'],
    seawallInnerCorner: ['road-corner-inner.glb', 'wall-corner-diagonal.glb', 'road-bend.glb'],
    rockEdge: ['rock-wide.glb', 'rock-large.glb', 'rock-small.glb'],
    pillar: 'pillar-stone.glb',
    wall: 'wall-block.glb',
    wallWindow: ['wall-window-stone.glb', 'wall-window-round.glb', 'wall-window-small.glb'],
    wallCorner: 'wall-corner-detail.glb',
    wallDoor: 'wall-door.glb',
    balcony: [null, null, 'balcony-wall.glb'],
    roofs: {
      roof_peak: ['roof-point.glb', 'roof-high-point.glb', 'roof-window.glb'],
      roof_gable: ['roof-gable.glb', 'roof-high-gable.glb', 'roof-gable-detail.glb'],
      roof_flat: ['roof-flat.glb', 'roof-high-flat.glb', 'roof-flat.glb'],
      roof_hip_corner: ['roof-corner.glb', 'roof-high-corner.glb', 'roof-corner.glb'],
      roof_t_junction: ['roof-gable-top.glb', 'roof-high-gable-top.glb', 'roof-gable-detail.glb'],
    },
  },
  harbor_pier: {
    foundationMode: 'pier',
    bodyColor: 0xb98555,
    foundationColor: WOOD_COLOR,
    foundationDarkColor: DARK_WOOD_COLOR,
    copingColor: 0xd09a66,
    foundationSurface: ['planks.glb', 'planks-half.glb', 'planks.glb'],
    pillar: 'pillar-wood.glb',
    wall: 'wall-wood.glb',
    wallWindow: ['wall-wood-window-small.glb', 'wall-wood-window-shutters.glb', 'wall-wood-window-round.glb'],
    wallCorner: 'wall-wood-corner.glb',
    wallDoor: 'wall-wood-door.glb',
    balcony: [null, 'balcony-wall.glb', 'balcony-wall-fence.glb'],
    roofs: {
      roof_peak: ['roof-high-point.glb', 'roof-point.glb', 'roof-window.glb'],
      roof_gable: ['roof-high-gable.glb', 'roof-gable.glb', 'roof-gable-detail.glb'],
      roof_flat: ['roof-high-flat.glb', 'roof-flat.glb', 'roof-gable-top.glb'],
      roof_hip_corner: ['roof-high-corner.glb', 'roof-corner.glb', 'roof-corner.glb'],
      roof_t_junction: ['roof-high-gable-top.glb', 'roof-gable-top.glb', 'roof-gable-detail.glb'],
    },
  },
  rock_edge: {
    foundationMode: 'seawall',
    bodyColor: 0xa9a38f,
    foundationColor: 0x7d827d,
    foundationDarkColor: 0x5f655f,
    copingColor: 0xaaa796,
    foundationSurface: ['road-edge.glb', 'road.glb', 'road-curb.glb'],
    seawallSide: ['wall-block.glb', 'wall-arch.glb', 'wall-rounded.glb'],
    seawallCorner: ['wall-rounded.glb', 'wall-corner-edge.glb', 'wall-corner.glb'],
    seawallInnerCorner: ['road-corner-inner.glb', 'wall-corner-diagonal.glb', 'road-bend.glb'],
    rockEdge: ['rock-wide.glb', 'rock-large.glb', 'rock-small.glb'],
    pillar: 'pillar-stone.glb',
    wall: 'wall-block.glb',
    wallWindow: ['wall-window-stone.glb', 'wall-window-round.glb', 'wall-window-small.glb'],
    wallCorner: 'wall-corner-detail.glb',
    wallDoor: 'wall-door.glb',
    balcony: [null, null, 'balcony-wall.glb'],
    roofs: {
      roof_peak: ['roof-point.glb', 'roof-high-point.glb', 'roof-window.glb'],
      roof_gable: ['roof-gable.glb', 'roof-high-gable.glb', 'roof-gable-detail.glb'],
      roof_flat: ['roof-flat.glb', 'roof-high-flat.glb', 'roof-flat.glb'],
      roof_hip_corner: ['roof-corner.glb', 'roof-high-corner.glb', 'roof-corner.glb'],
      roof_t_junction: ['roof-gable-top.glb', 'roof-high-gable-top.glb', 'roof-gable-detail.glb'],
    },
  },
  coast: {
    foundationMode: 'seawall',
    bodyColor: WALL_BODY_COLOR,
    foundationColor: STONE_PLATFORM_COLOR,
    foundationDarkColor: STONE_QUAY_DARK,
    copingColor: STONE_QUAY_LIGHT,
    foundationSurface: ['road.glb', 'road-edge.glb', 'road-corner.glb'],
    seawallSide: ['wall-arch.glb', 'wall-arch-top.glb', 'wall-block.glb'],
    seawallCorner: ['wall-corner-edge.glb', 'wall-corner.glb', 'wall-rounded.glb'],
    seawallInnerCorner: ['road-corner-inner.glb', 'wall-corner-diagonal.glb', 'road-bend.glb'],
    rockEdge: ['rock-wide.glb', 'rock-small.glb', 'rock-large.glb'],
    pillar: 'pillar-stone.glb',
    wall: 'wall.glb',
    wallWindow: ['wall-window-small.glb', 'wall-window-shutters.glb', 'wall-window-round.glb'],
    wallCorner: 'wall-corner.glb',
    wallDoor: 'wall-door.glb',
    balcony: [null, 'balcony-wall.glb', 'balcony-wall-fence.glb'],
    roofs: {
      roof_peak: ['roof-point.glb', 'roof-window.glb', 'roof-point.glb'],
      roof_gable: ['roof-gable.glb', 'roof-gable-detail.glb', 'roof-gable.glb'],
      roof_flat: ['roof-flat.glb', 'roof-flat.glb', 'roof-gable-top.glb'],
      roof_hip_corner: ['roof-corner.glb', 'roof-corner.glb', 'roof-gable-top.glb'],
      roof_t_junction: ['roof-gable-top.glb', 'roof-gable-detail.glb', 'roof-gable-top.glb'],
    },
  },
  stone: {
    foundationMode: 'seawall',
    bodyColor: 0xa7a399,
    foundationColor: 0x7f8588,
    foundationDarkColor: 0x6f756f,
    copingColor: 0xb4b1a5,
    foundationSurface: ['road.glb', 'road-curb.glb', 'road-edge.glb'],
    seawallSide: ['wall-block.glb', 'wall-arch.glb', 'wall-side.glb'],
    seawallCorner: ['wall-corner.glb', 'wall-corner-edge.glb', 'wall-rounded.glb'],
    seawallInnerCorner: ['road-corner-inner.glb', 'wall-corner-diagonal.glb', 'road-bend.glb'],
    rockEdge: ['rock-wide.glb', 'rock-large.glb', 'rock-small.glb'],
    pillar: 'pillar-stone.glb',
    wall: 'wall-block.glb',
    wallWindow: ['wall-window-stone.glb', 'wall-window-round.glb', 'wall-window-small.glb'],
    wallCorner: 'wall-corner-detail.glb',
    wallDoor: 'wall-door.glb',
    balcony: [null, null, 'balcony-wall.glb'],
    roofs: {
      roof_peak: ['roof-point.glb', 'roof-high-point.glb', 'roof-window.glb'],
      roof_gable: ['roof-gable.glb', 'roof-high-gable.glb', 'roof-gable-detail.glb'],
      roof_flat: ['roof-flat.glb', 'roof-high-flat.glb', 'roof-flat.glb'],
      roof_hip_corner: ['roof-corner.glb', 'roof-high-corner.glb', 'roof-corner.glb'],
      roof_t_junction: ['roof-gable-top.glb', 'roof-high-gable-top.glb', 'roof-gable-detail.glb'],
    },
  },
  wood: {
    foundationMode: 'seawall',
    bodyColor: 0xb98555,
    foundationColor: STONE_QUAY_COLOR,
    foundationDarkColor: STONE_QUAY_DARK,
    copingColor: STONE_QUAY_LIGHT,
    foundationSurface: ['road.glb', 'road-edge.glb', 'road-curb.glb'],
    seawallSide: ['wall-arch.glb', 'wall-block.glb', 'wall-arch-top.glb'],
    seawallCorner: ['wall-corner-edge.glb', 'wall-corner.glb', 'wall-rounded.glb'],
    seawallInnerCorner: ['road-corner-inner.glb', 'wall-corner-diagonal.glb', 'road-bend.glb'],
    rockEdge: ['rock-wide.glb', 'rock-small.glb', 'rock-large.glb'],
    pillar: 'pillar-wood.glb',
    wall: 'wall-wood.glb',
    wallWindow: ['wall-wood-window-small.glb', 'wall-wood-window-shutters.glb', 'wall-wood-window-round.glb'],
    wallCorner: 'wall-wood-corner.glb',
    wallDoor: 'wall-wood-door.glb',
    balcony: [null, 'balcony-wall.glb', 'balcony-wall-fence.glb'],
    roofs: {
      roof_peak: ['roof-high-point.glb', 'roof-point.glb', 'roof-window.glb'],
      roof_gable: ['roof-high-gable.glb', 'roof-gable.glb', 'roof-gable-detail.glb'],
      roof_flat: ['roof-high-flat.glb', 'roof-flat.glb', 'roof-gable-top.glb'],
      roof_hip_corner: ['roof-high-corner.glb', 'roof-corner.glb', 'roof-corner.glb'],
      roof_t_junction: ['roof-high-gable-top.glb', 'roof-gable-top.glb', 'roof-gable-detail.glb'],
    },
  },
  tower: {
    foundationMode: 'seawall',
    bodyColor: 0xd8c7a6,
    foundationColor: 0x9a958b,
    foundationDarkColor: STONE_QUAY_DARK,
    copingColor: 0xb7b1a2,
    foundationSurface: ['road.glb', 'road-edge.glb', 'road-corner.glb'],
    seawallSide: ['wall-arch.glb', 'wall-block.glb', 'wall-arch-top.glb'],
    seawallCorner: ['wall-corner-edge.glb', 'wall-rounded.glb', 'wall-corner.glb'],
    seawallInnerCorner: ['road-corner-inner.glb', 'wall-corner-diagonal.glb', 'road-bend.glb'],
    rockEdge: ['rock-wide.glb', 'rock-small.glb', 'rock-large.glb'],
    wall: 'wall.glb',
    wallWindow: ['wall-window-round.glb', 'wall-window-glass.glb', 'wall-window-shutters.glb'],
    wallCorner: 'wall-corner-detail.glb',
    wallDoor: 'wall-door.glb',
    balcony: [null, 'balcony-wall.glb', null],
    roofs: {
      roof_peak: ['roof-high-point.glb', 'roof-high-window.glb', 'roof-high-point.glb'],
      roof_gable: ['roof-high-gable.glb', 'roof-high-gable-detail.glb', 'roof-high-gable.glb'],
      roof_flat: ['roof-high-flat.glb', 'roof-high-flat.glb', 'roof-flat.glb'],
      roof_hip_corner: ['roof-high-corner.glb', 'roof-high-corner.glb', 'roof-corner.glb'],
      roof_t_junction: ['roof-high-gable-top.glb', 'roof-high-gable-detail.glb', 'roof-gable-top.glb'],
    },
  },
  garden: {
    foundationMode: 'seawall',
    bodyColor: 0xd7d2b8,
    foundationColor: 0x9ca28f,
    foundationDarkColor: 0x737b6c,
    copingColor: 0xbac1aa,
    foundationSurface: ['road.glb', 'road-bend.glb', 'road-edge.glb'],
    seawallSide: ['wall-block.glb', 'wall-arch.glb', 'wall-rounded.glb'],
    seawallCorner: ['wall-rounded.glb', 'wall-corner-edge.glb', 'wall-corner.glb'],
    seawallInnerCorner: ['road-corner-inner.glb', 'wall-corner-diagonal.glb', 'road-bend.glb'],
    rockEdge: ['rock-small.glb', 'rock-wide.glb', 'rock-large.glb'],
    wall: 'wall.glb',
    wallWindow: ['wall-window-small.glb', 'wall-window-round.glb', 'wall-window-shutters.glb'],
    wallCorner: 'wall-corner.glb',
    wallDoor: 'wall-door.glb',
    balcony: [null, null, 'balcony-wall-fence.glb'],
    roofs: {
      roof_peak: ['roof-point.glb', 'roof-window.glb', 'roof-point.glb'],
      roof_gable: ['roof-gable.glb', 'roof-gable-detail.glb', 'roof-gable.glb'],
      roof_flat: ['roof-flat.glb', 'roof-flat.glb', 'roof-gable-top.glb'],
      roof_hip_corner: ['roof-corner.glb', 'roof-corner-inner.glb', 'roof-corner.glb'],
      roof_t_junction: ['roof-gable-top.glb', 'roof-gable-detail.glb', 'roof-gable-top.glb'],
    },
  },
  market: {
    foundationMode: 'seawall',
    bodyColor: 0xf1c48f,
    foundationColor: 0x9a958b,
    foundationDarkColor: STONE_QUAY_DARK,
    copingColor: 0xb7b1a2,
    foundationSurface: ['road-corner.glb', 'road.glb', 'road-curb.glb'],
    seawallSide: ['wall-arch.glb', 'wall-arch-top.glb', 'wall-block.glb'],
    seawallCorner: ['wall-corner-edge.glb', 'wall-corner.glb', 'wall-rounded.glb'],
    seawallInnerCorner: ['road-corner-inner.glb', 'wall-corner-diagonal.glb', 'road-bend.glb'],
    rockEdge: ['rock-small.glb', 'rock-wide.glb', 'rock-large.glb'],
    pillar: 'pillar-stone.glb',
    wall: 'wall.glb',
    wallWindow: ['wall-window-shutters.glb', 'wall-window-round.glb', 'wall-window-small.glb'],
    wallCorner: 'wall-corner-detail.glb',
    wallDoor: 'wall-door.glb',
    balcony: ['balcony-wall.glb', 'balcony-wall-fence.glb', 'balcony-wall.glb'],
    roofs: {
      roof_peak: ['roof-window.glb', 'roof-point.glb', 'roof-high-point.glb'],
      roof_gable: ['roof-gable-detail.glb', 'roof-gable.glb', 'roof-high-gable.glb'],
      roof_flat: ['roof-gable-top.glb', 'roof-flat.glb', 'roof-high-flat.glb'],
      roof_hip_corner: ['roof-corner.glb', 'roof-high-corner.glb', 'roof-corner.glb'],
      roof_t_junction: ['roof-gable-detail.glb', 'roof-gable-top.glb', 'roof-high-gable-top.glb'],
    },
  },
}

const fallbackTownColormapUrl = new URL(
  './models/kenney-town-kit/Textures/colormap.png',
  import.meta.url
).href

const _loadingManager = new THREE.LoadingManager()
_loadingManager.setURLModifier((url) => {
  const normalized = url.replace(/\\/g, '/')
  if (normalized.endsWith('Textures/colormap.png') || normalized.endsWith('/colormap.png')) {
    return resolveKitTextureUrl(_activeTextureVariation, _activeKitId)
      ?? resolveKitTextureUrl('colormap.png', _activeKitId)
      ?? fallbackTownColormapUrl
  }
  return url
})

const _loader = new GLTFLoader(_loadingManager)

// ===== Placeholder Geometry Definitions =====
// Theo DATA_MODELS.md mục 8 — Placeholder primitives (Phase 0-4)
const PLACEHOLDER_DEFS = {
  foundation_seawall_straight: () => _makePlaceholder(
    new THREE.BoxGeometry(1.08, 1, 1.08),
    STONE_QUAY_COLOR
  ),
  foundation_seawall_corner: () => _makePlaceholder(
    new THREE.BoxGeometry(1.08, 1, 1.08),
    STONE_QUAY_COLOR
  ),
  foundation_seawall_inner_corner: () => _makePlaceholder(
    new THREE.BoxGeometry(1.08, 1, 1.08),
    STONE_QUAY_COLOR
  ),
  foundation_seawall_end: () => _makePlaceholder(
    new THREE.BoxGeometry(1.08, 1, 1.08),
    STONE_QUAY_COLOR
  ),
  foundation_seawall_round: () => _makePlaceholder(
    new THREE.BoxGeometry(1.08, 1, 1.08),
    STONE_QUAY_COLOR
  ),
  foundation_plaza_tile: () => _makePlaceholder(
    new THREE.BoxGeometry(1.06, 0.26, 1.06),
    STONE_PLATFORM_COLOR
  ),
  foundation_water_edge: () => _makePlaceholder(
    new THREE.BoxGeometry(1.08, 1, 1.08),
    STONE_QUAY_COLOR
  ),
  foundation_stairs: () => _makePlaceholder(
    new THREE.BoxGeometry(1.06, 0.72, 1.06),
    STONE_QUAY_COLOR
  ),
  foundation_rock_edge: () => _makePlaceholder(
    new THREE.BoxGeometry(1.08, 1, 1.08),
    STONE_QUAY_COLOR
  ),
  surface_building_footprint: () => _makePlaceholder(
    new THREE.BoxGeometry(0.72, 0.04, 0.72),
    0xb7b3a6
  ),
  surface_plaza_center: () => _makePlaceholder(
    new THREE.BoxGeometry(0.94, 0.04, 0.94),
    0xa4a9aa
  ),
  surface_plaza_edge: () => _makePlaceholder(
    new THREE.BoxGeometry(0.94, 0.04, 0.82),
    0x9aa2a6
  ),
  surface_plaza_corner: () => _makePlaceholder(
    new THREE.BoxGeometry(0.82, 0.04, 0.82),
    0x9aa2a6
  ),
  surface_walkway_straight: () => _makePlaceholder(
    new THREE.BoxGeometry(0.86, 0.04, 0.38),
    0x9aa2a6
  ),
  surface_walkway_corner: () => _makePlaceholder(
    new THREE.BoxGeometry(0.68, 0.04, 0.68),
    0x9aa2a6
  ),
  surface_walkway_t: () => _makePlaceholder(
    new THREE.BoxGeometry(0.88, 0.04, 0.88),
    0x9aa2a6
  ),
  surface_walkway_cross: () => _makePlaceholder(
    new THREE.BoxGeometry(0.88, 0.04, 0.88),
    0x9aa2a6
  ),
  surface_walkway_end: () => _makePlaceholder(
    new THREE.BoxGeometry(0.72, 0.04, 0.38),
    0x9aa2a6
  ),
  surface_entrance: () => _makePlaceholder(
    new THREE.BoxGeometry(0.78, 0.04, 0.5),
    0xc2bdad
  ),
  surface_quay_promenade: () => _makePlaceholder(
    new THREE.BoxGeometry(0.96, 0.04, 0.58),
    0x8f968f
  ),
  surface_quay_corner: () => _makePlaceholder(
    new THREE.BoxGeometry(0.88, 0.04, 0.88),
    0x8f968f
  ),
  surface_garden_patch: () => _makePlaceholder(
    new THREE.BoxGeometry(0.72, 0.04, 0.72),
    0x9fbf9a
  ),
  surface_waterfront_step: () => _makePlaceholder(
    new THREE.BoxGeometry(0.82, 0.08, 0.42),
    0xb9b5a6
  ),
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
    console.log(`[AssetManager] Active kit: ${_activeKitId}`)
    console.log(`[AssetManager] Texture variation: ${_activeTextureVariation}`)
    const keysToLoad = ['_fallback']
    const materialKeys = []
    for (const key of keysToLoad) {
      if (key === '_fallback') {
        materialKeys.push({ key, material: DEFAULT_MATERIAL, variant: 0 })
        continue
      }
      // Runtime now renders VisualRecipe layers from raw GLB prototypes.
      // Keep one fallback prototype per assetType; material/topology variants are
      // generated lazily from the raw cache when the old composite fallback is used.
      materialKeys.push({ key, material: DEFAULT_MATERIAL, variant: 0 })
    }
    const total = materialKeys.length

    for (let i = 0; i < materialKeys.length; i++) {
      const { key, material, variant } = materialKeys[i]
      await _loadModel(key, material, variant)

      // Emit progress
      window.dispatchEvent(new CustomEvent('assetmanager:progress', {
        detail: { loaded: i + 1, total },
      }))

      // Yield control mỗi 5 items để không block UI
      if (i % 5 === 4) {
        await new Promise(r => setTimeout(r, 0))
      }
    }

    await _preloadRawKitModels('kenney-town-kit', BOOT_RAW_MODEL_PRELOAD_FILES, { timeoutMs: 4000 })
    await _preloadRawKitModels('kenney-city-suburban', SUBURBAN_BOOT_RAW_MODEL_PRELOAD_FILES, { timeoutMs: 4000 })

    _ready = true
    console.log(`[AssetManager] Ready — ${_cache.size} GLB assets, ${_placeholderCache.size} placeholder fallbacks`)
    window.dispatchEvent(new CustomEvent('assetmanager:ready'))
    _warmRemainingRawKitModels()
  },

  /**
   * Lấy clone của asset prototype.
   * PHẢI gọi preload trước — nhưng có fallback nếu key chưa sẵn sàng.
   *
   * @param {string} assetType
   * @param {string} [materialId]
   * @param {string} [variantKey]
   * @param {object} [grammarContext]
   * @returns {THREE.Object3D}
   */
  get(assetType, materialId = DEFAULT_MATERIAL, variantKey = '', grammarContext = {}) {
    const material = normalizeMaterialId(materialId)
    const variant = _variantFromKey(assetType, material, variantKey)
    const grammarKey = _grammarCacheKey(assetType, material, variant, grammarContext)
    if (!_cache.has(grammarKey) && _shouldBuildGrammarSpecificPrototype(assetType, grammarContext)) {
      _buildGrammarSpecificPrototype(assetType, material, variant, grammarContext, grammarKey)
    }

    let proto = _cache.get(grammarKey)
      ?? _cache.get(cacheKey(assetType, material, variant))
      ?? _cache.get(cacheKey(assetType, material, 0))
      ?? _cache.get(cacheKey(assetType, DEFAULT_MATERIAL, 0))
      ?? _cache.get(assetType)
    if (!proto) {
      proto = _placeholderCache.get(assetType)
    }
    if (!proto) {
      console.warn(`[AssetManager] '${assetType}' not in cache — using placeholder fallback`)
      proto = _buildPlaceholder(assetType)
    }
    return _clonePrototype(proto)
  },

  getRaw(fileName, options = {}) {
    const kitId = _resolveRawKitId(fileName, options.kitId ?? _activeKitId)
    const raw = _rawModelCache.get(_rawCacheKey(fileName, kitId))
    if (!raw) {
      throw new Error(`[AssetManager] Raw GLB '${fileName}' is not preloaded for ${kitId}`)
    }

    const clone = _clonePrototype(raw)
    clone.userData.kitId = kitId
    normalizeToCell(clone, options.size ?? 1, {
      centerXZ: options.centerXZ !== false,
      alignBottomY: options.alignBottomY ?? -0.5,
    })
    _prepareModelMeshes(clone, options.assetType ?? fileName, options.colorable ?? false, options.materialRole, kitId)
    return clone
  },

  setActiveKit(kitId) {
    const kit = getKit(kitId)
    _activeKitId = kit.id
    console.log(`[AssetManager] Active kit: ${_activeKitId}`)
  },

  getActiveKit: () => _activeKitId,

  getKitModelUrl(fileName, kitId = _activeKitId) {
    return resolveKitModelUrl(fileName, kitId)
  },

  getKitTextureUrl(textureName, kitId = _activeKitId) {
    return resolveKitTextureUrl(textureName, kitId)
  },

  setTextureVariation(textureName = 'original') {
    const kit = getKit(_activeKitId)
    const next = textureName === 'original'
      ? 'original'
      : kit.variations.includes(textureName)
        ? textureName
        : 'original'
    _activeTextureVariation = next
    _textureCache.delete(_textureCacheKey(_activeKitId, next))
    console.log(`[AssetManager] Texture variation: ${_activeTextureVariation}`)
  },

  getTextureVariation: () => _activeTextureVariation,

  isReady: () => _ready,
}

// ===== Internal Helpers =====

async function _preloadRawKitModels(kitId, priorityFiles = [], options = {}) {
  const files = [
    ...new Set([
      ...priorityFiles,
      ...(options.includeAll ? getKitModelFiles(kitId) : []),
    ]),
  ]

  const batchSize = options.includeAll ? 4 : 8
  const timeoutMs = options.timeoutMs ?? 8000
  for (let i = 0; i < files.length; i += batchSize) {
    const batch = files.slice(i, i + batchSize)
    await Promise.all(batch.map(async (fileName) => {
      try {
        await _loadRawModelWithTimeout(fileName, kitId, timeoutMs)
      } catch (err) {
        console.warn(`[AssetManager] Raw GLB preload failed for ${kitId}/${fileName}`, err)
      }
    }))
  }
}

function _loadRawModelWithTimeout(fileName, kitId, timeoutMs = 8000) {
  let timeoutId = null
  const timeout = new Promise((_, reject) => {
    timeoutId = globalThis.setTimeout?.(() => {
      reject(new Error(`Timed out loading ${kitId}/${fileName}`))
    }, timeoutMs)
  })
  return Promise.race([
    _loadRawModel(fileName, kitId),
    timeout,
  ]).finally(() => {
    if (timeoutId !== null) globalThis.clearTimeout?.(timeoutId)
  })
}

function _warmRemainingRawKitModels() {
  globalThis.setTimeout?.(() => {
    _preloadRawKitModels('kenney-town-kit', RAW_MODEL_PRELOAD_FILES, { includeAll: true })
      .catch(err => console.warn('[AssetManager] Background town-kit warmup failed', err))
    _preloadRawKitModels('kenney-city-suburban', SUBURBAN_RAW_MODEL_PRELOAD_FILES, { includeAll: true })
      .catch(err => console.warn('[AssetManager] Background city-suburban warmup failed', err))
  }, 0)
}

function normalizeMaterialId(materialId) {
  return MATERIAL_IDS.includes(materialId) ? materialId : DEFAULT_MATERIAL
}

function cacheKey(assetType, materialId = DEFAULT_MATERIAL, variant = 0) {
  return `${assetType}::${normalizeMaterialId(materialId)}::${variant}`
}

function _grammarCacheKey(assetType, materialId, variant, context = {}) {
  if (!_shouldBuildGrammarSpecificPrototype(assetType, context)) {
    return cacheKey(assetType, materialId, variant)
  }
  if (_isFoundationAsset(assetType)) {
    const open = Array.isArray(context.openDirections)
      ? context.openDirections.join(',')
      : 'generic'
    return `${cacheKey(assetType, materialId, variant)}::open:${open}`
  }
  const open = Array.isArray(context.openDirections)
    ? context.openDirections.join(',')
    : 'generic'
  const flags = [
    `open:${open}`,
    `primary:${context.primaryOpenDirection ?? 'none'}`,
    `height:${context.height ?? 'n/a'}`,
    context.allowBalcony ? 'balcony' : 'nobalcony',
    context.allowDoor ? 'door' : 'nodoor',
    context.allowWindow ? 'window' : 'nowindow',
    context.useHighRoof ? 'highroof' : 'lowroof',
    context.tower ? 'tower' : 'notower',
  ].join(':')
  return `${cacheKey(assetType, materialId, variant)}::${flags}`
}

function _shouldBuildGrammarSpecificPrototype(assetType, context = {}) {
  return (
    _isFoundationAsset(assetType) ||
    assetType.startsWith('wall_') ||
    assetType.startsWith('roof_')
  ) && Boolean(context && Object.keys(context).length)
}

function _buildGrammarSpecificPrototype(assetType, material, variant, context, key) {
  const parts = _getCompositeParts(assetType, material, variant, context)
  if (!parts) return
  const prototype = _buildCompositeModelFromCache(assetType, parts)
  if (prototype) _cache.set(key, prototype)
}

function _variantFromKey(assetType, materialId, variantKey = '') {
  if (!variantKey) return 0
  const hashInput = `${assetType}:${materialId}:${variantKey}`
  let hash = 5381
  for (let i = 0; i < hashInput.length; i++) {
    hash = ((hash << 5) + hash) + hashInput.charCodeAt(i)
    hash = hash & hash
  }
  return Math.abs(hash) % VISUAL_VARIANT_COUNT
}

function modelUrl(fileName) {
  const url = resolveKitModelUrl(fileName, 'kenney-town-kit') ?? MODEL_FILE_URLS[fileName]
  if (!url) {
    throw new Error(`No Vite asset URL registered for ${fileName}`)
  }
  return url
}

function _rawCacheKey(fileName, kitId) {
  return `${kitId}::${fileName}`
}

function _textureCacheKey(kitId, textureName) {
  return `${kitId}::${textureName}`
}

function _resolveRawKitId(fileName, preferredKitId = _activeKitId) {
  if (resolveKitModelUrl(fileName, preferredKitId)) return preferredKitId
  if (resolveKitModelUrl(fileName, _activeKitId)) return _activeKitId
  if (resolveKitModelUrl(fileName, 'kenney-town-kit')) return 'kenney-town-kit'
  if (resolveKitModelUrl(fileName, 'kenney-city-suburban')) return 'kenney-city-suburban'
  return preferredKitId
}

function _activeKitTexture(kitId = _activeKitId) {
  const textureName = _activeTextureVariation
  if (textureName === 'original') return null
  const url = resolveKitTextureUrl(textureName, kitId)
    ?? resolveKitTextureUrl('colormap.png', kitId)
  if (!url) return null

  const key = _textureCacheKey(kitId, textureName)
  if (_textureCache.has(key)) return _textureCache.get(key)

  const texture = _textureLoader.load(url)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.needsUpdate = true
  _textureCache.set(key, texture)
  return texture
}

async function _loadModel(assetType, materialId = DEFAULT_MATERIAL, variant = 0) {
  const material = normalizeMaterialId(materialId)
  const key = cacheKey(assetType, material, variant)
  if (_cache.has(key) || _placeholderCache.has(assetType)) return

  const compositeParts = _getCompositeParts(assetType, material, variant)
  if (compositeParts) {
    try {
      const prototype = await _buildCompositeModel(assetType, compositeParts)
      _cache.set(key, prototype)
      console.log(`[AssetManager] Loaded composite GLB ${assetType} (${material} v${variant})`)
    } catch (err) {
      console.warn(`[AssetManager] Failed to build composite ${assetType} (${material} v${variant}), using placeholder fallback`, err)
      _loadErrors.set(assetType, err)
      _buildPlaceholder(assetType)
    }
    return
  }

  const fileName = MODEL_PATHS[assetType]
  if (!fileName) {
    if (RAW_ONLY_ASSET_TYPES.has(assetType)) {
      _buildPlaceholder(assetType)
      return
    }
    console.warn(`[AssetManager] Missing GLB for ${assetType}, using placeholder fallback`)
    _buildPlaceholder(assetType)
    return
  }

  try {
    const gltf = await _loader.loadAsync(modelUrl(fileName))
    const prototype = gltf.scene
    _prepareModel(prototype, assetType)
    _cache.set(key, prototype)
    console.log(`[AssetManager] Loaded GLB ${assetType} -> ${fileName}`)
  } catch (err) {
    console.warn(`[AssetManager] Failed to load ${fileName}, using placeholder fallback`, err)
    _loadErrors.set(assetType, err)
    _buildPlaceholder(assetType)
  }
}

function _pick(value, variant = 0) {
  if (!Array.isArray(value)) return value
  return value[variant % value.length]
}

function _getCompositeParts(assetType, materialId = DEFAULT_MATERIAL, variant = 0, context = {}) {
  const material = MATERIAL_CONFIGS[normalizeMaterialId(materialId)] ?? MATERIAL_CONFIGS[DEFAULT_MATERIAL]

  if (_isFoundationAsset(assetType)) {
    if (material.foundationMode === 'pier' && (assetType === 'foundation_arch' || assetType === 'foundation_seawall_straight' || assetType === 'foundation_seawall_corner' || assetType === 'foundation_seawall_end' || assetType === 'foundation_seawall_round')) {
      return _getPierFoundationParts(material, variant)
    }
    return _getSeawallFoundationParts(assetType, material, variant, context)
  }

  if (assetType === 'foundation_arch') {
    const surface = _pick(material.foundationSurface, variant)
    return [
      { file: surface, size: 1.08, position: [0, 0.9, 0], colorable: false },
      { kind: 'box', size: [1.08, 0.07, 1.08], position: [0, 0.39, 0], color: material.foundationColor, colorable: false },
      { file: material.pillar, size: 0.88, position: [-0.43, 0, -0.43], colorable: false },
      { file: material.pillar, size: 0.88, position: [0.43, 0, -0.43], colorable: false },
      { file: material.pillar, size: 0.88, position: [-0.43, 0, 0.43], colorable: false },
      { file: material.pillar, size: 0.88, position: [0.43, 0, 0.43], colorable: false },
    ]
  }

  if (assetType === 'foundation_solid') {
    return [
      { kind: 'box', size: [1.06, 0.18, 1.06], position: [0, 0.34, 0], color: material.foundationColor, colorable: false },
      { file: _pick(material.foundationSurface, variant), size: 1.08, position: [0, 0.9, 0], colorable: false },
    ]
  }

  if (assetType === 'foundation_wall' || assetType === 'wall_mid') {
    return _getFacadeParts(assetType, material, variant, context, {
      bodyColor: assetType === 'foundation_wall' ? material.foundationColor : material.bodyColor,
    })
  }

  if (
    assetType === 'wall_flat' ||
    assetType === 'wall_window' ||
    assetType === 'wall_corner' ||
    assetType === 'wall_door'
  ) {
    return _getFacadeParts(assetType, material, variant, context)
  }

  if (assetType.startsWith('roof_')) {
    const roofFile = _pick(
      _roofOptionsForContext(material, assetType, context),
      variant
    )
    if (!roofFile) return COMPOSITE_ASSETS[assetType] ?? null
    const parts = _getFacadeParts('wall_window', material, variant, context, {
      bodyHeight: assetType === 'roof_flat' ? 0.88 : 0.86,
      bodyY: assetType === 'roof_flat' ? -0.06 : -0.08,
      roofBase: true,
    })
    return [
      ...parts,
      { file: roofFile, layer: 'roofLayer', size: assetType === 'roof_flat' ? 1.12 : 1.14, position: [0, assetType === 'roof_flat' ? 0.9 : 0.91, 0], colorable: false },
    ]
  }

  return COMPOSITE_ASSETS[assetType] ?? null
}

function _getFacadeParts(assetType, material, variant = 0, context = {}, options = {}) {
  const bodyHeight = options.bodyHeight ?? 1.0
  const bodyY = options.bodyY ?? 0
  const bodyColor = options.bodyColor ?? material.bodyColor
  const openWorld = Array.isArray(context.openDirections) && context.openDirections.length
    ? context.openDirections
    : (context.isExterior ? [context.primaryOpenDirection ?? 2] : [])
  const openLocal = openWorld.map(direction => _worldDirectionToLocal(direction, context.rotation ?? 0))
  const primaryWorld = context.primaryOpenDirection ?? openWorld[0] ?? 2
  const primaryLocal = _worldDirectionToLocal(primaryWorld, context.rotation ?? 0)

  const parts = [
    {
      kind: 'box',
      layer: 'facadeLayer',
      size: [1.04, bodyHeight, 1.04],
      position: [0, bodyY, 0],
      color: bodyColor,
      colorable: true,
    },
  ]

  if (assetType === 'wall_corner') {
    parts.push({
      file: material.wallCorner,
      layer: 'facadeLayer',
      size: 1.02,
      position: [0, bodyY, 0],
      colorable: false,
    })
  }

  openLocal.forEach((localDirection, index) => {
    const worldDirection = openWorld[index]
    const detailType = _facadeDetailType(assetType, context, worldDirection, index)
    const side = _sideTransform(localDirection)

    if (localDirection === primaryLocal && assetType !== 'wall_corner') {
      const facadeFile = _facadeModelFile(detailType, material, variant)
      if (facadeFile) {
        parts.push({
          file: facadeFile,
          layer: 'facadeLayer',
          size: 0.96,
          position: [0, bodyY, 0],
          rotation: side.rotation,
          colorable: false,
        })
      }
    }

    parts.push(..._facadeDetailParts(localDirection, detailType, bodyY))

    const shouldBalcony = detailType === 'balcony' || (context.allowBalcony &&
      detailType !== 'door' &&
      _contextHash(context, `balcony:${worldDirection}`) % 4 === 0
    )
    if (shouldBalcony) {
      parts.push(..._balconyParts(localDirection, bodyY))
      const balconyFile = _pick(material.balcony, variant)
      if (balconyFile && localDirection === primaryLocal) {
        parts.push({
          file: balconyFile,
          layer: 'facadeLayer',
          size: 0.48,
          position: _sidePosition(localDirection, 0.62, bodyY - 0.12),
          rotation: side.rotation,
          centerXZ: true,
          colorable: false,
        })
      }
    }
  })

  return parts
}

function _facadeModelFile(detailType, material, variant) {
  if (detailType === 'door') return material.wallDoor
  if (detailType === 'balcony') return _pick(material.wallWindow, variant)
  if (detailType === 'window') return _pick(material.wallWindow, variant)
  return material.wall
}

function _facadeDetailType(assetType, context, worldDirection, index) {
  const recipeFacade = _recipeFacadeForDirection(context, worldDirection)
  if (recipeFacade?.detail) {
    return recipeFacade.detail
  }

  if (
    context.allowDoor &&
    (assetType === 'wall_door' || (worldDirection === context.primaryOpenDirection && _contextHash(context, `door:${worldDirection}`) % 5 === 0))
  ) {
    return 'door'
  }

  if (!context.allowWindow) return 'plain'

  if (assetType === 'wall_window') return 'window'
  if (assetType === 'wall_corner' && index < 2) return 'window'

  return _contextHash(context, `window:${worldDirection}`) % 10 < 6
    ? 'window'
    : 'plain'
}

function _recipeFacadeForDirection(context = {}, direction) {
  if (!Array.isArray(context.facadeLayer)) return null
  const side = _worldDirectionToSide(direction)
  return context.facadeLayer.find(item => item.side === side) ?? null
}

function _worldDirectionToSide(direction) {
  if (direction === 0) return 'west'
  if (direction === 1) return 'east'
  if (direction === 3) return 'north'
  return 'south'
}

function _facadeDetailParts(direction, detailType, bodyY = 0) {
  if (detailType === 'plain') {
    return [_sideBox(direction, 0.58, 0.08, 0.028, 0.08 + bodyY, 0.535, 0xe4c28f, false)]
  }

  if (detailType === 'door') {
    return [
      _sideBox(direction, 0.36, 0.62, 0.038, -0.18 + bodyY, 0.546, 0x8a4d25, false),
      _sideBox(direction, 0.42, 0.08, 0.044, 0.15 + bodyY, 0.552, 0x5a3422, false),
    ]
  }

  return [
    _sideBox(direction, 0.36, 0.34, 0.035, 0.1 + bodyY, 0.548, 0x79aec0, false),
    _sideBox(direction, 0.44, 0.42, 0.026, 0.1 + bodyY, 0.544, 0xd8b878, false),
    _sideBox(direction, 0.05, 0.42, 0.04, 0.1 + bodyY, 0.552, 0x5f3a23, false),
  ]
}

function _balconyParts(direction, bodyY = 0) {
  return [
    _sideBox(direction, 0.64, 0.07, 0.28, -0.26 + bodyY, 0.66, 0xb97942, false),
    _sideBox(direction, 0.64, 0.16, 0.045, -0.15 + bodyY, 0.8, 0x7a4b2b, false),
  ]
}

function _sideBox(direction, width, height, depth, y, offset, color, colorable) {
  const side = _sideTransform(direction)
  const alongX = direction === 2 || direction === 3
  return {
    kind: 'box',
    layer: 'facadeLayer',
    size: alongX ? [width, height, depth] : [depth, height, width],
    position: [side.x * offset, y, side.z * offset],
    color,
    roughness: 0.82,
    colorable,
  }
}

function _sidePosition(direction, offset, y) {
  const side = _sideTransform(direction)
  return [side.x * offset, y, side.z * offset]
}

function _isFoundationAsset(assetType) {
  return assetType === 'foundation_arch' ||
    assetType === 'foundation_solid' ||
    assetType === 'foundation_wall' ||
    assetType.startsWith('foundation_seawall_') ||
    assetType === 'foundation_plaza_tile' ||
    assetType === 'foundation_water_edge' ||
    assetType === 'foundation_stairs' ||
    assetType === 'foundation_rock_edge'
}

function _getSeawallFoundationParts(assetType, material, variant = 0, context = {}) {
  if (assetType === 'foundation_wall') {
    return [
      { kind: 'box', size: [1.06, 1.0, 1.06], position: [0, 0, 0], color: material.foundationColor, colorable: true },
    ]
  }

  if (assetType === 'foundation_stairs') {
    return [
      { kind: 'box', size: [1.06, 0.72, 1.06], position: [0, -0.14, 0], color: material.foundationColor, colorable: false },
      { file: 'stairs-stone.glb', size: 1.08, position: [0, 0.36, 0], colorable: false },
    ]
  }

  const exposed = _foundationOpenDirections(assetType, context)
  const parts = [
    { kind: 'box', size: [1.08, 0.84, 1.08], position: [0, -0.08, 0], color: material.foundationColor, roughness: 0.92, colorable: false },
    { kind: 'box', size: [1.12, 0.08, 1.12], position: [0, 0.39, 0], color: material.copingColor, roughness: 0.9, colorable: false },
    { file: _pick(material.foundationSurface, variant), size: 1.08, position: [0, 0.88, 0], colorable: false },
  ]

  if (assetType === 'foundation_plaza_tile' || exposed.length === 0) {
    return parts
  }

  for (const direction of exposed) {
    parts.push(..._seawallSideParts(direction, material, variant))
  }

  if (exposed.length >= 2) {
    parts.push(..._seawallCornerCopingParts(exposed, material))
  }

  if (assetType === 'foundation_rock_edge' || material.rockEdge) {
    const rockDirection = exposed[variant % exposed.length] ?? 2
    if (assetType === 'foundation_rock_edge' || variant === 2) {
      parts.push(_edgeDetailPart(_pick(material.rockEdge, variant), rockDirection))
    }
  }

  return parts
}

function _getPierFoundationParts(material, variant = 0) {
  const surface = _pick(material.foundationSurface, variant)
  return [
    { file: surface, size: 1.08, position: [0, 0.9, 0], colorable: false },
    { kind: 'box', size: [1.08, 0.07, 1.08], position: [0, 0.39, 0], color: material.foundationColor, colorable: false },
    { file: material.pillar, size: 0.88, position: [-0.43, 0, -0.43], colorable: false },
    { file: material.pillar, size: 0.88, position: [0.43, 0, -0.43], colorable: false },
    { file: material.pillar, size: 0.88, position: [-0.43, 0, 0.43], colorable: false },
    { file: material.pillar, size: 0.88, position: [0.43, 0, 0.43], colorable: false },
  ]
}

function _foundationOpenDirections(assetType, context = {}) {
  if (Array.isArray(context.openDirections)) return context.openDirections
  if (assetType === 'foundation_seawall_straight' || assetType === 'foundation_water_edge') return [2]
  if (assetType === 'foundation_seawall_corner') return [2, 1]
  if (assetType === 'foundation_seawall_inner_corner') return [0, 2]
  if (assetType === 'foundation_seawall_end') return [0, 1, 2]
  if (assetType === 'foundation_seawall_round' || assetType === 'foundation_arch') return [0, 1, 2, 3]
  return []
}

function _seawallSideParts(direction, material, variant) {
  const side = _sideTransform(direction)
  const alongX = direction === 2 || direction === 3
  return [
    {
      kind: 'box',
      size: alongX ? [1.1, 0.66, 0.12] : [0.12, 0.66, 1.1],
      position: [side.x * 0.53, -0.12, side.z * 0.53],
      color: material.foundationDarkColor,
      roughness: 0.94,
      colorable: false,
    },
    {
      kind: 'box',
      size: alongX ? [1.08, 0.11, 0.16] : [0.16, 0.11, 1.08],
      position: [side.x * 0.52, 0.36, side.z * 0.52],
      color: material.copingColor,
      roughness: 0.88,
      colorable: false,
    },
    {
      kind: 'arch',
      width: 0.36,
      height: 0.46,
      position: [side.x * 0.594, -0.18, side.z * 0.594],
      rotation: side.rotation,
      color: 0x28343a,
      colorable: false,
    },
  ]
}

function _seawallCornerCopingParts(exposed, material) {
  const parts = []
  const corners = [
    { dirs: [2, 1], pos: [0.5, 0.41, 0.5] },
    { dirs: [1, 3], pos: [0.5, 0.41, -0.5] },
    { dirs: [3, 0], pos: [-0.5, 0.41, -0.5] },
    { dirs: [0, 2], pos: [-0.5, 0.41, 0.5] },
  ]
  for (const corner of corners) {
    if (corner.dirs.every(dir => exposed.includes(dir))) {
      parts.push({
        kind: 'box',
        size: [0.2, 0.12, 0.2],
        position: corner.pos,
        color: material.copingColor,
        roughness: 0.88,
        colorable: false,
      })
    }
  }
  return parts
}

function _edgeDetailPart(file, direction) {
  const side = _sideTransform(direction)
  return {
    file,
    size: 0.34,
    position: [side.x * 0.62, -0.45, side.z * 0.62],
    rotation: side.rotation,
    colorable: false,
  }
}

function _sideTransform(direction) {
  if (direction === 0) return { x: -1, z: 0, rotation: Math.PI / 2 }
  if (direction === 1) return { x: 1, z: 0, rotation: -Math.PI / 2 }
  if (direction === 3) return { x: 0, z: -1, rotation: Math.PI }
  return { x: 0, z: 1, rotation: 0 }
}

function _worldDirectionToLocal(direction, rootRotation = 0) {
  const turns = Math.round(rootRotation / (Math.PI / 2))
  return _rotateDirection(direction, -turns)
}

function _rotateDirection(direction, turns) {
  let normalized = direction
  const count = ((turns % 4) + 4) % 4
  for (let i = 0; i < count; i++) {
    if (normalized === 2) normalized = 1
    else if (normalized === 1) normalized = 3
    else if (normalized === 3) normalized = 0
    else normalized = 2
  }
  return normalized
}

function _contextHash(context = {}, salt = '') {
  return _hashString([
    context.cellId ?? 'cell',
    context.height ?? 0,
    context.materialFamily ?? DEFAULT_MATERIAL,
    context.topologySignature ?? '',
    salt,
  ].join('|'))
}

function _hashString(input) {
  let hash = 5381
  for (let i = 0; i < input.length; i++) {
    hash = ((hash << 5) + hash) + input.charCodeAt(i)
    hash = hash & hash
  }
  return Math.abs(hash)
}

function _roofOptionsForContext(material, assetType, context = {}) {
  const regular = material.roofs[assetType]
  if (!context.useHighRoof && !context.tower) return regular

  if (assetType === 'roof_peak') return ['roof-high-point.glb', 'roof-high-point.glb', 'roof-window.glb']
  if (assetType === 'roof_gable') return ['roof-high-gable.glb', 'roof-high-gable-detail.glb', 'roof-gable-detail.glb']
  if (assetType === 'roof_flat') return ['roof-high-flat.glb', 'roof-high-flat.glb', 'roof-flat.glb']
  if (assetType === 'roof_hip_corner') return ['roof-high-corner.glb', 'roof-high-corner.glb', 'roof-corner.glb']
  if (assetType === 'roof_t_junction') return ['roof-high-gable-top.glb', 'roof-high-gable-detail.glb', 'roof-gable-top.glb']
  return regular
}

async function _loadRawModel(fileName, kitId = _activeKitId) {
  const resolvedKitId = _resolveRawKitId(fileName, kitId)
  const key = _rawCacheKey(fileName, resolvedKitId)
  if (_rawModelCache.has(key)) {
    return _rawModelCache.get(key)
  }

  const url = resolveKitModelUrl(fileName, resolvedKitId) ?? modelUrl(fileName)
  const gltf = await _loader.loadAsync(url)
  gltf.scene.userData.kitId = resolvedKitId
  _rawModelCache.set(key, gltf.scene)
  console.log(`[AssetManager] Loaded: ${fileName}`)
  return gltf.scene
}

async function _buildCompositeModel(assetType, parts) {
  const group = new THREE.Group()
  group.name = `kenney_${assetType}`
  group.userData.assetType = assetType
  const layers = _createLayerGroups(assetType)

  for (const partDef of parts) {
    if (partDef.kind) {
      const proceduralPart = _buildProceduralCompositePart(partDef, assetType)
      _addPartToLayer(layers, proceduralPart, assetType, partDef)
      continue
    }

    const raw = await _loadRawModel(partDef.file, partDef.kitId ?? 'kenney-town-kit')
    const part = _clonePrototype(raw)
    normalizeToCell(part, partDef.size ?? 1, {
      centerXZ: partDef.centerXZ !== false,
    })
    part.position.add(new THREE.Vector3(...(partDef.position ?? [0, 0, 0])))
    if (partDef.rotation) part.rotation.y += partDef.rotation
    _prepareModelMeshes(part, assetType, partDef.colorable, partDef.materialRole, raw.userData?.kitId)
    _addPartToLayer(layers, part, assetType, partDef)
  }

  _attachLayers(group, layers)
  return group
}

function _buildCompositeModelFromCache(assetType, parts) {
  const group = new THREE.Group()
  group.name = `kenney_${assetType}`
  group.userData.assetType = assetType
  const layers = _createLayerGroups(assetType)

  for (const partDef of parts) {
    if (partDef.kind) {
      const proceduralPart = _buildProceduralCompositePart(partDef, assetType)
      _addPartToLayer(layers, proceduralPart, assetType, partDef)
      continue
    }

    const rawKitId = _resolveRawKitId(partDef.file, partDef.kitId ?? 'kenney-town-kit')
    const raw = _rawModelCache.get(_rawCacheKey(partDef.file, rawKitId))
    if (!raw) return null

    const part = _clonePrototype(raw)
    normalizeToCell(part, partDef.size ?? 1, {
      centerXZ: partDef.centerXZ !== false,
    })
    part.position.add(new THREE.Vector3(...(partDef.position ?? [0, 0, 0])))
    if (partDef.rotation) part.rotation.y += partDef.rotation
    _prepareModelMeshes(part, assetType, partDef.colorable, partDef.materialRole, rawKitId)
    _addPartToLayer(layers, part, assetType, partDef)
  }

  _attachLayers(group, layers)
  return group
}

function _createLayerGroups(assetType) {
  const names = ['foundationLayer', 'facadeLayer', 'roofLayer', 'propLayer']
  return names.reduce((layers, name) => {
    const layer = new THREE.Group()
    layer.name = `${assetType}_${name}`
    layer.userData.layer = name
    layers.set(name, layer)
    return layers
  }, new Map())
}

function _addPartToLayer(layers, part, assetType, partDef = {}) {
  const layerName = partDef.layer ?? _inferLayer(assetType)
  part.userData.layer = layerName
  const layer = layers.get(layerName) ?? layers.get('propLayer')
  layer.add(part)
}

function _attachLayers(group, layers) {
  for (const name of ['foundationLayer', 'facadeLayer', 'roofLayer', 'propLayer']) {
    const layer = layers.get(name)
    if (layer && layer.children.length > 0) {
      group.add(layer)
    }
  }
}

function _inferLayer(assetType) {
  if (_isFoundationAsset(assetType) || assetType === 'bridge_span') return 'foundationLayer'
  if (assetType.startsWith('roof_')) return 'roofLayer'
  if (assetType.startsWith('wall_')) return 'facadeLayer'
  return 'propLayer'
}

function _buildProceduralCompositePart(partDef, assetType) {
  let geometry
  if (partDef.kind === 'box') {
    geometry = new THREE.BoxGeometry(...partDef.size)
  } else if (partDef.kind === 'cylinder') {
    geometry = new THREE.CylinderGeometry(
      partDef.radius ?? 0.08,
      partDef.radiusBottom ?? partDef.radius ?? 0.08,
      partDef.height ?? 1,
      partDef.radialSegments ?? 8
    )
  } else if (partDef.kind === 'arch') {
    const width = partDef.width ?? 0.36
    const height = partDef.height ?? 0.46
    const radius = width * 0.5
    const straightHeight = Math.max(0.01, height - radius)
    const shape = new THREE.Shape()
    shape.moveTo(-width * 0.5, -height * 0.5)
    shape.lineTo(width * 0.5, -height * 0.5)
    shape.lineTo(width * 0.5, -height * 0.5 + straightHeight)
    for (let i = 0; i <= 10; i++) {
      const t = Math.PI * (i / 10)
      const x = Math.cos(t) * radius
      const y = -height * 0.5 + straightHeight + Math.sin(t) * radius
      shape.lineTo(x, y)
    }
    shape.lineTo(-width * 0.5, -height * 0.5)
    geometry = new THREE.ShapeGeometry(shape)
  } else {
    throw new Error(`Unknown composite part kind '${partDef.kind}' for ${assetType}`)
  }

  const material = new THREE.MeshStandardMaterial({
    color: partDef.color ?? WALL_BODY_COLOR,
    roughness: partDef.roughness ?? 0.86,
    metalness: partDef.metalness ?? 0,
  })
  const mesh = new THREE.Mesh(geometry, material)
  mesh.name = `${assetType}_${partDef.kind}`
  mesh.position.set(...(partDef.position ?? [0, 0, 0]))
  if (partDef.rotation) mesh.rotation.y = partDef.rotation
  mesh.castShadow = true
  mesh.receiveShadow = partDef.kind !== 'arch'
  mesh.frustumCulled = false
  mesh.userData.isColorable = partDef.colorable ?? false
  mesh.userData.layer = partDef.layer ?? _inferLayer(assetType)
  return mesh
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

function _prepareModelMeshes(object, assetType, forceColorable = null, materialRole = null, kitId = object?.userData?.kitId) {
  object.traverse((child) => {
    if (!child.isMesh) return

    child.castShadow = true
    child.receiveShadow = true
    child.frustumCulled = false

    const materialList = Array.isArray(child.material) ? child.material : [child.material]
    for (const material of materialList) {
      if (!material) continue
      if (kitId === 'kenney-city-suburban') {
        const variationTexture = _activeKitTexture(kitId)
        if (variationTexture) {
          material.map = variationTexture
        }
      }
      if (material.map) {
        material.map.colorSpace = THREE.SRGBColorSpace
        material.map.needsUpdate = true
      }
      if ('roughness' in material) material.roughness = 0.85
      if ('metalness' in material) material.metalness = 0
      material.needsUpdate = true
    }

    const meshName = child.name.toLowerCase()
    const inferredColorable = (
      meshName.includes('wall') ||
      meshName.includes('body') ||
      assetType.startsWith('wall')
    )
    child.userData.isColorable = forceColorable ?? inferredColorable
    if (materialRole) child.userData.materialRole = materialRole
    if (kitId) child.userData.kitId = kitId
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

function normalizeToCell(object, targetSize = 1, options = {}) {
  const { centerXZ = true, alignBottomY = -0.5 } = options

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

  if (centerXZ) {
    object.position.x -= center2.x
    object.position.z -= center2.z
  }
  object.position.y += alignBottomY - min2.y
}

function _clonePrototype(prototype) {
  const clone = SkeletonUtils.clone(prototype)
  clone.traverse((child) => {
    if (!child.isMesh || !child.material) return
    if (child.geometry) {
      child.geometry = child.geometry.clone()
    }
    if (Array.isArray(child.material)) {
      child.material = child.material.map(material => material.clone())
    } else {
      child.material = child.material.clone()
    }
  })
  return clone
}

export { AssetManager }
