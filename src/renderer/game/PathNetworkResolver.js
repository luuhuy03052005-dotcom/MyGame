import {
  areOpposite,
  getConnectedDirections,
  getOpenDirections,
  rotationFromDirection,
  sideNameFromDirection,
} from './FoundationTopologyResolver.js'

const SURFACE_OFFSET_Y = 0.48

function resolve(cell, gridManager, context = {}) {
  if (cell.y !== 0) return []

  const neighbors = gridManager.getNeighbors(cell.x, cell.y, cell.z)
  const openDirections = getOpenDirections(neighbors)
  const walkConnections = _walkConnections(cell, gridManager, neighbors)
  const hasBuildingAbove = Boolean(gridManager.getCell(cell.x, cell.y + 1, cell.z))
  const lot = context.lot ?? {}
  const surfaceStyle = context.surfaceStyle
    ?? (context.activeMaterial === 'suburban' || context.activeKit === 'kenney-city-suburban' ? 'suburban' : 'stone_quay')
  const surfaceFamily = context.materialFamily === 'harbor_pier'
    ? 'harbor_pier'
    : surfaceStyle === 'suburban'
      ? 'suburban'
      : 'stone_quay'
  const topology = _topology(walkConnections, openDirections, lot)

  if (cell.metadata?.surfaceAssetType) {
    const direction = cell.metadata.surfaceDirection ?? lot.entranceDirections?.[0] ?? openDirections[0] ?? 2
    return [_makeSurfaceItem(cell.metadata.surfaceAssetType, cell.metadata.surfaceRole ?? 'entrance', {
      topology,
      walkConnections: _entranceConnections(cell, gridManager, walkConnections, direction),
      openDirections,
      direction,
      family: surfaceFamily,
      surfaceStyle,
      lotRole: 'manual',
    })]
  }

  if (hasBuildingAbove || cell.metadata?.reservationRole === 'prefab_footprint') {
    return [_makeSurfaceItem('surface_building_footprint', 'building_footprint', {
      topology,
      walkConnections,
      openDirections,
      direction: 2,
      family: surfaceFamily,
      surfaceStyle,
      lotRole: 'building_footprint',
      subtle: true,
    })]
  }

  if (lot.isEntranceCell) {
    const direction = lot.entranceDirections?.[0] ?? _nearestBuildingDirection(cell, gridManager) ?? 2
    const assetType = surfaceStyle === 'suburban' ? 'surface_entrance' : 'surface_entrance'
    return [_makeSurfaceItem(assetType, 'entrance', {
      topology,
      walkConnections,
      openDirections,
      direction,
      family: surfaceFamily,
      surfaceStyle,
      lotRole: 'entrance',
    })]
  }

  if (context.materialFamily === 'harbor_pier') {
    return [_pathSurfaceForConnections(walkConnections, {
      family: 'harbor_pier',
      surfaceStyle,
      openDirections,
      topology,
    })]
  }

  if (lot.adjacentBuildingDirections?.length > 0) {
    return [_pathSurfaceForConnections(walkConnections, {
      preferredDirection: lot.adjacentBuildingDirections[0],
      family: surfaceFamily,
      surfaceStyle,
      openDirections,
      topology,
      surfaceRole: 'walkway',
    })]
  }

  if (openDirections.length > 0) {
    const direction = openDirections[0]
    const assetType = openDirections.length >= 2 && !_allOpposite(openDirections)
      ? 'surface_quay_corner'
      : 'surface_quay_promenade'
    return [_makeSurfaceItem(assetType, 'quay', {
      topology,
      walkConnections,
      openDirections,
      direction,
      family: surfaceFamily,
      surfaceStyle,
      lotRole: 'waterfront',
    })]
  }

  if (_isCourtyard(cell, gridManager, walkConnections)) {
    return [_makeSurfaceItem('surface_plaza_center', 'plaza', {
      topology,
      walkConnections,
      openDirections,
      direction: 2,
      family: surfaceFamily,
      surfaceStyle,
      lotRole: 'courtyard',
    })]
  }

  return [_pathSurfaceForConnections(walkConnections, {
    family: surfaceFamily,
    surfaceStyle,
    openDirections,
    topology,
    surfaceRole: 'walkway',
  })]
}

function _walkConnections(cell, gridManager, neighbors) {
  const connected = getConnectedDirections(neighbors)
  const entranceConnections = [0, 1, 2, 3].filter(direction => {
    const [dx, dz] = _directionOffset(direction)
    return Boolean(gridManager.getCell(cell.x + dx, cell.y + 1, cell.z + dz))
  })
  return Array.from(new Set([...connected, ...entranceConnections])).sort()
}

function _entranceConnections(cell, gridManager, walkConnections, entranceDirection) {
  const connections = new Set(walkConnections)
  connections.add(entranceDirection)
  const opposite = _oppositeDirection(entranceDirection)
  const [dx, dz] = _directionOffset(opposite)
  if (gridManager.getCell(cell.x + dx, cell.y + 1, cell.z + dz)) {
    connections.add(opposite)
  }
  return Array.from(connections).sort()
}

function _pathSurfaceForConnections(walkConnections, options = {}) {
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

  return _makeSurfaceItem(assetType, options.surfaceRole ?? 'walkway', {
    topology: options.topology,
    walkConnections: connections,
    openDirections: options.openDirections ?? [],
    direction,
    family: options.family,
    surfaceStyle: options.surfaceStyle,
    lotRole: options.surfaceRole ?? 'walkway',
  })
}

function _makeSurfaceItem(assetType, surfaceRole, options = {}) {
  const direction = options.direction ?? 2
  return {
    assetType,
    role: 'surface',
    surfaceRole,
    rotation: options.rotation ?? rotationFromDirection(direction),
    side: options.side ?? sideNameFromDirection(direction),
    positionOffset: [0, SURFACE_OFFSET_Y, 0],
    scale: 1,
    topology: options.topology ?? '',
    walkConnections: options.walkConnections ?? [],
    openDirections: options.openDirections ?? [],
    colorable: false,
    subtle: options.subtle ?? false,
    family: options.family ?? 'stone_quay',
    surfaceStyle: options.surfaceStyle ?? 'stone_quay',
    lotRole: options.lotRole ?? surfaceRole,
  }
}

function _isCourtyard(cell, gridManager, walkConnections) {
  if (walkConnections.length >= 3) return true
  let adjacentBuildings = 0
  for (const direction of [0, 1, 2, 3]) {
    const [dx, dz] = _directionOffset(direction)
    if (gridManager.getCell(cell.x + dx, cell.y + 1, cell.z + dz)) {
      adjacentBuildings++
    }
  }
  return adjacentBuildings >= 2
}

function _nearestBuildingDirection(cell, gridManager) {
  return [2, 1, 0, 3].find(direction => {
    const [dx, dz] = _directionOffset(direction)
    return Boolean(gridManager.getCell(cell.x + dx, cell.y + 1, cell.z + dz))
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

function _topology(walkConnections, openDirections, lot) {
  return [
    `w${walkConnections.join('') || 'none'}`,
    `o${openDirections.join('') || 'none'}`,
    `e${lot.entranceDirections?.join('') || 'none'}`,
    `b${lot.adjacentBuildingDirections?.join('') || 'none'}`,
  ].join('|')
}

const PathNetworkResolver = {
  resolve,
}

export { PathNetworkResolver }
