import { describe, it, expect, beforeEach } from 'vitest'
import { GridManager } from '../src/renderer/game/GridManager.js'
import { BuildingGrammarEngine } from '../src/renderer/game/BuildingGrammarEngine.js'
import { VisualRecipeRenderer } from '../src/renderer/game/VisualRecipeRenderer.js'
import { hashString, pickVariant, chance } from '../src/renderer/utils/deterministicHash.js'
import { getKitModelFiles, getKitModelUrl, getKitTextureUrl, getSemanticAsset } from '../src/renderer/assets/KitRegistry.js'
import { Cell } from '../src/renderer/game/Cell.js'
import { PrefabPlacementMode, getPrefabProfile } from '../src/renderer/game/PrefabPlacementMode.js'
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

  it('suburban surface context resolves path surfaces for Graphic Kit 2', () => {
    const cell = addCell(0, 0, 0)
    const recipe = BuildingGrammarEngine.resolveCell(cell, GridManager, {
      activeMaterial: 'suburban',
      activeKit: 'kenney-city-suburban',
      surfaceStyle: 'suburban',
    })

    expect(recipe.surfaceStyle).toBe('suburban')
    expect(recipe.surfaceLayer[0].surfaceStyle).toBe('suburban')
    expect(recipe.surfaceLayer[0].family).toBe('suburban')
    expect(getSemanticAsset('surface', recipe.surfaceLayer[0].assetType, 'kenney-city-suburban')).toMatch(/path-|driveway-/)
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
    expect(topRecipe.roofLayer[0].assetType).toBe('roof_peak')
  })

  it('roof line endpoints use gable roof, not isolated point caps', () => {
    addCell(0, 0, 0)
    addCell(1, 0, 0)
    const left = addCell(0, 1, 0, 'plaster')
    const right = addCell(1, 1, 0, 'plaster')

    const leftRecipe = BuildingGrammarEngine.resolveCell(left, GridManager)
    const rightRecipe = BuildingGrammarEngine.resolveCell(right, GridManager)

    expect(leftRecipe.roofLayer[0].assetType).toBe('roof_gable_detail')
    expect(rightRecipe.roofLayer[0].assetType).toBe('roof_gable_detail')
    expect(leftRecipe.roofLayer[0].assetType).not.toBe('roof_peak')
    expect(rightRecipe.roofLayer[0].assetType).not.toBe('roof_peak')
  })

  it('doors require an accessible foundation/path side', () => {
    addCell(0, 0, 0)
    const cell = addCell(0, 1, 0, 'plaster')
    addCell(1, 0, 0)

    const recipe = BuildingGrammarEngine.resolveCell(cell, GridManager)
    const doorFacades = recipe.facadeLayer.filter(item => item.detail === 'door')

    expect(recipe.accessDirections).toEqual([1])
    expect(doorFacades.every(item => item.side === 'east')).toBe(true)
  })

  it('balconies require front support and do not appear on tall tower stacks', () => {
    addCell(0, 0, 0)
    addCell(0, 1, 0, 'plaster')
    addCell(0, 2, 0, 'plaster')
    const towerTop = addCell(0, 3, 0, 'plaster')

    const recipe = BuildingGrammarEngine.resolveCell(towerTop, GridManager)

    expect(recipe.materialFamily).toBe('tower')
    expect(recipe.allowBalcony).toBe(false)
    expect(recipe.facadeLayer.some(item => item.detail === 'balcony')).toBe(false)
    expect(recipe.roofLayer[0].assetType).toBe('roof_high_point')
  })

  it('same topology and material resolve deterministically', () => {
    addCell(0, 0, 0)
    const cell = addCell(0, 1, 0, 'plaster')

    const first = BuildingGrammarEngine.resolveCell(cell, GridManager)
    const second = BuildingGrammarEngine.resolveCell(cell, GridManager)

    expect(second).toEqual(first)
  })

  it('isolated suburban houses resolve to whole-house Kit 2 prefabs in auto mode', () => {
    addCell(0, 0, 0)
    const cell = addCell(0, 1, 0, 'suburban')

    const first = BuildingGrammarEngine.resolveCell(cell, GridManager, {
      activeMaterial: 'suburban',
      activeKit: 'kenney-city-suburban',
      surfaceStyle: 'suburban',
    })
    const second = BuildingGrammarEngine.resolveCell(cell, GridManager, {
      activeMaterial: 'suburban',
      activeKit: 'kenney-city-suburban',
      surfaceStyle: 'suburban',
    })

    expect(first.primaryRole).toBe('prefab')
    expect(first.prefabLayer).toHaveLength(1)
    expect(['prefab_house_a', 'prefab_house_b', 'prefab_house_c']).toContain(first.prefabLayer[0].assetType)
    expect(['building-type-a.glb', 'building-type-b.glb', 'building-type-c.glb']).toContain(first.prefabLayer[0].fileName)
    expect(first.prefabLayer[0].scale).toBeGreaterThan(1.1)
    expect(first.prefabLayer[0].positionOffset[1]).toBeGreaterThan(0)
    expect(first.facadeLayer).toHaveLength(0)
    expect(first.roofLayer).toHaveLength(0)
    expect(second).toEqual(first)
  })

  it('auto suburban prefab faces an accessible supported entrance side', () => {
    addCell(0, 0, 0)
    const entrance = addCell(-1, 0, 0)
    const cell = addCell(0, 1, 0, 'suburban')

    const houseRecipe = BuildingGrammarEngine.resolveCell(cell, GridManager, {
      activeMaterial: 'suburban',
      activeKit: 'kenney-city-suburban',
      surfaceStyle: 'suburban',
    })
    const entranceRecipe = BuildingGrammarEngine.resolveCell(entrance, GridManager, {
      activeMaterial: 'suburban',
      activeKit: 'kenney-city-suburban',
      surfaceStyle: 'suburban',
    })

    expect(houseRecipe.prefabLayer[0].entranceSide).toBe('west')
    expect(houseRecipe.accessDirections).toEqual([0])
    expect(entranceRecipe.surfaceLayer[0].assetType).toBe('surface_entrance')
  })

  it('connected suburban cells stay modular to avoid overlapping whole-house prefabs', () => {
    addCell(0, 0, 0)
    addCell(1, 0, 0)
    const cell = addCell(0, 1, 0, 'suburban')
    addCell(1, 1, 0, 'suburban')

    const recipe = BuildingGrammarEngine.resolveCell(cell, GridManager, {
      activeMaterial: 'suburban',
      activeKit: 'kenney-city-suburban',
      surfaceStyle: 'suburban',
    })

    expect(recipe.prefabLayer).toHaveLength(0)
    expect(recipe.primaryRole).not.toBe('prefab')
    expect(recipe.facadeLayer.length).toBeGreaterThan(0)
    expect(recipe.roofLayer.length).toBeGreaterThan(0)
  })

  it('lot resolver forces one logical entrance and path surface in front of a house', () => {
    addCell(0, 0, 0)
    const entrance = addCell(0, 0, 1)
    const house = addCell(0, 1, 0, 'plaster')

    const houseRecipe = BuildingGrammarEngine.resolveCell(house, GridManager)
    house.visualRecipe = houseRecipe
    const entranceRecipe = BuildingGrammarEngine.resolveCell(entrance, GridManager)

    expect(houseRecipe.lot.isEntranceHost).toBe(true)
    expect(houseRecipe.lot.entranceSide).toBe('south')
    expect(houseRecipe.facadeLayer.some(item => item.side === 'south' && item.detail === 'door')).toBe(true)
    expect(entranceRecipe.surfaceLayer[0].assetType).toBe('surface_entrance')
    expect(entranceRecipe.surfaceLayer[0].surfaceRole).toBe('entrance')
  })

  it('entrance surfaces get contextual decoration instead of remaining empty slabs', () => {
    addCell(0, 0, 0)
    const entrance = addCell(0, 0, 1)
    addCell(0, 1, 0, 'plaster')

    const entranceRecipe = BuildingGrammarEngine.resolveCell(entrance, GridManager)

    expect(entranceRecipe.surfaceLayer[0].surfaceRole).toBe('entrance')
    expect(entranceRecipe.propLayer.some(item => item.assetType === 'prop_hedge' || item.assetType === 'prop_planter')).toBe(true)
  })

  it('connected house lots do not put doors on every modular cell', () => {
    addCell(0, 0, 0)
    addCell(1, 0, 0)
    addCell(0, 0, 1)
    addCell(1, 0, 1)
    const left = addCell(0, 1, 0, 'plaster')
    const right = addCell(1, 1, 0, 'plaster')

    const leftRecipe = BuildingGrammarEngine.resolveCell(left, GridManager)
    const rightRecipe = BuildingGrammarEngine.resolveCell(right, GridManager)
    const doorCount = [...leftRecipe.facadeLayer, ...rightRecipe.facadeLayer]
      .filter(item => item.detail === 'door').length

    expect(doorCount).toBe(1)
  })

  it('waterline decorator adds wet-stone detail on exposed quay sides', () => {
    const cell = addCell(0, 0, 0)
    const recipe = BuildingGrammarEngine.resolveCell(cell, GridManager)

    expect(recipe.propLayer.some(item => item.assetType === 'waterline_wet_stone')).toBe(true)
    expect(recipe.propLayer.every(item => item.assetType !== 'pillar-wood')).toBe(true)
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
    expect(facadeNames.some(name => name.endsWith('.glb'))).toBe(true)
    expect(roofNames.some(name => name.endsWith('.glb'))).toBe(true)
    expect(roofNames.some(name => name.startsWith('roof_'))).toBe(true)
    expect(group.userData.isBuilding).toBe(true)
  })

  it('flattens full-cell facade GLBs into side panels', () => {
    addCell(0, 0, 0)
    const cell = addCell(0, 1, 0, 'plaster')
    const recipe = BuildingGrammarEngine.resolveCell(cell, GridManager)
    const fakeAssetManager = {
      getRaw(fileName) {
        const group = new THREE.Group()
        group.name = fileName
        group.add(new THREE.Mesh(
          new THREE.BoxGeometry(1, 1, 1),
          new THREE.MeshBasicMaterial()
        ))
        return group
      },
    }

    const group = VisualRecipeRenderer.createCellGroup(cell, recipe, fakeAssetManager)
    const facadeLayer = group.children.find(child => child.name === 'facadeLayer')
    const facadeModel = facadeLayer.children.find(child => child.name.startsWith('facade_'))

    expect(facadeModel).toBeTruthy()
    expect(facadeModel.scale.z).toBeLessThan(0.1)
    expect(Math.abs(facadeModel.position.x) > 0.4 || Math.abs(facadeModel.position.z) > 0.4).toBe(true)
  })

  it('renders building body close to full cell height to avoid vertical gaps', () => {
    addCell(0, 0, 0)
    const cell = addCell(0, 1, 0, 'plaster')
    const recipe = BuildingGrammarEngine.resolveCell(cell, GridManager)
    const fakeAssetManager = {
      getRaw(fileName) {
        const group = new THREE.Group()
        group.name = fileName
        group.add(new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 0.2), new THREE.MeshBasicMaterial()))
        return group
      },
    }

    const group = VisualRecipeRenderer.createCellGroup(cell, recipe, fakeAssetManager)
    const body = group.getObjectByName('building_body_core')
    const size = new THREE.Vector3()
    new THREE.Box3().setFromObject(body).getSize(size)

    expect(size.y).toBeGreaterThan(0.94)
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

  it('renders suburban surface assets from Graphic Kit 2 when surfaceStyle is suburban', () => {
    const cell = addCell(0, 0, 0)
    const recipe = BuildingGrammarEngine.resolveCell(cell, GridManager, {
      activeMaterial: 'suburban',
      activeKit: 'kenney-city-suburban',
      surfaceStyle: 'suburban',
    })
    const files = []
    const fakeAssetManager = {
      getActiveKit: () => 'kenney-city-suburban',
      getRaw(fileName) {
        files.push(fileName)
        const group = new THREE.Group()
        group.name = fileName
        group.add(new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 0.2), new THREE.MeshBasicMaterial()))
        return group
      },
    }

    VisualRecipeRenderer.createCellGroup(cell, recipe, fakeAssetManager)
    expect(files.some(file => file.startsWith('path-') || file.startsWith('driveway-'))).toBe(true)
    expect(files).not.toContain('road.glb')
  })

  it('renders prefabLayer as a city-suburban house GLB', () => {
    addCell(0, 0, 0)
    const cell = addCell(0, 1, 0, 'suburban')
    cell.metadata = { prefabId: 'prefab_house_a', entranceSide: 'south' }
    const recipe = BuildingGrammarEngine.resolveCell(cell, GridManager, {
      activeMaterial: 'suburban',
      activeCategory: 'prefab',
      activeAssetId: 'prefab_house_a',
      activeKit: 'kenney-city-suburban',
      surfaceStyle: 'suburban',
    })
    const files = []
    const fakeAssetManager = {
      getRaw(fileName) {
        files.push(fileName)
        const group = new THREE.Group()
        group.name = fileName
        group.add(new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 0.2), new THREE.MeshBasicMaterial()))
        return group
      },
    }

    const group = VisualRecipeRenderer.createCellGroup(cell, recipe, fakeAssetManager)

    expect(recipe.prefabLayer[0].assetType).toBe('prefab_house_a')
    expect(files).toContain('building-type-a.glb')
    expect(group.children.map(child => child.name)).toContain('prefabLayer')
  })
})

describe('Graphic Kit 2 registry and save metadata', () => {
  it('registers required City Suburban models and texture variations', () => {
    const suburbanFiles = getKitModelFiles('kenney-city-suburban')
    expect(suburbanFiles).toHaveLength(40)
    expect(getKitModelFiles('kenney-town-kit').length).toBeGreaterThanOrEqual(160)
    expect(getKitModelUrl('building-type-a.glb', 'kenney-city-suburban')).toBeTruthy()
    expect(getKitModelUrl('path-long.glb', 'kenney-city-suburban')).toBeTruthy()
    expect(getKitModelUrl('path-stones-messy.glb', 'kenney-city-suburban')).toBeTruthy()
    expect(getKitModelUrl('driveway-short.glb', 'kenney-city-suburban')).toBeTruthy()
    expect(getKitModelUrl('planter.glb', 'kenney-city-suburban')).toBeTruthy()
    expect(getKitModelUrl('tree-small.glb', 'kenney-city-suburban')).toBeTruthy()
    expect(getKitTextureUrl('variation-a.png', 'kenney-city-suburban')).toBeTruthy()
    expect(getKitTextureUrl('variation-b.png', 'kenney-city-suburban')).toBeTruthy()
    expect(getKitTextureUrl('variation-c.png', 'kenney-city-suburban')).toBeTruthy()
    expect(getKitModelUrl('road.glb', 'kenney-town-kit')).toBeTruthy()
    expect(getSemanticAsset('props', 'prop_fence_3x3', 'kenney-city-suburban')).toBe('fence-3x3.glb')
    expect(getSemanticAsset('props', 'prop_fountain_round', 'kenney-town-kit')).toBe('fountain-round.glb')
  })

  it('serializes prefab metadata for save/load compatibility', () => {
    const cell = new Cell(1, 1, 2, '#F5DEB3', 'suburban')
    cell.metadata = { prefabId: 'prefab_house_a', entranceSide: 'south' }
    const restored = Cell.fromJSON(cell.toJSON())

    expect(restored.metadata).toEqual(cell.metadata)
  })

  it('manual prefab placement chooses an existing supported entrance side', () => {
    GridManager.clear()
    addCell(0, 0, 0)
    addCell(-1, 0, 0)

    const plan = PrefabPlacementMode.createPlan(GridManager, 0, 0, 'prefab_house_a')
    const house = plan.addCells.find(cell => cell.y === 1)
    const entrance = plan.updateCells.find(cell => cell.x === -1 && cell.z === 0)
    const profile = getPrefabProfile('prefab_house_a')

    expect(plan.entranceDirection).toBe(0)
    expect(house.metadata.entranceSide).toBe('west')
    expect(house.metadata.prefabRotation).toBeCloseTo(Math.PI / 2)
    expect(house.metadata.prefabScale).toBe(profile.scale)
    expect(house.metadata.prefabYOffset).toBe(profile.yOffset)
    expect(house.metadata.entranceCell).toEqual({ x: -1, y: 0, z: 0 })
    expect(entrance.metadata.surfaceAssetType).toBe('surface_entrance')
  })

  it('manual prefab placement creates a small contextual lot when space is empty', () => {
    GridManager.clear()

    const plan = PrefabPlacementMode.createPlan(GridManager, 0, 0, 'prefab_house_a')
    const foundationCells = plan.addCells.filter(cell => cell.y === 0)
    const entrance = foundationCells.find(cell => cell.metadata?.surfaceRole === 'entrance')
    const yardCells = foundationCells.filter(cell => cell.metadata?.autoReason?.startsWith('prefab_') && cell.metadata?.surfaceRole === 'plaza')

    expect(plan.entranceDirection).toBe(2)
    expect(foundationCells.length).toBeGreaterThanOrEqual(5)
    expect(entrance).toBeTruthy()
    expect(entrance.metadata.surfaceAssetType).toBe('surface_entrance')
    expect(yardCells.length).toBe(3)
    expect(yardCells.every(cell => cell.metadata.ownerPrefabId === 'prefab_house_a')).toBe(true)
  })
})

describe('deterministicHash utilities', () => {
  it('hashString, pickVariant, and chance are stable', () => {
    expect(hashString('cell|north|plaster')).toBe(hashString('cell|north|plaster'))
    expect(pickVariant('seed', ['a', 'b', 'c'])).toBe(pickVariant('seed', ['a', 'b', 'c']))
    expect(chance('seed', 0.5)).toBe(chance('seed', 0.5))
  })
})
