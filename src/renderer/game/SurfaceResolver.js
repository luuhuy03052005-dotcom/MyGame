import {
  getConnectedDirections,
  getOpenDirections,
  rotationFromDirection,
  sideNameFromDirection,
  areOpposite,
} from './FoundationTopologyResolver.js'
import { chance } from '../utils/deterministicHash.js'

const SURFACE_OFFSET_Y = 0.48

function resolve(cell, gridManager, context = {}) {
  if (cell.y !== 0) return []

  const neighbors = gridManager.getNeighbors(cell.x, cell.y, cell.z)
  const hasBuildingAbove = Boolean(gridManager.getCell(cell.x, cell.y + 1, cell.z))
  const openDirections = getOpenDirections(neighbors)
  const walkConnections = getConnectedDirections(neighbors)
  const adjacentBuildings = _adjacentBuildingDirections(cell, gridManager)
  const nearbyDoorDirections = _nearbyDoorDirections(cell, gridManager)
  const materialFamily = context.materialFamily ?? cell.material ?? 'stone_quay'
  const surfaceStyle = context.surfaceStyle
    ?? (context.activeMaterial === 'suburban' || context.activeKit === 'kenney-city-suburban' ? 'suburban' : 'stone_quay')
  const surfaceFamily = materialFamily === 'harbor_pier'
    ? 'harbor_pier'
    : surfaceStyle === 'suburban'
      ? 'suburban'
      : 'stone_quay'
  const topology = _surfaceTopology(walkConnections, openDirections, adjacentBuildings, nearbyDoorDirections)

  if (cell.metadata?.surfaceAssetType) {
    const direction = cell.metadata.surfaceDirection ?? nearbyDoorDirections[0] ?? openDirections[0] ?? 2
    return [_makeSurfaceItem(cell.metadata.surfaceAssetType, cell.metadata.surfaceRole ?? 'entrance', {
      topology,
      walkConnections,
      openDirections,
      rotation: rotationFromDirection(direction),
      side: sideNameFromDirection(direction),
      family: surfaceFamily,
      surfaceStyle,
    })]
  }

  if (hasBuildingAbove) {
    return [_makeSurfaceItem('surface_building_footprint', 'building_footprint', {
      topology,
      walkConnections,
      openDirections,
      rotation: 0,
      subtle: true,
      family: surfaceFamily,
      surfaceStyle,
    })]
  }

  const exposedWaterCount = openDirections.length
  if (materialFamily === 'harbor_pier') {
    return [_pathSurfaceForConnections(walkConnections, topology, {
      family: 'harbor_pier',
      fallbackAsset: 'surface_walkway_straight',
      surfaceStyle,
    })]
  }

  if (nearbyDoorDirections.length > 0) {
    const direction = nearbyDoorDirections[0]
    return [_makeSurfaceItem('surface_entrance', 'entrance', {
      topology,
      walkConnections,
      openDirections,
      rotation: rotationFromDirection(direction),
      side: sideNameFromDirection(direction),
      family: surfaceFamily,
      surfaceStyle,
    })]
  }

  if (adjacentBuildings.length > 0) {
    return [_pathSurfaceForConnections(walkConnections, topology, {
      preferredDirection: adjacentBuildings[0],
      openDirections,
      family: surfaceFamily,
      surfaceStyle,
    })]
  }

  if (exposedWaterCount > 0) {
    const direction = openDirections[0]
    const assetType = exposedWaterCount >= 2 && !_allOpposite(openDirections)
      ? 'surface_quay_corner'
      : 'surface_quay_promenade'
    return [_makeSurfaceItem(assetType, 'quay', {
      topology,
      walkConnections,
      openDirections,
      rotation: rotationFromDirection(direction),
      side: sideNameFromDirection(direction),
      family: surfaceFamily,
      surfaceStyle,
    })]
  }

  if (walkConnections.length >= 3 || chance(`${cell.id}|plaza`, 0.72)) {
    return [_makeSurfaceItem('surface_plaza_center', 'plaza', {
      topology,
      walkConnections,
      openDirections,
      rotation: 0,
      family: surfaceFamily,
      surfaceStyle,
    })]
  }

  return [_pathSurfaceForConnections(walkConnections, topology, { openDirections, family: surfaceFamily, surfaceStyle })]
}

function _pathSurfaceForConnections(walkConnections, topology, options = {}) {
  const connections = walkConnections.length > 0 ? walkConnections : [options.preferredDirection ?? 2]
  let assetType = 'surface_plaza_center'
  let direction = connections[0] ?? 2

  if (connections.length === 1) {
    assetType = 'surface_walkway_end'
  } else if (connections.length === 2) {
    assetType = areOpposite(connections[0], connections[1])
      ? 'surface_walkway_straight'
      : 'surface_walkway_corner'
    direction = _rotationDirectionForTwoConnections(connections)
  } else if (connections.length === 3) {
    assetType = 'surface_walkway_t'
    direction = [0, 1, 2, 3].find(dir => !connections.includes(dir)) ?? 2
  } else if (connections.length >= 4) {
    assetType = 'surface_walkway_cross'
    direction = 2
  }

  return _makeSurfaceItem(options.fallbackAsset ?? assetType, 'walkway', {
    family: options.family,
    surfaceStyle: options.surfaceStyle,
    topology,
    walkConnections: connections,
    openDirections: options.openDirections ?? [],
    rotation: rotationFromDirection(direction),
    side: sideNameFromDirection(direction),
  })
}

function _makeSurfaceItem(assetType, surfaceRole, options = {}) {
  return {
    assetType,
    role: 'surface',
    surfaceRole,
    rotation: options.rotation ?? 0,
    side: options.side,
    positionOffset: [0, SURFACE_OFFSET_Y, 0],
    scale: 1,
    topology: options.topology ?? '',
    walkConnections: options.walkConnections ?? [],
    openDirections: options.openDirections ?? [],
    colorable: false,
    subtle: options.subtle ?? false,
    family: options.family ?? 'stone_quay',
    surfaceStyle: options.surfaceStyle ?? 'stone_quay',
  }
}

function _adjacentBuildingDirections(cell, gridManager) {
  const dirs = [
    [0, -1, 0],
    [1, 1, 0],
    [2, 0, 1],
    [3, 0, -1],
  ]
  return dirs
    .filter(([, dx, dz]) => Boolean(gridManager.getCell(cell.x + dx, cell.y + 1, cell.z + dz)))
    .map(([direction]) => direction)
}

function _nearbyDoorDirections(cell, gridManager) {
  const buildingDirections = _adjacentBuildingDirections(cell, gridManager)
  return buildingDirections.filter(direction => {
    const [dx, dz] = _directionOffset(direction)
    const buildingCell = gridManager.getCell(cell.x + dx, cell.y + 1, cell.z + dz)
    const recipe = buildingCell?.visualRecipe
    if (!recipe?.facadeLayer) return true
    const opposite = _oppositeDirection(direction)
    const side = sideNameFromDirection(opposite)
    return recipe.facadeLayer.some(item => item.side === side && item.detail === 'door')
  })
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

function _rotationDirectionForTwoConnections(connections) {
  if (areOpposite(connections[0], connections[1])) {
    return connections.includes(0) && connections.includes(1) ? 2 : 1
  }
  if (connections.includes(0) && connections.includes(2)) return 2
  if (connections.includes(1) && connections.includes(2)) return 1
  if (connections.includes(1) && connections.includes(3)) return 3
  return 0
}

function _allOpposite(directions) {
  return directions.length === 2 && areOpposite(directions[0], directions[1])
}

function _surfaceTopology(walkConnections, openDirections, adjacentBuildings, nearbyDoorDirections) {
  return [
    `w${walkConnections.join('') || 'none'}`,
    `o${openDirections.join('') || 'none'}`,
    `b${adjacentBuildings.join('') || 'none'}`,
    `d${nearbyDoorDirections.join('') || 'none'}`,
  ].join('|')
}

const SurfaceResolver = {
  resolve,
}

export { SurfaceResolver }
