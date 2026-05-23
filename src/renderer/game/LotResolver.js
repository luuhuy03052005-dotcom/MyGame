import {
  getOpenDirections,
  rotationFromDirection,
  sideNameFromDirection,
} from './FoundationTopologyResolver.js'

const DIRECTION_ORDER = [2, 1, 0, 3]

function resolve(cell, gridManager, context = {}) {
  const neighbors = gridManager.getNeighbors(cell.x, cell.y, cell.z)
  const openDirections = getOpenDirections(neighbors)

  if (cell.y > 0) {
    return _resolveBuildingLot(cell, gridManager, context, openDirections)
  }

  return _resolveSurfaceLot(cell, gridManager, context, openDirections)
}

function _resolveBuildingLot(cell, gridManager, context, openDirections) {
  const frontDirection = _pickFrontDirection(cell, gridManager, openDirections)
  const [dx, dz] = _directionOffset(frontDirection)
  const entranceCell = {
    x: cell.x + dx,
    y: Math.max(0, cell.y - 1),
    z: cell.z + dz,
  }
  const footprint = _collectFootprint(cell, gridManager)
  const host = _lotHost(footprint)
  const isEntranceHost = host?.x === cell.x && host?.y === cell.y && host?.z === cell.z

  return {
    lotId: `lot_${footprint.map(item => `${item.x}_${item.z}`).sort().join('__')}`,
    role: 'building',
    footprint,
    hostCell: host,
    isEntranceHost,
    frontDirection,
    frontSide: sideNameFromDirection(frontDirection),
    entranceSide: sideNameFromDirection(frontDirection),
    entranceDirection: frontDirection,
    entranceCell,
    entranceRotation: rotationFromDirection(frontDirection),
    yardCells: _candidateYardCells(cell, gridManager, frontDirection),
    sideYardCells: _candidateSideYardCells(cell, gridManager, frontDirection),
    backYardCells: _candidateBackYardCells(cell, gridManager, frontDirection),
    recommendedPaths: isEntranceHost ? [{
      x: entranceCell.x,
      y: entranceCell.y,
      z: entranceCell.z,
      surfaceAssetType: context.surfaceStyle === 'suburban' ? 'surface_entrance' : 'surface_entrance',
      surfaceRole: 'entrance',
      direction: frontDirection,
    }] : [],
    recommendedProps: [],
  }
}

function _resolveSurfaceLot(cell, gridManager, context, openDirections) {
  const adjacentBuildings = _adjacentBuildingDirections(cell, gridManager)
  const entranceBuildings = adjacentBuildings.filter(direction => {
    const [dx, dz] = _directionOffset(direction)
    const building = gridManager.getCell(cell.x + dx, cell.y + 1, cell.z + dz)
    const buildingLot = building ? _resolveBuildingLot(building, gridManager, context, getOpenDirections(gridManager.getNeighbors(building.x, building.y, building.z))) : null
    return buildingLot?.entranceCell?.x === cell.x &&
      buildingLot?.entranceCell?.y === cell.y &&
      buildingLot?.entranceCell?.z === cell.z
  })

  return {
    lotId: `surface_${cell.id}`,
    role: 'surface',
    adjacentBuildingDirections: adjacentBuildings,
    entranceDirections: entranceBuildings,
    isEntranceCell: entranceBuildings.length > 0 || cell.metadata?.surfaceRole === 'entrance',
    openDirections,
    recommendedPaths: [],
    recommendedProps: [],
  }
}

function _pickFrontDirection(cell, gridManager, openDirections) {
  const metadataSide = cell.metadata?.entranceSide
  if (metadataSide) return _directionFromSideName(metadataSide)

  const usable = openDirections.filter(direction => {
    const [dx, dz] = _directionOffset(direction)
    const support = gridManager.getCell(cell.x + dx, cell.y - 1, cell.z + dz)
    const blocker = gridManager.getCell(cell.x + dx, cell.y, cell.z + dz)
    return support && !blocker
  })

  if (usable.length > 0) {
    return DIRECTION_ORDER.find(direction => usable.includes(direction)) ?? usable[0]
  }

  if (openDirections.length > 0) {
    return DIRECTION_ORDER.find(direction => openDirections.includes(direction)) ?? openDirections[0]
  }

  return 2
}

function _collectFootprint(cell, gridManager) {
  const stackBaseY = cell.y
  const visited = new Set()
  const queue = [cell]
  const footprint = []

  while (queue.length > 0) {
    const current = queue.shift()
    if (!current || visited.has(current.id)) continue
    visited.add(current.id)
    footprint.push({ x: current.x, y: current.y, z: current.z })

    for (const [dx, dz] of [[-1, 0], [1, 0], [0, 1], [0, -1]]) {
      const next = gridManager.getCell(current.x + dx, stackBaseY, current.z + dz)
      if (next && next.y === stackBaseY && next.material === cell.material) {
        queue.push(next)
      }
    }
  }

  return footprint
}

function _lotHost(footprint) {
  return [...footprint].sort((a, b) => {
    if (a.z !== b.z) return b.z - a.z
    if (a.x !== b.x) return a.x - b.x
    return a.y - b.y
  })[0] ?? null
}

function _candidateYardCells(cell, gridManager, frontDirection) {
  const [dx, dz] = _directionOffset(frontDirection)
  return _foundationIfOpen(gridManager, cell.x + dx, cell.y - 1, cell.z + dz)
}

function _candidateSideYardCells(cell, gridManager, frontDirection) {
  const sides = frontDirection === 0 || frontDirection === 1 ? [2, 3] : [0, 1]
  return sides.flatMap(direction => {
    const [dx, dz] = _directionOffset(direction)
    return _foundationIfOpen(gridManager, cell.x + dx, cell.y - 1, cell.z + dz)
  })
}

function _candidateBackYardCells(cell, gridManager, frontDirection) {
  const [dx, dz] = _directionOffset(_oppositeDirection(frontDirection))
  return _foundationIfOpen(gridManager, cell.x + dx, cell.y - 1, cell.z + dz)
}

function _foundationIfOpen(gridManager, x, y, z) {
  const foundation = gridManager.getCell(x, y, z)
  const building = gridManager.getCell(x, y + 1, z)
  return foundation && !building ? [{ x, y, z }] : []
}

function _adjacentBuildingDirections(cell, gridManager) {
  return [0, 1, 2, 3].filter(direction => {
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

function _directionFromSideName(side) {
  if (side === 'west') return 0
  if (side === 'east') return 1
  if (side === 'north') return 3
  return 2
}

const LotResolver = {
  resolve,
}

export { LotResolver }
