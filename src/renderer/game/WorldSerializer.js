/**
 * WorldSerializer.js — Pure Functions serialize/deserialize/validate
 *
 * Theo DATA_MODELS.md mục 7 và TASKS.md P6-01.
 *
 * Không có dependency vào DOM hay Three.js — pure data logic.
 *
 * Public API:
 *   WorldSerializer.serialize(gridManager, cameraController, palette) → string (JSON)
 *   WorldSerializer.deserialize(jsonString) → WorldData | null
 *   WorldSerializer.validate(data) → { valid: boolean, errors: string[] }
 *   WorldSerializer.migrate(doc) → doc (version migration)
 */

import { Cell } from './Cell.js'

const CURRENT_SCHEMA_VERSION = 1
const APP_VERSION = '0.1.0'

// UUID v4 đơn giản (không cần library)
function uuidv4() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0
    const v = c === 'x' ? r : (r & 0x3 | 0x8)
    return v.toString(16)
  })
}

const WorldSerializer = {
  /**
   * Serialize world state thành JSON string.
   *
   * @param {object} gridManager - GridManager singleton
   * @param {object} cameraState - { azimuth, elevation, distance, target:[x,y,z] }
   * @param {object} paletteState - { activeColor, colors: string[] }
   * @param {object} [meta] - override meta fields (worldId, worldName)
   * @returns {string} JSON string
   */
  serialize(gridManager, cameraState, paletteState, meta = {}) {
    const now = new Date().toISOString()

    const doc = {
      meta: {
        schemaVersion: CURRENT_SCHEMA_VERSION,
        appVersion: APP_VERSION,
        worldId: meta.worldId ?? uuidv4(),
        createdAt: meta.createdAt ?? now,
        updatedAt: now,
      },
      world: {
        name: meta.worldName ?? 'My Town',
        seaLevel: 0,
      },
      camera: {
        azimuth:   cameraState.azimuth   ?? 0.785,
        elevation: cameraState.elevation ?? 0.611,
        distance:  cameraState.distance  ?? 15.0,
        target:    cameraState.target    ?? [0, 0, 0],
      },
      palette: {
        activeColor: paletteState.activeColor ?? '#F5DEB3',
        colors: paletteState.colors ?? [],
      },
      cells: gridManager.getAllCells().map(cell => cell.toJSON()),
    }

    return JSON.stringify(doc, null, 2)
  },

  /**
   * Deserialize JSON string thành WorldData.
   *
   * @param {string} jsonString
   * @returns {{ valid: boolean, data: object|null, errors: string[] }}
   */
  deserialize(jsonString) {
    let doc
    try {
      doc = JSON.parse(jsonString)
    } catch (e) {
      return { valid: false, data: null, errors: [`JSON parse error: ${e.message}`] }
    }

    // Migration trước khi validate
    try {
      doc = WorldSerializer.migrate(doc)
    } catch (e) {
      return { valid: false, data: null, errors: [e.message] }
    }

    const validation = WorldSerializer.validate(doc)
    if (!validation.valid) {
      return { valid: false, data: null, errors: validation.errors }
    }

    return { valid: true, data: doc, errors: [] }
  },

  /**
   * Validate WorldData document.
   * Theo DATA_MODELS.md mục 11.
   *
   * @param {object} data
   * @returns {{ valid: boolean, errors: string[] }}
   */
  validate(data) {
    const errors = []

    if (!data || typeof data !== 'object') {
      return { valid: false, errors: ['Document must be an object'] }
    }

    // meta
    if (!data.meta) errors.push('Missing meta')
    else {
      if (data.meta.schemaVersion == null) errors.push('Missing meta.schemaVersion')
      if (!data.meta.worldId) errors.push('Missing meta.worldId')
    }

    // world
    if (!data.world) errors.push('Missing world')

    // cells
    if (!Array.isArray(data.cells)) {
      errors.push('cells must be an array')
    } else {
      for (const cell of data.cells) {
        if (cell.x == null || cell.y == null || cell.z == null) {
          errors.push(`Cell missing coordinate: ${cell.id}`)
        }
        if (!cell.color) {
          errors.push(`Cell missing color: ${cell.id}`)
        } else if (!/^#[0-9A-Fa-f]{6}$/.test(cell.color)) {
          errors.push(`Invalid color format: ${cell.color}`)
        }
        if (!cell.assetType) {
          errors.push(`Cell missing assetType: ${cell.id}`)
        }
        // Verify id khớp với x_y_z
        const expectedId = Cell.getId(cell.x, cell.y, cell.z)
        if (cell.id && cell.id !== expectedId) {
          errors.push(`Cell id mismatch: ${cell.id} (expected ${expectedId})`)
        }
      }
    }

    return { valid: errors.length === 0, errors }
  },

  /**
   * Migrate document về CURRENT_SCHEMA_VERSION.
   * Hiện tại chỉ có version 1 — sẵn sàng cho future migration.
   *
   * @param {object} doc
   * @returns {object} migrated doc
   */
  migrate(doc) {
    let v = doc?.meta?.schemaVersion ?? 1

    // Future: thêm migration tại đây khi bump version
    // if (v === 1) { doc = migrateV1toV2(doc); v = 2 }

    if (v !== CURRENT_SCHEMA_VERSION) {
      throw new Error(`Unsupported schema version: ${v}`)
    }

    return doc
  },
}

export { WorldSerializer }
