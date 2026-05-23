import {
  FoundationTopologyResolver,
  getOpenDirections,
  topologySignature,
} from './FoundationTopologyResolver.js'
import { FacadeResolver } from './FacadeResolver.js'
import { RoofResolver } from './RoofResolver.js'
import { SurfaceResolver } from './SurfaceResolver.js'
import { LotResolver } from './LotResolver.js'
import { PathNetworkResolver } from './PathNetworkResolver.js'
import { PropDecorator } from './PropDecorator.js'
import { WaterlineDecorator } from './WaterlineDecorator.js'
import { getPrefabProfile } from './PrefabPlacementMode.js'
import { chance, pickVariant } from '../utils/deterministicHash.js'
import { getPrefabAsset } from '../assets/KitRegistry.js'

const FOUNDATION_MATERIALS = new Set(['stone_quay', 'stone_plaza', 'rock_edge', 'harbor_pier'])
const AUTO_SUBURBAN_PREFABS = ['prefab_house_a', 'prefab_house_b', 'prefab_house_c']
const AUTO_PREFAB_FAMILIES = new Set(['suburban'])

const MATERIAL_ALIASES = {
  stone_quay: 'plaster',
  stone_plaza: 'stone',
  rock_edge: 'stone',
  harbor_pier: 'wood',
  coast: 'plaster',
}

function resolveCell(cell, gridManager, buildContext = {}) {
  const neighbors = gridManager.getNeighbors(cell.x, cell.y, cell.z)
  const openDirections = getOpenDirections(neighbors)
  const topology = _topologySignature(neighbors)
  const baseMaterialFamily = _resolveMaterialFamily(cell, buildContext)
  const materialFamily = _resolveArchitecturalFamily(cell, neighbors, baseMaterialFamily)
  const foundationStyle = _resolveFoundationStyle(cell, buildContext)
  const surfaceStyle = buildContext.surfaceStyle
    ?? (buildContext.activeMaterial === 'suburban' || buildContext.activeKit === 'kenney-city-suburban' ? 'suburban' : 'stone_quay')
  let resolverContext = {
    ...buildContext,
    materialFamily,
    foundationStyle,
    surfaceStyle,
    topologySignature: topology,
  }
  const lot = LotResolver.resolve(cell, gridManager, resolverContext)
  const accessDirections = _resolveAccessDirections(cell, gridManager, openDirections, lot)
  const balconyDirections = _resolveBalconyDirections(cell, gridManager, openDirections)
  resolverContext = {
    ...resolverContext,
    lot,
    accessDirections,
    balconyDirections,
  }

  if (cell.metadata?.prefabId) {
    return _resolvePrefabCell(cell, neighbors, resolverContext, openDirections, topology)
  }

  const autoSuburbanPrefab = _resolveAutoSuburbanPrefabCell(cell, neighbors, resolverContext, openDirections, topology)
  if (autoSuburbanPrefab) return autoSuburbanPrefab

  const foundationLayer = FoundationTopologyResolver.resolve(cell, neighbors, resolverContext)
  const surfaceLayer = PathNetworkResolver.resolve(cell, gridManager, resolverContext)
  const fallbackSurfaceLayer = surfaceLayer.length > 0 ? surfaceLayer : SurfaceResolver.resolve(cell, gridManager, resolverContext)
  const facadeLayer = FacadeResolver.resolve(cell, neighbors, resolverContext)
  const roofLayer = RoofResolver.resolve(cell, neighbors, resolverContext)
  const waterlineLayer = WaterlineDecorator.resolve(cell, neighbors, resolverContext)
  const propLayer = PropDecorator.resolve({
    cell,
    neighbors,
    context: resolverContext,
    lot,
    facadeLayer,
    roofLayer,
    surfaceLayer: fallbackSurfaceLayer,
    waterlineLayer,
  })
  const primary = _primaryLayerItem(cell, foundationLayer, facadeLayer, roofLayer)
  const allowBalcony = facadeLayer.some(item => item.detail === 'balcony')

  return {
    foundationLayer,
    surfaceLayer: fallbackSurfaceLayer,
    facadeLayer,
    roofLayer,
    propLayer,
    prefabLayer: [],
    lot,
    materialFamily,
    foundationStyle,
    surfaceStyle,
    primaryAssetType: primary?.assetType ?? 'wall_flat',
    primaryRotation: primary?.rotation ?? 0,
    primaryRole: primary?.role ?? 'facade',
    openDirections,
    accessDirections,
    balconyDirections,
    primaryOpenDirection: openDirections[0] ?? 2,
    topologySignature: topology,
    foundationTopologySignature: topologySignature(openDirections),
    isExterior: openDirections.length > 0,
    hasSupport: cell.y === 0 || Boolean(neighbors.bottom),
    topExposed: !neighbors.top,
    allowDoor: cell.y === 1 && accessDirections.length > 0,
    allowWindow: cell.y > 0 && openDirections.length > 0,
    allowBalcony: balconyDirections.length > 0 && allowBalcony,
    useHighRoof: !neighbors.top && cell.y >= 3,
    tower: !neighbors.top && cell.y >= 3 && _countHorizontalNeighbors(neighbors) <= 1,
  }
}

function _resolvePrefabCell(cell, neighbors, context, openDirections, topology) {
  const prefabId = cell.metadata.prefabId
  const profile = getPrefabProfile(prefabId)
  return _makePrefabRecipe(cell, neighbors, context, openDirections, topology, {
    prefabId,
    rotation: cell.metadata.prefabRotation ?? context.lot?.entranceRotation ?? 0,
    scale: cell.metadata.prefabScale ?? profile.scale,
    yOffset: cell.metadata.prefabYOffset ?? profile.yOffset,
    entranceSide: cell.metadata.entranceSide ?? context.lot?.entranceSide ?? 'south',
  })
}

function _resolveAutoSuburbanPrefabCell(cell, neighbors, context, openDirections, topology) {
  if (!_canUseAutoSuburbanPrefab(cell, neighbors, context)) return null

  const prefabId = pickVariant(
    `${cell.id}|${topology}|${context.materialFamily}|auto-suburban-prefab`,
    AUTO_SUBURBAN_PREFABS
  )
  const profile = getPrefabProfile(prefabId)

  return _makePrefabRecipe(cell, neighbors, context, openDirections, topology, {
    prefabId,
    rotation: context.lot?.entranceRotation ?? 0,
    scale: profile.scale,
    yOffset: profile.yOffset,
    entranceSide: context.lot?.entranceSide ?? 'south',
    autoPrefab: true,
  })
}

function _canUseAutoSuburbanPrefab(cell, neighbors, context) {
  return cell.y === 1 &&
    context.autoMode !== false &&
    AUTO_PREFAB_FAMILIES.has(context.materialFamily) &&
    Boolean(neighbors.bottom) &&
    !neighbors.top &&
    _countHorizontalNeighbors(neighbors) === 0
}

function _makePrefabRecipe(cell, neighbors, context, openDirections, topology, options) {
  const prefabId = options.prefabId
  const fileName = getPrefabAsset(prefabId, 'kenney-city-suburban')
  const prefabLayer = fileName
    ? [{
        assetType: prefabId,
        role: 'prefab',
        kitId: 'kenney-city-suburban',
        fileName,
        rotation: options.rotation ?? 0,
        positionOffset: [0, options.yOffset ?? 0, 0],
        scale: options.scale ?? 1.08,
        colorable: false,
        entranceSide: options.entranceSide ?? 'south',
        autoPrefab: Boolean(options.autoPrefab),
      }]
    : []

  return {
    foundationLayer: [],
    surfaceLayer: [],
    facadeLayer: [],
    roofLayer: [],
    propLayer: [],
    prefabLayer,
    lot: context.lot,
    materialFamily: 'suburban',
    foundationStyle: 'stone_quay',
    surfaceStyle: 'suburban',
    primaryAssetType: prefabId,
    primaryRotation: options.rotation ?? 0,
    primaryRole: 'prefab',
    openDirections,
    accessDirections: context.lot?.entranceDirection !== undefined ? [context.lot.entranceDirection] : [],
    primaryOpenDirection: context.lot?.entranceDirection ?? openDirections[0] ?? 2,
    topologySignature: topology,
    foundationTopologySignature: '',
    isExterior: openDirections.length > 0,
    hasSupport: Boolean(neighbors.bottom),
    topExposed: !neighbors.top,
    allowDoor: false,
    allowWindow: false,
    allowBalcony: false,
    useHighRoof: false,
    tower: false,
  }
}

function resolveAffectedCells(cellLike, gridManager) {
  const cells = []
  const seen = new Set()

  for (let dx = -1; dx <= 1; dx++) {
    for (let dz = -1; dz <= 1; dz++) {
      for (const cell of gridManager.getAllCells()) {
        if (cell.x === cellLike.x + dx && cell.z === cellLike.z + dz) {
          _addUnique(cells, seen, cell)
        }
      }
    }
  }

  const above = gridManager.getCell(cellLike.x, cellLike.y + 1, cellLike.z)
  const below = gridManager.getCell(cellLike.x, cellLike.y - 1, cellLike.z)
  if (above) _addUnique(cells, seen, above)
  if (below) _addUnique(cells, seen, below)

  return cells
}

function _primaryLayerItem(cell, foundationLayer, facadeLayer, roofLayer) {
  if (cell.y === 0) return foundationLayer[0] ?? null
  if (roofLayer.length > 0) return roofLayer[0]
  if (facadeLayer.length > 0) {
    const door = facadeLayer.find(item => item.detail === 'door')
    const balcony = facadeLayer.find(item => item.detail === 'balcony')
    const window = facadeLayer.find(item => item.detail === 'window')
    return door ?? balcony ?? window ?? facadeLayer[0]
  }
  return { assetType: 'wall_flat', role: 'facade', rotation: 0 }
}

function _resolveProps(cell, neighbors, context, facadeLayer, roofLayer, surfaceLayer = []) {
  const props = []
  if (roofLayer.length > 0 && cell.y >= 2 && chance(`${cell.id}|${context.topologySignature}|chimney`, 0.18)) {
    props.push({
      assetType: 'chimney',
      role: 'prop',
      rotation: 0,
      positionOffset: [0.22, 0.44, -0.18],
      scale: 0.5,
      colorable: false,
      placement: 'roof',
    })
  }

  const doorFacade = facadeLayer.find(item => item.detail === 'door')
  if (doorFacade && chance(`${cell.id}|${doorFacade.side}|lantern`, 0.35)) {
    props.push({
      assetType: 'lantern',
      role: 'prop',
      side: doorFacade.side,
      rotation: doorFacade.rotation,
      positionOffset: [0, 0.05, 0],
      scale: 0.5,
      colorable: false,
      placement: 'facade',
    })
  }

  if (doorFacade && chance(`${cell.id}|${doorFacade.side}|banner`, 0.16)) {
    props.push({
      assetType: pickVariant(`${cell.id}|${doorFacade.side}|banner-kind`, ['prop_banner_green', 'prop_banner_red']),
      role: 'prop',
      side: doorFacade.side,
      rotation: doorFacade.rotation,
      positionOffset: [0, 0.1, 0],
      scale: 0.42,
      kitId: 'kenney-town-kit',
      colorable: false,
      placement: 'facade',
    })
  }

  if (cell.y === 0 && !neighbors.top) {
    props.push(..._resolveSurfaceProps(cell, neighbors, context, surfaceLayer))
  }

  return props
}

function _resolveSurfaceProps(cell, neighbors, context, surfaceLayer = []) {
  const surface = surfaceLayer[0]
  if (!surface) return []

  const seedBase = `${cell.id}|${surface.surfaceRole}|${surface.topology}|${context.surfaceStyle}`
  const props = []

  if (surface.surfaceRole === 'entrance') {
    if (context.surfaceStyle === 'suburban') {
      props.push(_surfaceProp('prop_planter', surface, {
        kitId: 'kenney-city-suburban',
        scale: 0.62,
        sideOffset: 0.24,
        tangentOffset: -0.24,
      }))
    }
    return props
  }

  if (surface.surfaceRole === 'quay') {
    const open = surface.openDirections?.length ? surface.openDirections : [surface.side ? _directionFromSideName(surface.side) : 2]
    const direction = open[0] ?? 2
    if (context.surfaceStyle === 'suburban') {
      props.push(_edgeProp(_fenceVariant(seedBase, open), direction, {
        kitId: 'kenney-city-suburban',
        scale: open.length >= 2 ? 0.94 : 0.84,
      }))
    } else if (chance(`${seedBase}|quay-hedge`, 0.36)) {
      props.push(_edgeProp('prop_hedge', direction, {
        kitId: 'kenney-town-kit',
        scale: 0.48,
      }))
    }
    return props
  }

  if (surface.surfaceRole === 'walkway') {
    if (context.surfaceStyle === 'suburban' && chance(`${seedBase}|walk-fence`, 0.3)) {
      const direction = surface.walkConnections?.[0] ?? 2
      props.push(_edgeProp('prop_fence_low', direction, {
        kitId: 'kenney-city-suburban',
        scale: 0.52,
        sideDistance: 0.42,
      }))
    }
    return props
  }

  if (surface.surfaceRole === 'plaza') {
    const interior = (surface.openDirections?.length ?? 0) === 0
    const plazaChoice = pickVariant(`${seedBase}|plaza-prop-choice`, [
      'none',
      'prop_planter',
      'prop_tree_small',
      'prop_tree_large',
      'prop_hedge',
      'prop_fountain_round',
      'prop_fountain_square',
    ])
    if (interior && (plazaChoice === 'prop_fountain_round' || plazaChoice === 'prop_fountain_square')) {
      props.push(_surfaceProp(pickVariant(`${seedBase}|fountain-kind`, ['prop_fountain_round', 'prop_fountain_square']), surface, {
        kitId: 'kenney-town-kit',
        scale: 0.68,
      }))
    } else if (context.surfaceStyle === 'suburban' && (plazaChoice === 'prop_tree_small' || plazaChoice === 'prop_tree_large')) {
      props.push(_surfaceProp(plazaChoice, surface, {
        kitId: 'kenney-city-suburban',
        scale: plazaChoice === 'prop_tree_large' ? 0.86 : 0.68,
        tangentOffset: 0.22,
        sideOffset: -0.2,
      }))
    } else if (context.materialFamily === 'market' && chance(`${seedBase}|market`, 0.28)) {
      props.push(_surfaceProp(pickVariant(`${seedBase}|market-kind`, ['prop_stall', 'prop_cart']), surface, {
        kitId: 'kenney-town-kit',
        scale: 0.5,
      }))
    } else if (plazaChoice !== 'none') {
      const assetType = context.surfaceStyle === 'suburban' && plazaChoice === 'prop_planter'
        ? 'prop_planter'
        : 'prop_hedge'
      props.push(_surfaceProp(assetType, surface, {
        kitId: context.surfaceStyle === 'suburban' ? 'kenney-city-suburban' : 'kenney-town-kit',
        scale: context.surfaceStyle === 'suburban' ? 0.62 : 0.56,
      }))
    }
  }

  return props
}

function _surfaceProp(assetType, surface, options = {}) {
  const direction = surface.side ? _directionFromSideName(surface.side) : 2
  const [dx, dz] = _directionOffset(direction)
  const tangent = _tangentOffset(direction)
  const sideOffset = options.sideOffset ?? 0
  const tangentOffset = options.tangentOffset ?? 0
  return {
    assetType,
    role: 'prop',
    side: surface.side,
    rotation: surface.rotation ?? 0,
    positionOffset: [
      dx * sideOffset + tangent[0] * tangentOffset,
      0.53,
      dz * sideOffset + tangent[1] * tangentOffset,
    ],
    scale: options.scale ?? 0.5,
    kitId: options.kitId,
    colorable: false,
    placement: 'surface',
  }
}

function _edgeProp(assetType, direction, options = {}) {
  const [dx, dz] = _directionOffset(direction)
  return {
    assetType,
    role: 'prop',
    side: _sideNameFromDirection(direction),
    rotation: _rotationFromDirection(direction),
    positionOffset: [dx * (options.sideDistance ?? 0.46), 0.53, dz * (options.sideDistance ?? 0.46)],
    scale: options.scale ?? 0.55,
    kitId: options.kitId,
    colorable: false,
    placement: 'surface_edge',
  }
}

function _fenceVariant(seed, openDirections) {
  if (openDirections.length >= 2) {
    return pickVariant(`${seed}|corner-fence`, ['prop_fence_2x2', 'prop_fence_2x3', 'prop_fence_3x2', 'prop_fence_3x3'])
  }
  return pickVariant(`${seed}|line-fence`, ['prop_fence', 'prop_fence_low', 'prop_fence_1x2', 'prop_fence_1x3', 'prop_fence_1x4'])
}

function _resolveMaterialFamily(cell, buildContext) {
  const raw = buildContext.materialFamily ?? cell.material ?? 'plaster'
  if (cell.y === 0) return FOUNDATION_MATERIALS.has(raw) ? raw : 'stone_quay'
  return MATERIAL_ALIASES[raw] ?? raw ?? 'plaster'
}

function _resolveArchitecturalFamily(cell, neighbors, family) {
  if (
    cell.y >= 3 &&
    !neighbors.top &&
    _countHorizontalNeighbors(neighbors) <= 1
  ) {
    return 'tower'
  }
  return family
}

function _resolveFoundationStyle(cell, buildContext) {
  const raw = buildContext.foundationStyle ?? cell.material ?? 'stone_quay'
  return raw === 'harbor_pier' ? 'harbor_pier' : 'stone_quay'
}

function _resolveAccessDirections(cell, gridManager, openDirections, lot = {}) {
  if (cell.y !== 1 || openDirections.length === 0) return []
  if (lot.isEntranceHost && openDirections.includes(lot.entranceDirection)) {
    return [lot.entranceDirection]
  }
  if (lot.isEntranceHost === false) return []

  return openDirections.filter(direction => {
    const [dx, dz] = _directionOffset(direction)
    const support = gridManager.getCell(cell.x + dx, cell.y - 1, cell.z + dz)
    const blockingBuilding = gridManager.getCell(cell.x + dx, cell.y, cell.z + dz)
    return Boolean(support) && !blockingBuilding
  })
}

function _resolveBalconyDirections(cell, gridManager, openDirections) {
  if (cell.y < 2 || cell.y > 2 || openDirections.length === 0) return []

  return openDirections.filter(direction => {
    const [dx, dz] = _directionOffset(direction)
    const frontSupport = gridManager.getCell(cell.x + dx, cell.y - 1, cell.z + dz)
    const frontBlocked = gridManager.getCell(cell.x + dx, cell.y, cell.z + dz)
    return Boolean(frontSupport) && !frontBlocked
  })
}

function _directionOffset(direction) {
  if (direction === 0) return [-1, 0]
  if (direction === 1) return [1, 0]
  if (direction === 2) return [0, 1]
  return [0, -1]
}

function _tangentOffset(direction) {
  if (direction === 0 || direction === 1) return [0, 1]
  return [1, 0]
}

function _sideNameFromDirection(direction) {
  if (direction === 0) return 'west'
  if (direction === 1) return 'east'
  if (direction === 3) return 'north'
  return 'south'
}

function _directionFromSideName(side) {
  if (side === 'west') return 0
  if (side === 'east') return 1
  if (side === 'north') return 3
  return 2
}

function _rotationFromDirection(direction) {
  if (direction === 0) return Math.PI / 2
  if (direction === 1) return -Math.PI / 2
  if (direction === 3) return Math.PI
  return 0
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

function _addUnique(cells, seen, cell) {
  if (!cell || seen.has(cell.id)) return
  seen.add(cell.id)
  cells.push(cell)
}

const BuildingGrammarEngine = {
  resolveCell,
  resolveAffectedCells,
}

export { BuildingGrammarEngine }
