import { chance, pickVariant } from '../utils/deterministicHash.js'
import {
  getOpenDirections,
  rotationFromDirection,
  sideNameFromDirection,
} from './FoundationTopologyResolver.js'

const FAMILY_VARIANTS = {
  plaster: {
    flat: ['wall_flat'],
    window: ['wall_window_small', 'wall_window_shutters', 'wall_window_round', 'wall_window_glass'],
    door: ['wall_door'],
    corner: ['wall_corner'],
    balcony: ['balcony_wall'],
    trim: ['wall_window_shutters', 'wall_window_round'],
  },
  wood: {
    flat: ['wall_wood'],
    window: ['wall_wood_window_small', 'wall_wood_window_shutters'],
    door: ['wall_wood_door'],
    corner: ['wall_wood'],
    balcony: ['wall_wood_window_small'],
    trim: ['wall_wood_window_shutters'],
  },
  stone: {
    flat: ['wall_flat'],
    window: ['wall_window_small', 'wall_window_round'],
    door: ['wall_door'],
    corner: ['wall_corner'],
    balcony: ['balcony_wall'],
    trim: ['wall_window_round'],
  },
  tower: {
    flat: ['wall_flat'],
    window: ['wall_window_small', 'wall_window_round'],
    door: ['wall_door'],
    corner: ['wall_corner'],
    balcony: ['wall_window_round'],
    trim: ['wall_window_round'],
  },
}

function resolve(cell, neighbors, buildContext = {}) {
  if (cell.y === 0) return []

  const openDirections = getOpenDirections(neighbors)
  if (openDirections.length === 0) return []

  const family = _normalizeFamily(buildContext.materialFamily ?? cell.material)
  const topology = buildContext.topologySignature ?? openDirections.join('')
  const accessDirections = buildContext.accessDirections ?? []
  const balconyDirections = buildContext.balconyDirections ?? []
  const canUseDoor = _canUseDoor(cell, neighbors, accessDirections)
  const canUseBalcony = _canUseBalcony(cell, neighbors, balconyDirections)
  const preferredDoorDirection = buildContext.lot?.isEntranceHost
    ? buildContext.lot.entranceDirection
    : accessDirections[0]

  return openDirections.map((direction, index) => {
    const side = sideNameFromDirection(direction)
    const seed = `${cell.id}|${topology}|${family}|facade|${side}`
    const detail = _pickFacadeDetail(seed, {
      direction,
      index,
      openDirections,
      canUseDoor,
      accessDirections,
      preferredDoorDirection,
      canUseBalcony,
      balconyDirections,
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
  if (
    context.canUseDoor &&
    context.accessDirections.includes(context.direction) &&
    context.direction === context.preferredDoorDirection
  ) {
    return 'door'
  }

  if (
    context.canUseDoor &&
    context.accessDirections.includes(context.direction) &&
    context.index === 0 &&
    chance(`${seed}|door`, 0.24)
  ) {
    return 'door'
  }

  if (
    context.canUseBalcony &&
    context.balconyDirections.includes(context.direction) &&
    chance(`${seed}|balcony`, 0.18)
  ) {
    return 'balcony'
  }

  if (chance(`${seed}|window`, 0.68)) {
    return 'window'
  }

  if (chance(`${seed}|trim`, 0.2)) {
    return 'trim'
  }

  return 'flat'
}

function _assetForDetail(seed, family, detail) {
  const variants = FAMILY_VARIANTS[family] ?? FAMILY_VARIANTS.plaster
  if (detail === 'balcony') return pickVariant(seed, variants.balcony) ?? 'balcony_wall'
  return pickVariant(seed, variants[detail] ?? variants.flat) ?? 'wall_flat'
}

function _canUseDoor(cell, neighbors, accessDirections = []) {
  return cell.y === 1 &&
    Boolean(neighbors.bottom) &&
    getOpenDirections(neighbors).length > 0 &&
    accessDirections.length > 0
}

function _canUseBalcony(cell, neighbors, balconyDirections = []) {
  return cell.y === 2 &&
    Boolean(neighbors.bottom) &&
    getOpenDirections(neighbors).length > 0 &&
    balconyDirections.length > 0
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
