const modelUrls = {
  ...import.meta.glob('./models/kenney-town-kit/*.glb', {
    eager: true,
    query: '?url',
    import: 'default',
  }),
  ...import.meta.glob('./models/kenney-city-suburban/*.glb', {
    eager: true,
    query: '?url',
    import: 'default',
  }),
}

const textureUrls = {
  ...import.meta.glob('./models/kenney-town-kit/**/*.png', {
    eager: true,
    query: '?url',
    import: 'default',
  }),
  ...import.meta.glob('./models/kenney-city-suburban/**/*.png', {
    eager: true,
    query: '?url',
    import: 'default',
  }),
}

function filesForKitBase(basePath) {
  return Object.keys(modelUrls)
    .filter(path => path.startsWith(basePath))
    .map(path => path.slice(basePath.length))
    .sort()
}

const suburbanPrefabs = Object.fromEntries(
  'abcdefghijklmnopqrstu'.split('').map(letter => [
    `prefab_house_${letter}`,
    `building-type-${letter}.glb`,
  ])
)

const KIT_REGISTRY = {
  'kenney-town-kit': {
    id: 'kenney-town-kit',
    label: 'Kenney Town Kit',
    basePath: './models/kenney-town-kit/',
    texturePath: './models/kenney-town-kit/Textures/',
    variations: ['colormap.png'],
    semanticAssetMap: {
      surface: {
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
      },
      props: {
        prop_banner_green: 'banner-green.glb',
        prop_banner_red: 'banner-red.glb',
        prop_cart: 'cart.glb',
        prop_cart_high: 'cart-high.glb',
        prop_chimney: 'chimney.glb',
        prop_fence: 'fence.glb',
        prop_fence_broken: 'fence-broken.glb',
        prop_fence_curved: 'fence-curved.glb',
        prop_fence_gate: 'fence-gate.glb',
        prop_fountain_center: 'fountain-center.glb',
        prop_fountain_corner: 'fountain-corner.glb',
        prop_fountain_round: 'fountain-round.glb',
        prop_fountain_square: 'fountain-square.glb',
        prop_hedge: 'hedge.glb',
        prop_hedge_curved: 'hedge-curved.glb',
        prop_hedge_gate: 'hedge-gate.glb',
        prop_hedge_large: 'hedge-large.glb',
        prop_lantern: 'lantern.glb',
        prop_stall: 'stall.glb',
        prop_stall_bench: 'stall-bench.glb',
        prop_stall_green: 'stall-green.glb',
        prop_stall_red: 'stall-red.glb',
        prop_tree_small: 'tree.glb',
        prop_tree_large: 'tree-high.glb',
        prop_watermill: 'watermill.glb',
        prop_windmill: 'windmill.glb',
      },
      prefabs: {},
    },
  },
  'kenney-city-suburban': {
    id: 'kenney-city-suburban',
    label: 'Kenney City Kit Suburban 2.0',
    basePath: './models/kenney-city-suburban/',
    texturePath: './models/kenney-city-suburban/Textures/',
    variations: [
      'colormap.png',
      'variation-a.png',
      'variation-b.png',
      'variation-c.png',
    ],
    semanticAssetMap: {
      surface: {
        surface_walkway_straight: 'path-long.glb',
        surface_walkway_end: 'path-short.glb',
        surface_plaza_center: 'path-stones-messy.glb',
        surface_plaza_edge: 'path-stones-long.glb',
        surface_plaza_corner: 'path-stones-short.glb',
        surface_walkway_corner: 'path-short.glb',
        surface_walkway_t: 'path-long.glb',
        surface_walkway_cross: 'path-stones-messy.glb',
        surface_entrance: 'driveway-short.glb',
        surface_driveway_long: 'driveway-long.glb',
        surface_quay_promenade: 'path-long.glb',
        surface_quay_corner: 'path-stones-short.glb',
      },
      props: {
        prop_fence: 'fence.glb',
        prop_fence_low: 'fence-low.glb',
        prop_fence_1x2: 'fence-1x2.glb',
        prop_fence_1x3: 'fence-1x3.glb',
        prop_fence_1x4: 'fence-1x4.glb',
        prop_fence_2x2: 'fence-2x2.glb',
        prop_fence_2x3: 'fence-2x3.glb',
        prop_fence_3x2: 'fence-3x2.glb',
        prop_fence_3x3: 'fence-3x3.glb',
        prop_planter: 'planter.glb',
        prop_tree_small: 'tree-small.glb',
        prop_tree_large: 'tree-large.glb',
      },
      prefabs: suburbanPrefabs,
    },
  },
}

function getKit(kitId) {
  return KIT_REGISTRY[kitId] ?? KIT_REGISTRY['kenney-town-kit']
}

function getKitModelUrl(fileName, kitId = 'kenney-town-kit') {
  const kit = getKit(kitId)
  return modelUrls[`${kit.basePath}${fileName}`] ?? null
}

function getKitTextureUrl(textureName, kitId = 'kenney-town-kit') {
  const kit = getKit(kitId)
  return textureUrls[`${kit.texturePath}${textureName}`] ?? null
}

function getSemanticAsset(role, assetType, kitId = 'kenney-town-kit') {
  const kit = getKit(kitId)
  return kit.semanticAssetMap?.[role]?.[assetType] ?? null
}

function getPrefabAsset(prefabId, kitId = 'kenney-city-suburban') {
  return getSemanticAsset('prefabs', prefabId, kitId)
}

function getAvailableKits() {
  return Object.values(KIT_REGISTRY)
}

function getKitModelFiles(kitId = 'kenney-town-kit') {
  const kit = getKit(kitId)
  return filesForKitBase(kit.basePath)
}

export {
  KIT_REGISTRY,
  getAvailableKits,
  getKit,
  getKitModelFiles,
  getKitModelUrl,
  getKitTextureUrl,
  getSemanticAsset,
  getPrefabAsset,
}
