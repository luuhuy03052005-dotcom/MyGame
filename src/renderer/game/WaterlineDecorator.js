import { getOpenDirections, rotationFromDirection, sideNameFromDirection } from './FoundationTopologyResolver.js'
import { chance, pickVariant } from '../utils/deterministicHash.js'

function resolve(cell, neighbors, context = {}) {
  if (cell.y !== 0) return []

  const openDirections = getOpenDirections(neighbors)
  if (openDirections.length === 0) return []

  const items = []
  const topology = context.topologySignature ?? openDirections.join('')

  for (const direction of openDirections) {
    const side = sideNameFromDirection(direction)
    const seed = `${cell.id}|${topology}|waterline|${side}`
    items.push({
      assetType: 'waterline_wet_stone',
      role: 'prop',
      placement: 'waterline',
      side,
      direction,
      rotation: rotationFromDirection(direction),
      positionOffset: [0, 0, 0],
      scale: 1,
      colorable: false,
    })

    if (chance(`${seed}|foam`, 0.72)) {
      items.push({
        assetType: 'waterline_foam_marker',
        role: 'prop',
        placement: 'waterline',
        side,
        direction,
        rotation: rotationFromDirection(direction),
        positionOffset: [0, 0, 0],
        scale: 1,
        colorable: false,
      })
    }
  }

  if (openDirections.length >= 2 && chance(`${cell.id}|${topology}|waterline-rock`, 0.45)) {
    const direction = pickVariant(`${cell.id}|${topology}|waterline-rock-side`, openDirections)
    items.push({
      assetType: 'waterline_rock_edge',
      role: 'prop',
      placement: 'waterline',
      side: sideNameFromDirection(direction),
      direction,
      rotation: rotationFromDirection(direction),
      positionOffset: [0, 0, 0],
      scale: 0.42,
      kitId: 'kenney-town-kit',
      colorable: false,
    })
  }

  return items
}

const WaterlineDecorator = {
  resolve,
}

export { WaterlineDecorator }
