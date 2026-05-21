import {
  getConnectedDirections,
  rotationFromDirection,
  sideNameFromDirection,
  areOpposite,
} from './FoundationTopologyResolver.js'

function resolve(cell, neighbors, buildContext = {}) {
  if (cell.y === 0 || neighbors.top) return []

  const connected = getConnectedDirections(neighbors)
  const { assetType, direction } = _resolveRoof(connected, cell, buildContext)

  return [{
    assetType,
    role: 'roof',
    side: sideNameFromDirection(direction),
    rotation: rotationFromDirection(direction),
    positionOffset: [0, 0, 0],
    scale: 1,
    colorable: false,
    topology: connected.join(''),
  }]
}

function _resolveRoof(connected, cell, buildContext) {
  if (buildContext.materialFamily === 'tower' || cell.y >= 4) {
    return { assetType: 'roof_peak', direction: connected[0] ?? 2 }
  }

  if (connected.length <= 1) {
    return { assetType: 'roof_peak', direction: connected[0] ?? 2 }
  }

  if (connected.length === 2) {
    if (areOpposite(connected[0], connected[1])) {
      const alongX = connected.includes(0) && connected.includes(1)
      return { assetType: 'roof_gable', direction: alongX ? 2 : 1 }
    }
    return { assetType: 'roof_hip_corner', direction: _cornerDirection(connected) }
  }

  if (connected.length === 3) {
    const missing = [0, 1, 2, 3].find(direction => !connected.includes(direction)) ?? 2
    return { assetType: 'roof_t_junction', direction: missing }
  }

  return { assetType: 'roof_flat', direction: 2 }
}

function _cornerDirection(connected) {
  if (connected.includes(0) && connected.includes(2)) return 2
  if (connected.includes(1) && connected.includes(2)) return 1
  if (connected.includes(1) && connected.includes(3)) return 3
  return 0
}

const RoofResolver = {
  resolve,
}

export { RoofResolver }
