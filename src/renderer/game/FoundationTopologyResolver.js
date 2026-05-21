const DIRECTION_TO_SIDE = {
  0: 'west',
  1: 'east',
  2: 'south',
  3: 'north',
}

const SIDE_TO_DIRECTION = {
  west: 0,
  east: 1,
  south: 2,
  north: 3,
}

const DIRECTION_ROTATION = {
  0: Math.PI / 2,
  1: -Math.PI / 2,
  2: 0,
  3: Math.PI,
}

function getOpenDirections(neighbors) {
  const open = []
  if (!neighbors.left) open.push(0)
  if (!neighbors.right) open.push(1)
  if (!neighbors.front) open.push(2)
  if (!neighbors.back) open.push(3)
  return open
}

function getConnectedDirections(neighbors) {
  const connected = []
  if (neighbors.left) connected.push(0)
  if (neighbors.right) connected.push(1)
  if (neighbors.front) connected.push(2)
  if (neighbors.back) connected.push(3)
  return connected
}

function sideNameFromDirection(direction) {
  return DIRECTION_TO_SIDE[direction] ?? 'south'
}

function directionFromSide(side) {
  return SIDE_TO_DIRECTION[side] ?? 2
}

function rotationFromDirection(direction) {
  return DIRECTION_ROTATION[direction] ?? 0
}

function areOpposite(a, b) {
  return (a === 0 && b === 1) ||
    (a === 1 && b === 0) ||
    (a === 2 && b === 3) ||
    (a === 3 && b === 2)
}

function topologySignature(openDirections) {
  return [0, 1, 2, 3].map(dir => openDirections.includes(dir) ? '1' : '0').join('')
}

function resolveFoundationAsset(openDirections) {
  if (openDirections.length === 0) return 'foundation_plaza_tile'
  if (openDirections.length === 1) return 'foundation_seawall_straight'
  if (openDirections.length === 2) {
    return areOpposite(openDirections[0], openDirections[1])
      ? 'foundation_seawall_straight'
      : 'foundation_seawall_corner'
  }
  if (openDirections.length === 3) return 'foundation_seawall_end'
  return 'foundation_seawall_round'
}

function resolve(cell, neighbors, buildContext = {}) {
  if (cell.y !== 0) return []

  const foundationStyle = buildContext.foundationStyle ?? cell.material ?? 'stone_quay'
  const openDirections = getOpenDirections(neighbors)
  const primaryDirection = openDirections[0] ?? 2
  const assetType = foundationStyle === 'harbor_pier'
    ? _resolvePierFoundation(openDirections)
    : resolveFoundationAsset(openDirections)

  return [{
    assetType,
    role: 'foundation',
    side: sideNameFromDirection(primaryDirection),
    rotation: rotationFromDirection(primaryDirection),
    positionOffset: [0, 0, 0],
    scale: 1,
    colorable: false,
    topology: topologySignature(openDirections),
    openDirections,
  }]
}

function _resolvePierFoundation(openDirections) {
  if (openDirections.length === 0) return 'foundation_solid'
  if (openDirections.length >= 3) return 'foundation_arch'
  return 'foundation_solid'
}

const FoundationTopologyResolver = {
  resolve,
  getOpenDirections,
  getConnectedDirections,
  resolveFoundationAsset,
  topologySignature,
}

export {
  FoundationTopologyResolver,
  getOpenDirections,
  getConnectedDirections,
  sideNameFromDirection,
  directionFromSide,
  rotationFromDirection,
  topologySignature,
  areOpposite,
}
