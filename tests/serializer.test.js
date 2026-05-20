/**
 * serializer.test.js — Unit tests cho WorldSerializer
 * Vitest — npm run test
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { WorldSerializer } from '../src/renderer/game/WorldSerializer.js'
import { GridManager }     from '../src/renderer/game/GridManager.js'

// Mock GridManager với cells
function makeGridWithCells() {
  GridManager.clear()
  GridManager.addCell(0, 0, 0, '#F5DEB3').assetType = 'foundation_arch'
  GridManager.addCell(1, 0, 0, '#DEB887').assetType = 'foundation_solid'
  GridManager.addCell(0, 1, 0, '#CD853F').assetType = 'wall_flat'
  // Manually set id để toJSON đúng
  GridManager.getAllCells().forEach(c => {
    c.rotation = 0
  })
}

const dummyCamera  = { azimuth: 0.785, elevation: 0.611, distance: 15, target: [0, 0, 0] }
const dummyPalette = { activeColor: '#F5DEB3', colors: [] }

describe('WorldSerializer.serialize', () => {
  beforeEach(() => GridManager.clear())

  it('returns valid JSON string', () => {
    GridManager.clear()
    const json = WorldSerializer.serialize(GridManager, dummyCamera, dummyPalette)
    expect(() => JSON.parse(json)).not.toThrow()
  })

  it('includes meta fields', () => {
    const json = WorldSerializer.serialize(GridManager, dummyCamera, dummyPalette)
    const doc = JSON.parse(json)
    expect(doc.meta.schemaVersion).toBe(1)
    expect(doc.meta.worldId).toBeTruthy()
    expect(doc.meta.createdAt).toBeTruthy()
    expect(doc.meta.updatedAt).toBeTruthy()
  })

  it('includes cells from GridManager', () => {
    makeGridWithCells()
    const json = WorldSerializer.serialize(GridManager, dummyCamera, dummyPalette)
    const doc = JSON.parse(json)
    expect(doc.cells).toHaveLength(3)
    expect(doc.cells[0].x).toBeDefined()
    expect(doc.cells[0].color).toMatch(/^#[0-9A-Fa-f]{6}$/)
  })

  it('cells do NOT include mesh (only serializable fields)', () => {
    makeGridWithCells()
    const json = WorldSerializer.serialize(GridManager, dummyCamera, dummyPalette)
    const doc = JSON.parse(json)
    doc.cells.forEach(cell => {
      expect(cell.mesh).toBeUndefined()
    })
  })

  it('includes camera state', () => {
    const json = WorldSerializer.serialize(GridManager, dummyCamera, dummyPalette)
    const doc = JSON.parse(json)
    expect(doc.camera.azimuth).toBeCloseTo(0.785)
    expect(doc.camera.distance).toBe(15)
  })

  it('includes palette state', () => {
    const json = WorldSerializer.serialize(GridManager, dummyCamera, dummyPalette)
    const doc = JSON.parse(json)
    expect(doc.palette.activeColor).toBe('#F5DEB3')
  })

  it('re-uses worldId on subsequent saves with meta', () => {
    const json1 = WorldSerializer.serialize(GridManager, dummyCamera, dummyPalette)
    const doc1 = JSON.parse(json1)
    const meta = { worldId: doc1.meta.worldId, createdAt: doc1.meta.createdAt }

    const json2 = WorldSerializer.serialize(GridManager, dummyCamera, dummyPalette, meta)
    const doc2 = JSON.parse(json2)
    expect(doc2.meta.worldId).toBe(doc1.meta.worldId)
    expect(doc2.meta.createdAt).toBe(doc1.meta.createdAt)
  })
})

describe('WorldSerializer.deserialize', () => {
  it('parses valid JSON and returns valid=true', () => {
    makeGridWithCells()
    const json = WorldSerializer.serialize(GridManager, dummyCamera, dummyPalette)
    const result = WorldSerializer.deserialize(json)
    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
    expect(result.data).not.toBeNull()
    expect(result.data.cells).toHaveLength(3)
  })

  it('returns valid=false for invalid JSON', () => {
    const result = WorldSerializer.deserialize('not json {{{')
    expect(result.valid).toBe(false)
    expect(result.errors[0]).toContain('parse')
  })

  it('returns valid=false for missing meta', () => {
    const json = JSON.stringify({ world: { name: 'test' }, cells: [] })
    const result = WorldSerializer.deserialize(json)
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.includes('meta'))).toBe(true)
  })
})

describe('WorldSerializer.validate', () => {
  it('validates correct document', () => {
    makeGridWithCells()
    const json = WorldSerializer.serialize(GridManager, dummyCamera, dummyPalette)
    const doc = JSON.parse(json)
    const result = WorldSerializer.validate(doc)
    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })

  it('fails if cells is not array', () => {
    const doc = {
      meta: { schemaVersion: 1, worldId: 'abc' },
      world: { name: 'test' },
      cells: 'not-an-array',
    }
    const result = WorldSerializer.validate(doc)
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.includes('array'))).toBe(true)
  })

  it('fails on invalid color format', () => {
    const doc = {
      meta: { schemaVersion: 1, worldId: 'abc' },
      world: { name: 'test' },
      cells: [{ id: '0_0_0', x: 0, y: 0, z: 0, color: 'red', assetType: 'wall_flat', rotation: 0 }],
    }
    const result = WorldSerializer.validate(doc)
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.includes('color'))).toBe(true)
  })

  it('fails on cell id mismatch', () => {
    const doc = {
      meta: { schemaVersion: 1, worldId: 'abc' },
      world: { name: 'test' },
      cells: [{ id: '9_9_9', x: 0, y: 0, z: 0, color: '#F5DEB3', assetType: 'wall_flat', rotation: 0 }],
    }
    const result = WorldSerializer.validate(doc)
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.includes('mismatch'))).toBe(true)
  })
})

describe('WorldSerializer.migrate', () => {
  it('passes through schema version 1 unchanged', () => {
    const doc = { meta: { schemaVersion: 1, worldId: 'abc' }, world: {}, cells: [] }
    const migrated = WorldSerializer.migrate(doc)
    expect(migrated).toBe(doc)  // same reference
  })

  it('throws on unknown schema version', () => {
    const doc = { meta: { schemaVersion: 99 }, world: {}, cells: [] }
    expect(() => WorldSerializer.migrate(doc)).toThrow()
  })
})
