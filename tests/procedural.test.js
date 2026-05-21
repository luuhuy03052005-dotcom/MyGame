/**
 * procedural.test.js — Unit tests cho ProceduralRuleEngine
 * Vitest — chạy: npm run test
 *
 * Test cases theo RULES_REFERENCE.md mục 10.
 */

import { describe, it, expect } from 'vitest'
import { ProceduralRuleEngine } from '../src/renderer/game/ProceduralRuleEngine.js'
import { Cell } from '../src/renderer/game/Cell.js'

// Helper để tạo cell nhanh
const makeCell = (x, y, z) => new Cell(x, y, z, '#F5DEB3')

// Helper tạo neighbors object
const noNeighbors = { top: null, bottom: null, left: null, right: null, front: null, back: null }
const withNeighbor = (key, cell) => ({ ...noNeighbors, [key]: cell })

describe('ProceduralRuleEngine — Foundation (y=0)', () => {
  it('single isolated cell → foundation_seawall_round', () => {
    const cell = makeCell(0, 0, 0)
    const result = ProceduralRuleEngine.resolve(cell, noNeighbors)
    expect(result.assetType).toBe('foundation_seawall_round')
  })

  it('cell with all 4 horizontal neighbors → foundation_plaza_tile', () => {
    const cell = makeCell(1, 0, 1)
    const neighbors = {
      top: null, bottom: null,
      left:  makeCell(0, 0, 1),
      right: makeCell(2, 0, 1),
      front: makeCell(1, 0, 2),
      back:  makeCell(1, 0, 0),
    }
    const result = ProceduralRuleEngine.resolve(cell, neighbors)
    expect(result.assetType).toBe('foundation_plaza_tile')
    expect(result.rotation).toBe(0)
  })

  it('cell with 1 horizontal neighbor → foundation_seawall_end', () => {
    const cell = makeCell(0, 0, 0)
    const neighbors = { ...noNeighbors, right: makeCell(1, 0, 0) }
    const result = ProceduralRuleEngine.resolve(cell, neighbors)
    expect(result.assetType).toBe('foundation_seawall_end')
  })

  it('cell with 3 horizontal neighbors → foundation_seawall_straight', () => {
    const cell = makeCell(0, 0, 0)
    const neighbors = {
      ...noNeighbors,
      left: makeCell(-1, 0, 0),
      right: makeCell(1, 0, 0),
      front: makeCell(0, 0, 1),
    }
    const result = ProceduralRuleEngine.resolve(cell, neighbors)
    expect(result.assetType).toBe('foundation_seawall_straight')
  })

  it('cell with 2 adjacent horizontal neighbors → foundation_seawall_corner', () => {
    const cell = makeCell(0, 0, 0)
    const neighbors = {
      ...noNeighbors,
      left: makeCell(-1, 0, 0),
      front: makeCell(0, 0, 1),
    }
    const result = ProceduralRuleEngine.resolve(cell, neighbors)
    expect(result.assetType).toBe('foundation_seawall_corner')
  })
})

describe('ProceduralRuleEngine — Roof (y>0, no top neighbor)', () => {
  it('isolated roof cell → roof_peak', () => {
    const cell = makeCell(0, 2, 0)
    const neighbors = { ...noNeighbors, bottom: makeCell(0, 1, 0) }
    const result = ProceduralRuleEngine.resolve(cell, neighbors)
    expect(result.assetType).toBe('roof_peak')
  })

  it('1 horizontal neighbor (row end) → roof_peak', () => {
    const cell = makeCell(1, 1, 0)
    const neighbors = { ...noNeighbors, left: makeCell(0, 1, 0) }
    const result = ProceduralRuleEngine.resolve(cell, neighbors)
    expect(result.assetType).toBe('roof_peak')
  })

  it('2 opposite neighbors (left+right) → roof_gable', () => {
    const cell = makeCell(1, 1, 0)
    const neighbors = {
      ...noNeighbors,
      left: makeCell(0, 1, 0),
      right: makeCell(2, 1, 0),
    }
    const result = ProceduralRuleEngine.resolve(cell, neighbors)
    expect(result.assetType).toBe('roof_gable')
    expect(result.rotation).toBe(0)  // NORTH
  })

  it('2 opposite neighbors (front+back) → roof_gable EAST', () => {
    const cell = makeCell(0, 1, 1)
    const neighbors = {
      ...noNeighbors,
      front: makeCell(0, 1, 2),
      back:  makeCell(0, 1, 0),
    }
    const result = ProceduralRuleEngine.resolve(cell, neighbors)
    expect(result.assetType).toBe('roof_gable')
    expect(result.rotation).toBeCloseTo(Math.PI / 2)  // EAST
  })

  it('2 adjacent neighbors (left+front) → roof_hip_corner', () => {
    const cell = makeCell(1, 1, 1)
    const neighbors = {
      ...noNeighbors,
      left:  makeCell(0, 1, 1),
      front: makeCell(1, 1, 2),
    }
    const result = ProceduralRuleEngine.resolve(cell, neighbors)
    expect(result.assetType).toBe('roof_hip_corner')
  })

  it('3 horizontal neighbors → roof_t_junction', () => {
    const cell = makeCell(1, 1, 1)
    const neighbors = {
      ...noNeighbors,
      left:  makeCell(0, 1, 1),
      right: makeCell(2, 1, 1),
      front: makeCell(1, 1, 2),
    }
    const result = ProceduralRuleEngine.resolve(cell, neighbors)
    expect(result.assetType).toBe('roof_t_junction')
  })

  it('4 horizontal neighbors → roof_flat', () => {
    const cell = makeCell(1, 1, 1)
    const neighbors = {
      top: null, bottom: makeCell(1, 0, 1),
      left:  makeCell(0, 1, 1),
      right: makeCell(2, 1, 1),
      front: makeCell(1, 1, 2),
      back:  makeCell(1, 1, 0),
    }
    const result = ProceduralRuleEngine.resolve(cell, neighbors)
    expect(result.assetType).toBe('roof_flat')
    expect(result.rotation).toBe(0)
  })
})

describe('ProceduralRuleEngine — Wall (has top neighbor)', () => {
  it('wall with top and bottom neighbor → Seeded Façade Variation (wall_flat or wall_window)', () => {
    const cell = makeCell(0, 1, 0)
    const neighbors = {
      ...noNeighbors,
      top:    makeCell(0, 2, 0),
      bottom: makeCell(0, 0, 0),
    }
    const result = ProceduralRuleEngine.resolve(cell, neighbors)
    expect(['wall_flat', 'wall_window']).toContain(result.assetType)
  })

  it('wall with top but no bottom neighbor → foundation_wall', () => {
    const cell = makeCell(0, 1, 0)
    const neighbors = {
      ...noNeighbors,
      top: makeCell(0, 2, 0),
    }
    const result = ProceduralRuleEngine.resolve(cell, neighbors)
    expect(result.assetType).toBe('foundation_wall')
  })

  it('wall corner (left+front neighbor) → wall_corner', () => {
    const cell = makeCell(1, 1, 1)
    const neighbors = {
      top:    makeCell(1, 2, 1),
      bottom: makeCell(1, 0, 1),
      left:   makeCell(0, 1, 1),
      front:  makeCell(1, 1, 2),
      right:  null,
      back:   null,
    }
    const result = ProceduralRuleEngine.resolve(cell, neighbors)
    expect(result.assetType).toBe('wall_corner')
  })
})

describe('ProceduralRuleEngine — Determinism', () => {
  it('same cell + same neighbors → same result every time', () => {
    const cell = makeCell(5, 3, 7)
    const neighbors = { ...noNeighbors, bottom: makeCell(5, 2, 7), top: makeCell(5, 4, 7) }

    const result1 = ProceduralRuleEngine.resolve(cell, neighbors)
    const result2 = ProceduralRuleEngine.resolve(cell, neighbors)
    const result3 = ProceduralRuleEngine.resolve(cell, neighbors)

    expect(result1.assetType).toBe(result2.assetType)
    expect(result2.assetType).toBe(result3.assetType)
    expect(result1.rotation).toBe(result2.rotation)
  })

  it('Seeded Façade Variation is deterministic based on topologySignature', () => {
    const cell = makeCell(5, 3, 7)
    
    // Topology 1: top, bottom
    const neighbors1 = {
      top: makeCell(5, 4, 7),
      bottom: makeCell(5, 2, 7),
      left: null, right: null, front: null, back: null,
    }

    // Topology 2: top, bottom, left
    const neighbors2 = {
      ...neighbors1,
      left: makeCell(4, 3, 7),
    }

    // Resolving same topology multiple times should give same result
    const results1 = Array.from({ length: 5 }, () =>
      ProceduralRuleEngine.resolve(cell, neighbors1).assetType
    )
    expect(new Set(results1).size).toBe(1)
    
    const results2 = Array.from({ length: 5 }, () =>
      ProceduralRuleEngine.resolve(cell, neighbors2).assetType
    )
    expect(new Set(results2).size).toBe(1)
  })
})
