import { describe, it, expect, beforeEach } from 'vitest'
import { GridManager } from '../src/renderer/game/GridManager.js'
import { BuildingGrammarEngine } from '../src/renderer/game/BuildingGrammarEngine.js'
import { VisualRecipeRenderer } from '../src/renderer/game/VisualRecipeRenderer.js'
import { hashString, pickVariant, chance } from '../src/renderer/utils/deterministicHash.js'
import * as THREE from 'three'

function addCell(x, y, z, material = 'stone_quay') {
  const cell = GridManager.addCell(x, y, z, '#F5DEB3')
  cell.material = material
  return cell
}

describe('BuildingGrammarEngine — Foundation topology', () => {
  beforeEach(() => {
    GridManager.clear()
  })

  it('single foundation cell resolves to isolated stone quay, not pier by default', () => {
    const cell = addCell(0, 0, 0)
    const recipe = BuildingGrammarEngine.resolveCell(cell, GridManager)

    expect(recipe.foundationStyle).toBe('stone_quay')
    expect(recipe.primaryAssetType).toBe('foundation_seawall_round')
    expect(recipe.foundationLayer[0].role).toBe('foundation')
    expect(recipe.primaryAssetType).not.toBe('foundation_arch')
    expect(recipe.primaryAssetType).not.toBe('foundation_solid')
  })

  it('interior foundation cell resolves to plaza tile', () => {
    const center = addCell(0, 0, 0)
    addCell(-1, 0, 0)
    addCell(1, 0, 0)
    addCell(0, 0, 1)
    addCell(0, 0, -1)

    const recipe = BuildingGrammarEngine.resolveCell(center, GridManager)
    expect(recipe.primaryAssetType).toBe('foundation_plaza_tile')
    expect(recipe.openDirections).toEqual([])
  })

  it('adjacent exposed sides resolve to corner seawall', () => {
    const cell = addCell(0, 0, 0)
    addCell(1, 0, 0)
    addCell(0, 0, 1)

    const recipe = BuildingGrammarEngine.resolveCell(cell, GridManager)
    expect(recipe.primaryAssetType).toBe('foundation_seawall_corner')
  })

  it('harbor pier style is explicitly gated behind harbor_pier material', () => {
    const cell = addCell(0, 0, 0, 'harbor_pier')
    const recipe = BuildingGrammarEngine.resolveCell(cell, GridManager, {
      foundationStyle: 'harbor_pier',
      materialFamily: 'harbor_pier',
    })

    expect(recipe.foundationStyle).toBe('harbor_pier')
    expect(['foundation_arch', 'foundation_solid']).toContain(recipe.primaryAssetType)
  })

  it('foundation cells include a separate surface layer', () => {
    const cell = addCell(0, 0, 0)
    const recipe = BuildingGrammarEngine.resolveCell(cell, GridManager)

    expect(recipe.surfaceLayer).toHaveLength(1)
    expect(recipe.surfaceLayer[0].role).toBe('surface')
    expect(recipe.surfaceLayer[0].assetType).toBe('surface_quay_corner')
    expect(recipe.surfaceLayer[0].positionOffset[1]).toBeGreaterThan(0.4)
  })

  it('foundation under a building uses building footprint surface, not a plaza road tile', () => {
    const foundation = addCell(0, 0, 0)
    addCell(0, 1, 0, 'plaster')

    const recipe = BuildingGrammarEngine.resolveCell(foundation, GridManager)
    expect(recipe.surfaceLayer[0].assetType).toBe('surface_building_footprint')
  })

  it('interior empty foundation resolves to plaza surface', () => {
    const center = addCell(0, 0, 0)
    addCell(-1, 0, 0)
    addCell(1, 0, 0)
    addCell(0, 0, 1)
    addCell(0, 0, -1)

    const recipe = BuildingGrammarEngine.resolveCell(center, GridManager)
    expect(recipe.surfaceLayer[0].assetType).toBe('surface_plaza_center')
  })
})

describe('BuildingGrammarEngine — Facade and roof grammar', () => {
  beforeEach(() => {
    GridManager.clear()
  })

  it('facade layer is per exposed side only', () => {
    addCell(0, 0, 0)
    const cell = addCell(0, 1, 0, 'plaster')
    addCell(1, 1, 0, 'plaster')

    const recipe = BuildingGrammarEngine.resolveCell(cell, GridManager)
    const sides = recipe.facadeLayer.map(item => item.side)

    expect(recipe.facadeLayer.length).toBe(3)
    expect(sides).not.toContain('east')
    expect(sides).toEqual(expect.arrayContaining(['west', 'north', 'south']))
  })

  it('roof appears only on topmost cells', () => {
    addCell(0, 0, 0)
    const lower = addCell(0, 1, 0, 'plaster')
    const top = addCell(0, 2, 0, 'plaster')

    const lowerRecipe = BuildingGrammarEngine.resolveCell(lower, GridManager)
    const topRecipe = BuildingGrammarEngine.resolveCell(top, GridManager)

    expect(lowerRecipe.roofLayer).toHaveLength(0)
    expect(topRecipe.roofLayer).toHaveLength(1)
    expect(topRecipe.roofLayer[0].assetType).toBe('roof_window')
  })

  it('same topology and material resolve deterministically', () => {
    addCell(0, 0, 0)
    const cell = addCell(0, 1, 0, 'plaster')

    const first = BuildingGrammarEngine.resolveCell(cell, GridManager)
    const second = BuildingGrammarEngine.resolveCell(cell, GridManager)

    expect(second).toEqual(first)
  })
})

describe('VisualRecipeRenderer', () => {
  beforeEach(() => {
    GridManager.clear()
  })

  it('renders recipe as real layer groups instead of one primary asset', () => {
    const foundation = addCell(0, 0, 0)
    const cell = addCell(0, 1, 0, 'plaster')
    const recipe = BuildingGrammarEngine.resolveCell(cell, GridManager)
    const fakeAssetManager = {
      getRaw(fileName) {
        const group = new THREE.Group()
        group.name = fileName
        const mesh = new THREE.Mesh(
          new THREE.BoxGeometry(0.2, 0.2, 0.2),
          new THREE.MeshBasicMaterial()
        )
        group.add(mesh)
        return group
      },
    }

    const group = VisualRecipeRenderer.createCellGroup(cell, recipe, fakeAssetManager)
    const layerNames = group.children.map(child => child.name)
    const facadeLayer = group.children.find(child => child.name === 'facadeLayer')
    const roofLayer = group.children.find(child => child.name === 'roofLayer')
    const facadeNames = []
    const roofNames = []
    facadeLayer.traverse(child => facadeNames.push(child.name))
    roofLayer.traverse(child => roofNames.push(child.name))

    expect(foundation.id).toBe('0_0_0')
    expect(group.userData.visualRecipe).toBe(recipe)
    expect(layerNames).toContain('facadeLayer')
    expect(layerNames).toContain('roofLayer')
    expect(facadeNames).toContain('building_body_core')
    expect(facadeNames.some(name => name.endsWith('.glb'))).toBe(false)
    expect(roofNames.some(name => name.endsWith('.glb'))).toBe(false)
    expect(roofNames.some(name => name.startsWith('roof_'))).toBe(true)
    expect(group.userData.isBuilding).toBe(true)
  })

  it('renders surfaceLayer on foundation cells', () => {
    const cell = addCell(0, 0, 0)
    const recipe = BuildingGrammarEngine.resolveCell(cell, GridManager)
    const fakeAssetManager = {
      getRaw(fileName) {
        const group = new THREE.Group()
        group.name = fileName
        group.add(new THREE.Mesh(
          new THREE.BoxGeometry(0.2, 0.2, 0.2),
          new THREE.MeshBasicMaterial()
        ))
        return group
      },
    }

    const group = VisualRecipeRenderer.createCellGroup(cell, recipe, fakeAssetManager)
    const layerNames = group.children.map(child => child.name)
    const surfaceLayer = group.children.find(child => child.name === 'surfaceLayer')

    expect(layerNames).toContain('foundationLayer')
    expect(layerNames).toContain('surfaceLayer')
    expect(surfaceLayer.children.some(child => child.name === 'surface_stone_underlay')).toBe(true)
  })
})

describe('deterministicHash utilities', () => {
  it('hashString, pickVariant, and chance are stable', () => {
    expect(hashString('cell|north|plaster')).toBe(hashString('cell|north|plaster'))
    expect(pickVariant('seed', ['a', 'b', 'c'])).toBe(pickVariant('seed', ['a', 'b', 'c']))
    expect(chance('seed', 0.5)).toBe(chance('seed', 0.5))
  })
})
