/**
 * grid.test.js — Unit tests cho GridManager
 * Vitest — chạy: npm run test
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { GridManager } from '../src/renderer/game/GridManager.js'
import { Cell } from '../src/renderer/game/Cell.js'

describe('Cell', () => {
  it('getId returns "x_y_z"', () => {
    expect(Cell.getId(1, 2, 3)).toBe('1_2_3')
    expect(Cell.getId(0, 0, 0)).toBe('0_0_0')
    expect(Cell.getId(-1, 5, -3)).toBe('-1_5_-3')
  })

  it('constructor sets correct fields', () => {
    const cell = new Cell(3, 1, 2, '#FF0000')
    expect(cell.id).toBe('3_1_2')
    expect(cell.x).toBe(3)
    expect(cell.y).toBe(1)
    expect(cell.z).toBe(2)
    expect(cell.color).toBe('#FF0000')
    expect(cell.assetType).toBe('_fallback')
    expect(cell.rotation).toBe(0)
    expect(cell.mesh).toBeNull()
  })

  it('toJSON does not include mesh', () => {
    const cell = new Cell(1, 0, 2, '#F5DEB3')
    const json = cell.toJSON()
    expect(json.mesh).toBeUndefined()
    expect(json.id).toBe('1_0_2')
    expect(json.color).toBe('#F5DEB3')
  })

  it('fromJSON reconstructs cell correctly', () => {
    const data = { x: 2, y: 1, z: 3, color: '#DEB887', assetType: 'wall_flat', rotation: 1.5708 }
    const cell = Cell.fromJSON(data)
    expect(cell.x).toBe(2)
    expect(cell.assetType).toBe('wall_flat')
    expect(cell.rotation).toBeCloseTo(1.5708)
  })
})

describe('GridManager', () => {
  beforeEach(() => {
    GridManager.clear()
  })

  it('addCell creates cell with correct coordinates', () => {
    const cell = GridManager.addCell(1, 0, 2, '#F5DEB3')
    expect(cell.x).toBe(1)
    expect(cell.y).toBe(0)
    expect(cell.z).toBe(2)
    expect(cell.id).toBe('1_0_2')
  })

  it('getCell returns cell after adding', () => {
    GridManager.addCell(3, 1, 4, '#DEB887')
    const found = GridManager.getCell(3, 1, 4)
    expect(found).not.toBeNull()
    expect(found.id).toBe('3_1_4')
  })

  it('getCell returns null for non-existent', () => {
    expect(GridManager.getCell(99, 99, 99)).toBeNull()
  })

  it('hasCell returns true/false correctly', () => {
    GridManager.addCell(0, 0, 0, '#FF0000')
    expect(GridManager.hasCell(0, 0, 0)).toBe(true)
    expect(GridManager.hasCell(1, 0, 0)).toBe(false)
  })

  it('removeCell returns removed cell', () => {
    GridManager.addCell(5, 2, 3, '#FF0000')
    const removed = GridManager.removeCell(5, 2, 3)
    expect(removed).not.toBeNull()
    expect(removed.id).toBe('5_2_3')
    expect(GridManager.getCell(5, 2, 3)).toBeNull()
  })

  it('removeCell returns null when cell not found', () => {
    expect(GridManager.removeCell(0, 0, 0)).toBeNull()
  })

  it('getNeighbors returns correct 6 neighbors', () => {
    GridManager.addCell(0, 1, 0, '#FF0000')  // top of (0,0,0)
    GridManager.addCell(1, 0, 0, '#FF0000')  // right of (0,0,0)
    GridManager.addCell(0, 0, 1, '#FF0000')  // front of (0,0,0)

    const n = GridManager.getNeighbors(0, 0, 0)
    expect(n.top).not.toBeNull()
    expect(n.top.id).toBe('0_1_0')
    expect(n.right).not.toBeNull()
    expect(n.right.id).toBe('1_0_0')
    expect(n.front).not.toBeNull()
    expect(n.front.id).toBe('0_0_1')
    expect(n.bottom).toBeNull()
    expect(n.left).toBeNull()
    expect(n.back).toBeNull()
  })

  it('getTopCell returns highest y at column x,z', () => {
    GridManager.addCell(0, 0, 0, '#FF0000')
    GridManager.addCell(0, 1, 0, '#FF0000')
    GridManager.addCell(0, 2, 0, '#FF0000')

    const top = GridManager.getTopCell(0, 0)
    expect(top.y).toBe(2)
  })

  it('getTopCell returns null for empty column', () => {
    expect(GridManager.getTopCell(99, 99)).toBeNull()
  })

  it('getAllCells returns all added cells', () => {
    GridManager.addCell(0, 0, 0, '#FF0000')
    GridManager.addCell(1, 0, 0, '#FF0000')
    GridManager.addCell(2, 0, 0, '#FF0000')
    expect(GridManager.getAllCells()).toHaveLength(3)
  })

  it('clear removes all cells', () => {
    GridManager.addCell(0, 0, 0, '#FF0000')
    GridManager.addCell(1, 0, 0, '#FF0000')
    GridManager.clear()
    expect(GridManager.getCellCount()).toBe(0)
  })
})
