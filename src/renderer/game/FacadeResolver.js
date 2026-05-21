import { chance, pickVariant } from '../utils/deterministicHash.js'
import {
  getOpenDirections,
  rotationFromDirection,
  sideNameFromDirection,
} from './FoundationTopologyResolver.js'

const FAMILY_VARIANTS = {
  plaster: {
    flat: ['wall_flat'],
    window: ['wall_window'],
    door: ['wall_door'],
    corner: ['wall_corner'],
  },
  wood: {
    flat: ['wall_flat'],
    window: ['wall_window'],
    door: ['wall_door'],
    corner: ['wall_corner'],
  },
  stone: {
    flat: ['wall_flat'],
    window: ['wall_window'],
    door: ['wall_door'],
    corner: ['wall_corner'],
  },
  tower: {
    flat: ['wall_flat'],
    window: ['wall_window'],
    door: ['wall_door'],
    corner: ['wall_corner'],
  },
}

function resolve(cell, neighbors, buildContext = {}) {
  if (cell.y === 0) return []

  const openDirections = getOpenDirections(neighbors)
  if (openDirections.length === 0) return []

  const family = _normalizeFamily(buildContext.materialFamily ?? cell.material)
  const topology = buildContext.topologySignature ?? openDirections.join('')
  const canUseDoor = _canUseDoor(cell, neighbors)
  const canUseBalcony = _canUseBalcony(cell, neighbors)

  return openDirections.map((direction, index) => {
    const side = sideNameFromDirection(direction)
    const seed = `${cell.id}|${topology}|${family}|facade|${side}`
    const detail = _pickFacadeDetail(seed, {
      direction,
      index,
      openDirections,
      canUseDoor,
      canUseBalcony,
    })
    const assetType = _assetForDetail(seed, family, detail)

    return {
      assetType,
      role: 'facade',
      side,
      rotation: rotationFromDirection(direction),
      positionOffset: [0, 0, 0],
      scale: 1,
      colorable: true,
      detail,
    }
  })
}

function _pickFacadeDetail(seed, context) {
  if (context.canUseDoor && context.index === 0 && chance(`${seed}|door`, 0.22)) {
    return 'door'
  }

  if (context.canUseBalcony && chance(`${seed}|balcony`, 0.18)) {
    return 'balcony'
  }

  if (chance(`${seed}|window`, 0.58)) {
    return 'window'
  }

  if (context.openDirections.length >= 2 && chance(`${seed}|corner`, 0.2)) {
    return 'corner'
  }

  return 'flat'
}

function _assetForDetail(seed, family, detail) {
  const variants = FAMILY_VARIANTS[family] ?? FAMILY_VARIANTS.plaster
  if (detail === 'balcony') {
    return pickVariant(seed, variants.window) ?? 'wall_window'
  }
  return pickVariant(seed, variants[detail] ?? variants.flat) ?? 'wall_flat'
}

function _canUseDoor(cell, neighbors) {
  return cell.y === 1 && Boolean(neighbors.bottom) && getOpenDirections(neighbors).length > 0
}

function _canUseBalcony(cell, neighbors) {
  return cell.y >= 2 && Boolean(neighbors.bottom) && getOpenDirections(neighbors).length > 0
}

function _normalizeFamily(family) {
  if (family === 'stone_quay' || family === 'stone_plaza' || family === 'rock_edge') return 'stone'
  if (family === 'harbor_pier') return 'wood'
  if (family === 'coast') return 'plaster'
  return family || 'plaster'
}

const FacadeResolver = {
  resolve,
}

export { FacadeResolver }
