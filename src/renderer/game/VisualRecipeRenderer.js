import * as THREE from 'three'
import { getAssetDefinition } from '../assets/BuildingAssetRegistry.js'

const LAYER_NAMES = ['foundationLayer', 'surfaceLayer', 'facadeLayer', 'roofLayer', 'propLayer']

const COLORS = {
  stone: 0xa9a698,
  stoneDark: 0x74766e,
  stoneLight: 0xc2bdad,
  wetStone: 0x5f6c72,
  plaster: 0xe8d5aa,
  trim: 0x8f7355,
  glass: 0x7fb6c6,
  wood: 0xa86736,
  darkWood: 0x5a3622,
}

const FOUNDATION_CORE_HEIGHT = 0.96
const FOUNDATION_CORE_Y = 0
const FOUNDATION_COPING_Y = 0.48
const FOUNDATION_SIDE_HEIGHT = 0.92
const FOUNDATION_SIDE_Y = 0
const SURFACE_BASE_Y = 0.485
const SURFACE_RAW_BOTTOM_Y = 0.455
const SURFACE_ACCENT_Y = 0.535

const FALLBACK_ASSETS = {
  wall_window_small: 'wall_window',
  wall_window_shutters: 'wall_window',
  wall_window_round: 'wall_window',
  wall_window_glass: 'wall_window',
  wall_wood: 'wall_flat',
  wall_wood_window_small: 'wall_window',
  wall_wood_window_shutters: 'wall_window',
  wall_wood_door: 'wall_door',
  balcony_wall: 'wall_window',
  balcony_fence: 'wall_window',
  roof_window: 'roof_peak',
  roof_gable_detail: 'roof_gable',
  roof_corner_inner: 'roof_hip_corner',
  roof_high_point: 'roof_peak',
  roof_high_gable: 'roof_gable',
  roof_high_flat: 'roof_flat',
  chimney: '_fallback',
  lantern: '_fallback',
}

function createCellGroup(cell, recipe, assetManager) {
  const group = new THREE.Group()
  group.name = 'visualRecipeCell'
  group.userData = {
    cellId: cell.id,
    isBuilding: true,
    visualRecipe: recipe,
  }

  const layers = _createLayers()
  _renderFoundation(layers.foundationLayer, recipe.foundationLayer, assetManager, cell)
  _renderSurface(layers.surfaceLayer, recipe.surfaceLayer ?? [], assetManager, cell)
  _renderFacades(layers.facadeLayer, recipe.facadeLayer, assetManager, cell, recipe)
  _renderRoofs(layers.roofLayer, recipe.roofLayer, assetManager, cell)
  _renderProps(layers.propLayer, recipe.propLayer, assetManager, cell)

  for (const name of LAYER_NAMES) {
    if (layers[name].children.length > 0) group.add(layers[name])
  }

  if (group.children.length === 0) {
    throw new Error(`VisualRecipe produced no renderable layers for ${cell.id}`)
  }

  return group
}

function disposeCellGroup(group) {
  group?.traverse?.((obj) => {
    if (!obj.isMesh) return
    obj.geometry?.dispose?.()
    if (Array.isArray(obj.material)) {
      obj.material.forEach(material => material.dispose?.())
    } else {
      obj.material?.dispose?.()
    }
  })
}

function _createLayers() {
  return LAYER_NAMES.reduce((layers, name) => {
    const layer = new THREE.Group()
    layer.name = name
    layer.userData.layer = name
    layers[name] = layer
    return layers
  }, {})
}

function _renderFoundation(layer, foundationLayer, assetManager, cell) {
  for (const item of foundationLayer) {
    if (cell.material === 'harbor_pier' || item.assetType === 'foundation_arch' || item.assetType === 'foundation_solid') {
      _renderPierFoundation(layer, item, assetManager)
      continue
    }

    const openDirections = _foundationOpenDirections(item)
    layer.add(_box('foundation_core', [0.98, FOUNDATION_CORE_HEIGHT, 0.98], [0, FOUNDATION_CORE_Y, 0], COLORS.stone, {
      materialRole: 'stone',
      colorable: false,
      roughness: 0.94,
    }))
    layer.add(_box('foundation_top_coping', [1.08, 0.08, 1.08], [0, FOUNDATION_COPING_Y, 0], COLORS.stoneLight, {
      materialRole: 'stone',
      colorable: false,
      roughness: 0.9,
    }))

    for (const direction of openDirections) {
      _addSeawallSide(layer, direction, assetManager, item)
    }

    if (openDirections.length >= 2) {
      _addCornerCoping(layer, openDirections)
    }

    if (openDirections.length > 0 && (item.assetType === 'foundation_rock_edge' || cell.id.charCodeAt(0) % 3 === 0)) {
      const rockDirection = openDirections[0]
      const rock = _raw(assetManager, _rockFile(cell), {
        assetType: 'foundation_rock_edge',
        size: 0.34,
        colorable: false,
        materialRole: 'stone',
      })
      const side = _sideTransform(rockDirection)
      rock.position.set(side.x * 0.72, -0.48, side.z * 0.72)
      rock.rotation.y = side.rotation
      layer.add(rock)
    }
  }
}

function _renderPierFoundation(layer, item, assetManager) {
  const deck = _raw(assetManager, 'planks.glb', {
    assetType: item.assetType,
    size: 1.0,
    colorable: false,
    materialRole: 'wood',
    alignBottomY: -0.5,
  })
  deck.position.y = 0.36
  layer.add(deck)

  const pillarPositions = [
    [-0.42, -0.28, -0.42],
    [0.42, -0.28, -0.42],
    [-0.42, -0.28, 0.42],
    [0.42, -0.28, 0.42],
  ]
  for (const position of pillarPositions) {
    const pillar = _raw(assetManager, 'pillar-wood.glb', {
      assetType: 'foundation_arch',
      size: 0.78,
      colorable: false,
      materialRole: 'wood',
    })
    pillar.position.set(...position)
    layer.add(pillar)
  }
}

function _renderSurface(layer, surfaceLayer, assetManager, cell) {
  for (const item of surfaceLayer) {
    if (item.assetType === 'surface_building_footprint') {
      _addBuildingFootprintSurface(layer, item)
      continue
    }

    const [x, , z] = item.positionOffset ?? [0, 0, 0]
    layer.add(_surfaceUnderlay(item, x, z))

    const surface = _raw(assetManager, _surfaceFile(item), {
      assetType: item.assetType,
      size: _surfaceSize(item),
      colorable: false,
      materialRole: item.surfaceRole === 'quay' ? 'surfaceQuay' : 'surfaceStone',
      alignBottomY: SURFACE_RAW_BOTTOM_Y,
    })
    surface.position.set(x, 0, z)
    surface.rotation.y = item.rotation ?? 0
    surface.userData.materialRole = item.surfaceRole === 'quay' ? 'surfaceQuay' : 'surfaceStone'
    layer.add(surface)

    _addSurfaceAccents(layer, item)
  }
}

function _addBuildingFootprintSurface(layer, item) {
  const [x, , z] = item.positionOffset ?? [0, 0, 0]
  layer.add(_box('surface_building_footprint_inset', [0.72, 0.035, 0.72], [x, SURFACE_BASE_Y, z], 0xb7b3a6, {
    materialRole: 'surfaceStone',
    colorable: false,
    roughness: 0.9,
  }))
}

function _surfaceUnderlay(item, x, z) {
  const size = item.surfaceRole === 'quay'
    ? [0.98, 0.035, 0.98]
    : item.surfaceRole === 'walkway' || item.surfaceRole === 'entrance'
      ? [0.88, 0.035, 0.88]
      : [0.96, 0.035, 0.96]
  const color = item.surfaceRole === 'quay'
    ? 0xa6a99c
    : item.surfaceRole === 'walkway' || item.surfaceRole === 'entrance'
      ? 0xadb2b2
      : 0xb8b7ae

  return _box('surface_stone_underlay', size, [x, SURFACE_BASE_Y, z], color, {
    materialRole: item.surfaceRole === 'quay' ? 'surfaceQuay' : 'surfaceStone',
    colorable: false,
    roughness: 0.92,
  })
}

function _addSurfaceAccents(layer, item) {
  const y = SURFACE_ACCENT_Y
  const role = item.surfaceRole

  if (role === 'quay') {
    const directions = item.openDirections?.length ? item.openDirections : [_directionFromSide(item.side)]
    for (const direction of directions) {
      const side = _sideTransform(direction)
      const alongX = direction === 2 || direction === 3
      layer.add(_box('surface_quay_edge_band', alongX ? [0.9, 0.018, 0.09] : [0.09, 0.018, 0.9], [side.x * 0.43, y, side.z * 0.43], 0x8f968f, {
        materialRole: 'surfaceQuay',
        colorable: false,
      }))
    }
    return
  }

  if (role === 'walkway' || role === 'entrance') {
    const connections = item.walkConnections?.length ? item.walkConnections : [_directionFromSide(item.side)]
    for (const direction of connections) {
      const side = _sideTransform(direction)
      const alongX = direction === 2 || direction === 3
      layer.add(_box('surface_walkway_connection', alongX ? [0.38, 0.016, 0.1] : [0.1, 0.016, 0.38], [side.x * 0.24, y, side.z * 0.24], 0x9aa2a6, {
        materialRole: 'surfaceStone',
        colorable: false,
      }))
    }
    if (role === 'entrance') {
      const direction = _directionFromSide(item.side)
      const side = _sideTransform(direction)
      layer.add(_box('surface_entrance_step_marker', direction === 2 || direction === 3 ? [0.36, 0.022, 0.16] : [0.16, 0.022, 0.36], [side.x * 0.38, y + 0.01, side.z * 0.38], COLORS.stoneLight, {
        materialRole: 'surfaceStone',
        colorable: false,
      }))
    }
    return
  }

  if (role === 'plaza') {
    layer.add(_box('surface_plaza_inset', [0.58, 0.014, 0.58], [0, y, 0], 0xa4a9aa, {
      materialRole: 'surfaceStone',
      colorable: false,
    }))
  }
}

function _addSeawallSide(layer, direction, assetManager, item) {
  const side = _sideTransform(direction)
  const alongX = direction === 2 || direction === 3

  layer.add(_box('seawall_side', alongX ? [0.94, FOUNDATION_SIDE_HEIGHT, 0.08] : [0.08, FOUNDATION_SIDE_HEIGHT, 0.94], [side.x * 0.53, FOUNDATION_SIDE_Y, side.z * 0.53], COLORS.stoneDark, {
    materialRole: 'stone',
    colorable: false,
  }))
  layer.add(_box('seawall_waterline', alongX ? [0.88, 0.08, 0.09] : [0.09, 0.08, 0.88], [side.x * 0.545, -0.46, side.z * 0.545], COLORS.wetStone, {
    materialRole: 'stone',
    colorable: false,
  }))

  _addSeawallArchRecess(layer, direction)
}

function _addSeawallArchRecess(layer, direction) {
  const side = _sideTransform(direction)
  const alongX = direction === 2 || direction === 3
  const faceOffset = 0.575
  const faceX = side.x * faceOffset
  const faceZ = side.z * faceOffset
  const recessSize = alongX ? [0.44, 0.28, 0.028] : [0.028, 0.28, 0.44]
  const columnSize = alongX ? [0.055, 0.31, 0.038] : [0.038, 0.31, 0.055]
  const lintelSize = alongX ? [0.5, 0.055, 0.04] : [0.04, 0.055, 0.5]
  const tangentA = alongX ? [-0.25, 0] : [0, -0.25]
  const tangentB = alongX ? [0.25, 0] : [0, 0.25]

  layer.add(_box('seawall_arch_recess', recessSize, [faceX, -0.31, faceZ], 0x465057, {
    materialRole: 'wetStone',
    colorable: false,
    roughness: 0.96,
  }))
  layer.add(_box('seawall_arch_column', columnSize, [faceX + tangentA[0], -0.29, faceZ + tangentA[1]], COLORS.stoneLight, {
    materialRole: 'stone',
    colorable: false,
    roughness: 0.92,
  }))
  layer.add(_box('seawall_arch_column', columnSize, [faceX + tangentB[0], -0.29, faceZ + tangentB[1]], COLORS.stoneLight, {
    materialRole: 'stone',
    colorable: false,
    roughness: 0.92,
  }))
  layer.add(_box('seawall_arch_lintel', lintelSize, [faceX, -0.12, faceZ], COLORS.stoneLight, {
    materialRole: 'stone',
    colorable: false,
    roughness: 0.92,
  }))
}

function _addCornerCoping(layer, directions) {
  for (const a of directions) {
    for (const b of directions) {
      if (a >= b || _areOpposite(a, b)) continue
      const sideA = _sideTransform(a)
      const sideB = _sideTransform(b)
      layer.add(_box('seawall_corner_coping', [0.18, 0.12, 0.18], [sideA.x * 0.51 + sideB.x * 0.51, FOUNDATION_COPING_Y, sideA.z * 0.51 + sideB.z * 0.51], COLORS.stoneLight, {
        materialRole: 'stone',
        colorable: false,
      }))
    }
  }
}

function _renderFacades(layer, facadeLayer, assetManager, cell, recipe = {}) {
  if (!facadeLayer?.length) return

  const family = _facadeFamily(recipe, cell)
  const bodyColor = _facadeBodyColor(family)
  const isWood = family === 'wood'

  layer.add(_box('building_body_core', [0.82, 0.84, 0.82], [0, -0.05, 0], bodyColor, {
    materialRole: isWood ? 'wood' : 'wallBody',
    colorable: !isWood,
    roughness: 0.88,
  }))

  for (const item of facadeLayer) {
    const direction = _directionFromSide(item.side)
    const detail = item.detail ?? 'flat'

    _addFaceBox(layer, 'wall_face_panel', direction, 0.84, 0.82, 0.028, 0.43, -0.05, 0, bodyColor, {
      materialRole: isWood ? 'wood' : 'wallBody',
      colorable: !isWood,
      roughness: 0.88,
    })

    _addFacadeDetail(layer, direction, detail, item, family)

    if (detail === 'balcony' || item.assetType === 'balcony_wall') {
      _addBalcony(layer, direction)
    }

    if (detail === 'door') {
      _addDoorStep(layer, direction)
    }

  }
}

function _facadeFamily(recipe, cell) {
  const family = recipe?.materialFamily ?? cell?.material ?? 'plaster'
  if (family === 'harbor_pier') return 'wood'
  if (family === 'stone_quay' || family === 'stone_plaza' || family === 'rock_edge') return 'stone'
  if (family === 'coast') return 'plaster'
  return family
}

function _facadeBodyColor(family) {
  if (family === 'wood') return COLORS.wood
  if (family === 'stone') return 0xd0cbb7
  if (family === 'tower') return 0xd7d0bb
  return COLORS.plaster
}

function _addFacadeDetail(layer, direction, detail, item, family) {
  if (detail === 'door') {
    _addDoor(layer, direction, family)
    return
  }

  if (detail === 'window' || detail === 'balcony' || item.assetType?.includes('window')) {
    _addWindow(layer, direction, item, family)
    return
  }

  if (detail === 'trim') {
    _addWindow(layer, direction, item, family)
    _addFacadeOverhang(layer, direction, family)
    return
  }

  _addFacadeFlatTrim(layer, direction, family)
}

function _addWindow(layer, direction, item, family) {
  const round = item.assetType?.includes('round')
  const shutters = item.assetType?.includes('shutters')
  const frameColor = family === 'wood' ? COLORS.darkWood : COLORS.trim
  const glassColor = round ? 0x91c9d2 : COLORS.glass

  _addFaceBox(layer, 'window_frame', direction, round ? 0.28 : 0.34, round ? 0.28 : 0.3, 0.035, 0.458, 0.03, 0, frameColor, {
    materialRole: 'trim',
    colorable: false,
  })
  _addFaceBox(layer, 'window_glass', direction, round ? 0.18 : 0.23, round ? 0.18 : 0.19, 0.04, 0.48, 0.03, 0, glassColor, {
    materialRole: 'window',
    colorable: false,
    roughness: 0.35,
  })

  if (shutters) {
    _addFaceBox(layer, 'window_shutter_left', direction, 0.055, 0.3, 0.045, 0.487, 0.03, -0.22, COLORS.darkWood, {
      materialRole: 'wood',
      colorable: false,
    })
    _addFaceBox(layer, 'window_shutter_right', direction, 0.055, 0.3, 0.045, 0.487, 0.03, 0.22, COLORS.darkWood, {
      materialRole: 'wood',
      colorable: false,
    })
  }
}

function _addDoor(layer, direction, family) {
  const doorColor = family === 'wood' ? COLORS.darkWood : 0x8a5831
  _addFaceBox(layer, 'door_panel', direction, 0.28, 0.54, 0.045, 0.482, -0.17, 0, doorColor, {
    materialRole: 'wood',
    colorable: false,
  })
  _addFaceBox(layer, 'door_frame_top', direction, 0.36, 0.055, 0.052, 0.49, 0.13, 0, COLORS.trim, {
    materialRole: 'trim',
    colorable: false,
  })
  _addFaceBox(layer, 'door_knob', direction, 0.035, 0.035, 0.058, 0.502, -0.18, 0.08, COLORS.stoneLight, {
    materialRole: 'trim',
    colorable: false,
  })
}

function _addFacadeFlatTrim(layer, direction, family) {
  const trimColor = family === 'wood' ? COLORS.darkWood : COLORS.trim
  _addFaceBox(layer, 'facade_sill_trim', direction, 0.46, 0.045, 0.035, 0.46, -0.24, 0, trimColor, {
    materialRole: 'trim',
    colorable: false,
  })
}

function _addFacadeOverhang(layer, direction, family) {
  const trimColor = family === 'wood' ? COLORS.darkWood : COLORS.trim
  _addFaceBox(layer, 'facade_overhang', direction, 0.74, 0.06, 0.16, 0.55, 0.31, 0, trimColor, {
    materialRole: 'trim',
    colorable: false,
  })
}

function _addBalcony(layer, direction) {
  const side = _sideTransform(direction)
  const alongX = direction === 2 || direction === 3
  layer.add(_box('balcony_floor', alongX ? [0.5, 0.045, 0.22] : [0.22, 0.045, 0.5], [side.x * 0.58, -0.22, side.z * 0.58], COLORS.wood, {
    materialRole: 'wood',
    colorable: false,
  }))
  _addFaceBox(layer, 'balcony_front_rail', direction, 0.5, 0.08, 0.045, 0.7, -0.1, 0, COLORS.darkWood, {
    materialRole: 'wood',
    colorable: false,
  })
  _addFaceBox(layer, 'balcony_left_rail_post', direction, 0.045, 0.22, 0.045, 0.69, -0.08, -0.25, COLORS.darkWood, {
    materialRole: 'wood',
    colorable: false,
  })
  _addFaceBox(layer, 'balcony_right_rail_post', direction, 0.045, 0.22, 0.045, 0.69, -0.08, 0.25, COLORS.darkWood, {
    materialRole: 'wood',
    colorable: false,
  })
}

function _addDoorStep(layer, direction) {
  const side = _sideTransform(direction)
  layer.add(_box('door_step', direction === 2 || direction === 3 ? [0.42, 0.05, 0.18] : [0.18, 0.05, 0.42], [side.x * 0.62, -0.47, side.z * 0.62], COLORS.stoneLight, {
    materialRole: 'stone',
    colorable: false,
  }))
}

function _addFaceBox(layer, name, direction, width, height, depth, faceOffset, y, tangentOffset, color, options = {}) {
  const side = _sideTransform(direction)
  const alongX = direction === 2 || direction === 3
  const size = alongX ? [width, height, depth] : [depth, height, width]
  const position = alongX
    ? [tangentOffset, y, side.z * faceOffset]
    : [side.x * faceOffset, y, tangentOffset]
  layer.add(_box(name, size, position, color, options))
}

function _renderRoofs(layer, roofLayer, assetManager) {
  for (const item of roofLayer) {
    _addProceduralRoof(layer, item)
  }
}

function _addProceduralRoof(layer, item) {
  const isFlat = item.assetType === 'roof_flat' || item.assetType === 'roof_high_flat'
  const isHigh = item.assetType?.startsWith('roof_high')
  const roofColor = isHigh ? 0x4fb9a0 : _roofColor(item)
  const eaveColor = 0x355d58

  layer.add(_box('roof_eave_slab', [1.02, 0.055, 1.02], [0, 0.38, 0], eaveColor, {
    materialRole: 'roof',
    colorable: false,
    roughness: 0.82,
  }))

  if (isFlat) {
    layer.add(_box('roof_flat_cap', [0.9, 0.1, 0.9], [0, 0.45, 0], roofColor, {
      materialRole: 'roof',
      colorable: false,
      roughness: 0.84,
    }))
    return
  }

  if (item.assetType === 'roof_gable' || item.assetType === 'roof_gable_detail' || item.assetType === 'roof_t_junction' || item.assetType === 'roof_high_gable') {
    const roof = _gableRoofMesh('roof_gable_prism', item.rotation ?? 0, roofColor, isHigh ? 0.5 : 0.42)
    layer.add(roof)
    const ridge = _box('roof_ridge_cap', [0.78, 0.045, 0.06], [0, isHigh ? 0.89 : 0.81, 0], 0x2e544f, {
      materialRole: 'roof',
      colorable: false,
      roughness: 0.82,
    })
    ridge.rotation.y = item.rotation ?? 0
    layer.add(ridge)
    return
  }

  const height = isHigh ? 0.52 : 0.42
  const roof = new THREE.Mesh(
    new THREE.ConeGeometry(0.68, height, 4),
    new THREE.MeshStandardMaterial({ color: roofColor, roughness: 0.84, metalness: 0 })
  )
  roof.name = 'roof_point_cap'
  roof.position.y = 0.38 + height / 2
  roof.rotation.y = (item.rotation ?? 0) + Math.PI / 4
  roof.castShadow = true
  roof.receiveShadow = true
  roof.frustumCulled = false
  roof.userData.isColorable = false
  roof.userData.materialRole = 'roof'
  layer.add(roof)
}

function _gableRoofMesh(name, rotation, color, height) {
  const halfWidth = 0.54
  const halfDepth = 0.54
  const baseY = 0.38
  const topY = baseY + height
  const vertices = new Float32Array([
    -halfWidth, baseY, -halfDepth,
    halfWidth, baseY, -halfDepth,
    halfWidth, baseY, halfDepth,
    -halfWidth, baseY, halfDepth,
    -halfWidth, topY, 0,
    halfWidth, topY, 0,
  ])
  const indices = [
    0, 1, 5, 0, 5, 4,
    3, 4, 5, 3, 5, 2,
    0, 4, 3,
    1, 2, 5,
    0, 3, 2, 0, 2, 1,
  ]
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({
    color,
    roughness: 0.84,
    metalness: 0,
  }))
  mesh.name = name
  mesh.rotation.y = rotation
  mesh.castShadow = true
  mesh.receiveShadow = true
  mesh.frustumCulled = false
  mesh.userData.isColorable = false
  mesh.userData.materialRole = 'roof'
  return mesh
}

function _roofColor(item) {
  if (item.assetType === 'roof_gable_detail') return 0x4eb89e
  if (item.assetType === 'roof_window') return 0x61c4aa
  if (item.assetType === 'roof_hip_corner') return 0xb34343
  return 0x55bea5
}

function _renderProps(layer, propLayer, assetManager) {
  for (const item of propLayer) {
    if (item.assetType === 'chimney') {
      const chimney = _raw(assetManager, 'chimney.glb', {
        assetType: 'chimney',
        size: item.scale ?? 0.38,
        colorable: false,
        materialRole: 'stone',
      })
      chimney.position.set(...(item.positionOffset ?? [0.22, 0.44, -0.18]))
      layer.add(chimney)
    }

    if (item.assetType === 'lantern') {
      const direction = _directionFromSide(item.side)
      const side = _sideTransform(direction)
      const lantern = _raw(assetManager, 'lantern.glb', {
        assetType: 'lantern',
        size: item.scale ?? 0.24,
        colorable: false,
        materialRole: 'trim',
      })
      lantern.position.set(side.x * 0.58, -0.03, side.z * 0.58)
      lantern.rotation.y = side.rotation
      layer.add(lantern)
    }
  }
}

function _raw(assetManager, fileName, options) {
  return assetManager.getRaw(fileName, options)
}

function _box(name, size, position, color, options = {}) {
  const material = new THREE.MeshStandardMaterial({
    color,
    roughness: options.roughness ?? 0.86,
    metalness: 0,
  })
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material)
  mesh.name = name
  mesh.position.set(...position)
  mesh.castShadow = true
  mesh.receiveShadow = true
  mesh.frustumCulled = false
  mesh.userData.isColorable = options.colorable ?? false
  mesh.userData.materialRole = options.materialRole ?? 'trim'
  return mesh
}

function _foundationOpenDirections(item) {
  if (Array.isArray(item.openDirections)) return item.openDirections
  if (item.assetType === 'foundation_plaza_tile') return []
  if (item.assetType === 'foundation_seawall_round') return [0, 1, 2, 3]
  if (item.assetType === 'foundation_seawall_corner') return [2, 1]
  if (item.assetType === 'foundation_seawall_end') return [0, 1, 2]
  return [_directionFromSide(item.side)]
}

function _facadeFile(item) {
  const def = getAssetDefinition(item.assetType)
  if (def?.glb) return def.glb
  const fallback = FALLBACK_ASSETS[item.assetType] ?? 'wall_flat'
  return getAssetDefinition(fallback)?.glb ?? 'wall.glb'
}

function _roofFile(item) {
  const def = getAssetDefinition(item.assetType)
  if (def?.glb) return def.glb
  const fallback = FALLBACK_ASSETS[item.assetType] ?? 'roof_peak'
  return getAssetDefinition(fallback)?.glb ?? 'roof-point.glb'
}

function _surfaceFile(item) {
  if (item.family === 'harbor_pier') return 'planks.glb'
  const def = getAssetDefinition(item.assetType)
  if (def?.glb) return def.glb
  if (item.surfaceRole === 'quay') return 'road-edge.glb'
  if (item.surfaceRole === 'walkway') return 'road.glb'
  return 'road.glb'
}

function _surfaceSize(item) {
  if (item.surfaceRole === 'quay') return 0.96
  if (item.surfaceRole === 'entrance') return 0.82
  if (item.surfaceRole === 'walkway') return 0.86
  if (item.surfaceRole === 'building_footprint') return 0.68
  return 0.94
}

function _rockFile(cell) {
  const options = ['rock-small.glb', 'rock-wide.glb', 'rock-large.glb']
  return options[Math.abs(cell.x * 7 + cell.z * 11) % options.length]
}

function _directionFromSide(side) {
  if (side === 'west') return 0
  if (side === 'east') return 1
  if (side === 'north') return 3
  return 2
}

function _sideTransform(direction) {
  if (direction === 0) return { x: -1, z: 0, rotation: Math.PI / 2 }
  if (direction === 1) return { x: 1, z: 0, rotation: -Math.PI / 2 }
  if (direction === 3) return { x: 0, z: -1, rotation: Math.PI }
  return { x: 0, z: 1, rotation: 0 }
}

function _areOpposite(a, b) {
  return (a === 0 && b === 1) ||
    (a === 1 && b === 0) ||
    (a === 2 && b === 3) ||
    (a === 3 && b === 2)
}

const VisualRecipeRenderer = {
  createCellGroup,
  disposeCellGroup,
}

export { VisualRecipeRenderer }
