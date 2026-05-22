import {
  FoundationTopologyResolver,
  getOpenDirections,
  topologySignature,
} from './FoundationTopologyResolver.js'
import { FacadeResolver } from './FacadeResolver.js'
import { RoofResolver } from './RoofResolver.js'
import { SurfaceResolver } from './SurfaceResolver.js'
import { chance } from '../utils/deterministicHash.js'

const FOUNDATION_MATERIALS = new Set(['stone_quay', 'stone_plaza', 'rock_edge', 'harbor_pier'])

const MATERIAL_ALIASES = {
  stone_quay: 'plaster',
  stone_plaza: 'stone',
  rock_edge: 'stone',
  harbor_pier: 'wood',
  coast: 'plaster',
}

function resolveCell(cell, gridManager, buildContext = {}) {
  const neighbors = gridManager.getNeighbors(cell.x, cell.y, cell.z)
  const openDirections = getOpenDirections(neighbors)
  const topology = _topologySignature(neighbors)
  const materialFamily = _resolveMaterialFamily(cell, buildContext)
  const foundationStyle = _resolveFoundationStyle(cell, buildContext)
  const resolverContext = {
    ...buildContext,
    materialFamily,
    foundationStyle,
    topologySignature: topology,
  }

  const foundationLayer = FoundationTopologyResolver.resolve(cell, neighbors, resolverContext)
  const surfaceLayer = SurfaceResolver.resolve(cell, gridManager, resolverContext)
  const facadeLayer = FacadeResolver.resolve(cell, neighbors, resolverContext)
  const roofLayer = RoofResolver.resolve(cell, neighbors, resolverContext)
  const propLayer = _resolveProps(cell, neighbors, resolverContext, facadeLayer, roofLayer)
  const primary = _primaryLayerItem(cell, foundationLayer, facadeLayer, roofLayer)
  const allowBalcony = facadeLayer.some(item => item.detail === 'balcony')

  return {
    foundationLayer,
    surfaceLayer,
    facadeLayer,
    roofLayer,
    propLayer,
    materialFamily,
    foundationStyle,
    primaryAssetType: primary?.assetType ?? 'wall_flat',
    primaryRotation: primary?.rotation ?? 0,
    primaryRole: primary?.role ?? 'facade',
    openDirections,
    primaryOpenDirection: openDirections[0] ?? 2,
    topologySignature: topology,
    foundationTopologySignature: topologySignature(openDirections),
    isExterior: openDirections.length > 0,
    hasSupport: cell.y === 0 || Boolean(neighbors.bottom),
    topExposed: !neighbors.top,
    allowDoor: cell.y === 1 && Boolean(neighbors.bottom) && openDirections.length > 0,
    allowWindow: cell.y > 0 && openDirections.length > 0,
    allowBalcony,
    useHighRoof: !neighbors.top && cell.y >= 3,
    tower: !neighbors.top && cell.y >= 3 && _countHorizontalNeighbors(neighbors) <= 1,
  }
}

function resolveAffectedCells(cellLike, gridManager) {
  const cells = []
  const seen = new Set()

  for (let dx = -1; dx <= 1; dx++) {
    for (let dz = -1; dz <= 1; dz++) {
      for (const cell of gridManager.getAllCells()) {
        if (cell.x === cellLike.x + dx && cell.z === cellLike.z + dz) {
          _addUnique(cells, seen, cell)
        }
      }
    }
  }

  const above = gridManager.getCell(cellLike.x, cellLike.y + 1, cellLike.z)
  const below = gridManager.getCell(cellLike.x, cellLike.y - 1, cellLike.z)
  if (above) _addUnique(cells, seen, above)
  if (below) _addUnique(cells, seen, below)

  return cells
}

function _primaryLayerItem(cell, foundationLayer, facadeLayer, roofLayer) {
  if (cell.y === 0) return foundationLayer[0] ?? null
  if (roofLayer.length > 0) return roofLayer[0]
  if (facadeLayer.length > 0) {
    const door = facadeLayer.find(item => item.detail === 'door')
    const balcony = facadeLayer.find(item => item.detail === 'balcony')
    const window = facadeLayer.find(item => item.detail === 'window')
    return door ?? balcony ?? window ?? facadeLayer[0]
  }
  return { assetType: 'wall_flat', role: 'facade', rotation: 0 }
}

function _resolveProps(cell, neighbors, context, facadeLayer, roofLayer) {
  const props = []
  if (roofLayer.length > 0 && cell.y >= 2 && chance(`${cell.id}|${context.topologySignature}|chimney`, 0.18)) {
    props.push({
      assetType: 'chimney',
      role: 'prop',
      rotation: 0,
      positionOffset: [0.22, 0.44, -0.18],
      scale: 0.5,
      colorable: false,
      placement: 'roof',
    })
  }

  const doorFacade = facadeLayer.find(item => item.detail === 'door')
  if (doorFacade && chance(`${cell.id}|${doorFacade.side}|lantern`, 0.35)) {
    props.push({
      assetType: 'lantern',
      role: 'prop',
      side: doorFacade.side,
      rotation: doorFacade.rotation,
      positionOffset: [0, 0.05, 0],
      scale: 0.5,
      colorable: false,
      placement: 'facade',
    })
  }

  return props
}

function _resolveMaterialFamily(cell, buildContext) {
  const raw = buildContext.materialFamily ?? cell.material ?? 'plaster'
  if (cell.y === 0) return FOUNDATION_MATERIALS.has(raw) ? raw : 'stone_quay'
  return MATERIAL_ALIASES[raw] ?? raw ?? 'plaster'
}

function _resolveFoundationStyle(cell, buildContext) {
  const raw = buildContext.foundationStyle ?? cell.material ?? 'stone_quay'
  return raw === 'harbor_pier' ? 'harbor_pier' : 'stone_quay'
}

function _countHorizontalNeighbors(neighbors) {
  let count = 0
  if (neighbors.left) count++
  if (neighbors.right) count++
  if (neighbors.front) count++
  if (neighbors.back) count++
  return count
}

function _topologySignature(neighbors) {
  return [
    neighbors.top ? 'T1' : 'T0',
    neighbors.bottom ? 'B1' : 'B0',
    neighbors.left ? 'L1' : 'L0',
    neighbors.right ? 'R1' : 'R0',
    neighbors.front ? 'F1' : 'F0',
    neighbors.back ? 'K1' : 'K0',
  ].join('_')
}

function _addUnique(cells, seen, cell) {
  if (!cell || seen.has(cell.id)) return
  seen.add(cell.id)
  cells.push(cell)
}

const BuildingGrammarEngine = {
  resolveCell,
  resolveAffectedCells,
}

export { BuildingGrammarEngine }
