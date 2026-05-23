import { chance, pickVariant } from '../utils/deterministicHash.js'

function resolve({
  cell,
  neighbors,
  context = {},
  lot = {},
  facadeLayer = [],
  roofLayer = [],
  surfaceLayer = [],
  waterlineLayer = [],
}) {
  const props = []

  props.push(...waterlineLayer)
  props.push(..._roofProps(cell, context, roofLayer))
  props.push(..._facadeProps(cell, context, facadeLayer, lot))

  if (cell.y === 0 && !neighbors.top) {
    props.push(..._surfaceProps(cell, context, surfaceLayer, lot))
  }

  return props
}

function _roofProps(cell, context, roofLayer) {
  if (roofLayer.length === 0 || cell.y < 2) return []
  if (!chance(`${cell.id}|${context.topologySignature}|prop|chimney`, 0.2)) return []

  return [{
    assetType: 'chimney',
    role: 'prop',
    rotation: 0,
    positionOffset: [0.22, 0.44, -0.18],
    scale: 0.5,
    colorable: false,
    placement: 'roof',
    aliveType: 'chimneySmoke',
  }]
}

function _facadeProps(cell, context, facadeLayer, lot) {
  const props = []
  const doorFacade = facadeLayer.find(item => item.detail === 'door' || item.side === lot.entranceSide)
  if (!doorFacade) return props

  if (chance(`${cell.id}|${doorFacade.side}|prop|lantern`, 0.45)) {
    props.push({
      assetType: 'lantern',
      role: 'prop',
      side: doorFacade.side,
      rotation: doorFacade.rotation,
      positionOffset: [0, 0.05, 0],
      scale: 0.5,
      colorable: false,
      placement: 'facade',
      aliveType: 'windowLight',
    })
  }

  if (context.materialFamily !== 'suburban' && chance(`${cell.id}|${doorFacade.side}|prop|banner`, 0.14)) {
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

  return props
}

function _surfaceProps(cell, context, surfaceLayer, lot) {
  const surface = surfaceLayer[0]
  if (!surface) return []

  const seedBase = `${cell.id}|${surface.surfaceRole}|${surface.topology}|${context.surfaceStyle}`
  const props = []

  if (surface.surfaceRole === 'entrance') {
    if (context.surfaceStyle === 'suburban') {
      props.push(_surfaceProp('prop_planter', surface, {
        kitId: 'kenney-city-suburban',
        scale: 0.62,
        sideOffset: 0.26,
        tangentOffset: -0.24,
        aliveType: 'plantSway',
      }))
      if (chance(`${seedBase}|second-planter`, 0.42)) {
        props.push(_surfaceProp('prop_planter', surface, {
          kitId: 'kenney-city-suburban',
          scale: 0.52,
          sideOffset: 0.28,
          tangentOffset: 0.24,
          aliveType: 'plantSway',
        }))
      }
    } else {
      props.push(_surfaceProp('prop_hedge', surface, {
        kitId: 'kenney-town-kit',
        scale: 0.46,
        sideOffset: 0.24,
        tangentOffset: -0.24,
        aliveType: 'plantSway',
      }))
    }
    return props
  }

  if (surface.surfaceRole === 'quay') {
    const direction = surface.openDirections?.[0] ?? _directionFromSideName(surface.side)
    if (context.surfaceStyle === 'suburban' && chance(`${seedBase}|quay-fence`, 0.42)) {
      props.push(_edgeProp(_fenceVariant(seedBase, surface.openDirections ?? [direction]), direction, {
        kitId: 'kenney-city-suburban',
        scale: 0.62,
      }))
    }
    return props
  }

  if (surface.surfaceRole === 'walkway') {
    if (context.surfaceStyle === 'suburban' && _isPathEnd(surface) && chance(`${seedBase}|path-end-detail`, 0.58)) {
      const direction = surface.walkConnections?.[0] ?? _directionFromSideName(surface.side)
      props.push(_edgeProp(pickVariant(`${seedBase}|path-end-kind`, ['prop_fence_low', 'prop_planter']), direction, {
        kitId: 'kenney-city-suburban',
        scale: 0.52,
        sideDistance: 0.4,
        aliveType: 'plantSway',
      }))
    }
    return props
  }

  if (surface.surfaceRole === 'plaza') {
    const interior = (surface.openDirections?.length ?? 0) === 0
    if (!chance(`${seedBase}|plaza-detail-enabled`, interior ? 0.48 : 0.28)) return props
    const choice = pickVariant(`${seedBase}|plaza-prop`, [
      'prop_planter',
      'prop_tree_small',
      'prop_tree_large',
      'prop_hedge',
      'prop_fountain_round',
      'prop_fountain_square',
    ])

    if (!interior && choice?.startsWith('prop_fountain')) return props

    const kitId = context.surfaceStyle === 'suburban' && ['prop_planter', 'prop_tree_small', 'prop_tree_large'].includes(choice)
      ? 'kenney-city-suburban'
      : 'kenney-town-kit'
    const assetType = kitId === 'kenney-city-suburban' || choice.startsWith('prop_fountain')
      ? choice
      : 'prop_hedge'

    props.push(_surfaceProp(assetType, surface, {
      kitId,
      scale: _plazaPropScale(assetType),
      tangentOffset: 0.2,
      sideOffset: -0.18,
      aliveType: assetType.includes('tree') || assetType.includes('planter') ? 'plantSway' : undefined,
    }))
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
    aliveType: options.aliveType,
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
    aliveType: options.aliveType,
  }
}

function _fenceVariant(seed, openDirections) {
  if (openDirections.length >= 2) {
    return pickVariant(`${seed}|corner-fence`, ['prop_fence_2x2', 'prop_fence_2x3', 'prop_fence_3x2', 'prop_fence_3x3'])
  }
  return pickVariant(`${seed}|line-fence`, ['prop_fence', 'prop_fence_low', 'prop_fence_1x2', 'prop_fence_1x3', 'prop_fence_1x4'])
}

function _isPathEnd(surface) {
  return surface.assetType === 'surface_walkway_end' || (surface.walkConnections?.length ?? 0) === 1
}

function _plazaPropScale(assetType) {
  if (assetType === 'prop_tree_large') return 0.78
  if (assetType === 'prop_tree_small') return 0.62
  if (assetType?.startsWith('prop_fountain')) return 0.62
  if (assetType === 'prop_planter') return 0.58
  return 0.52
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

const PropDecorator = {
  resolve,
}

export { PropDecorator }
