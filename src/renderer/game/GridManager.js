/**
 * GridManager.js — Singleton quản lý Map<cellId, Cell>
 *
 * Theo ARCHITECTURE.md 2.5 và DATA_MODELS.md:
 * Internal store: Map<string, Cell>
 *
 * Public API (tất cả theo ARCHITECTURE.md):
 *   GridManager.addCell(x, y, z, color) → Cell
 *   GridManager.removeCell(x, y, z) → Cell | null
 *   GridManager.getCell(x, y, z) → Cell | null
 *   GridManager.getNeighbors(x, y, z) → Neighbors
 *   GridManager.getAllCells() → Cell[]
 *   GridManager.hasCell(x, y, z) → boolean
 *   GridManager.getTopCell(x, z) → Cell | null  (cell cao nhất tại cột x,z)
 *   GridManager.clear()
 *   GridManager.getCellCount() → number
 */

import { Cell } from './Cell.js'

// Internal store — private
const _cells = new Map()

const GridManager = {
  /**
   * Thêm cell vào grid.
   * Nếu đã có cell tại x,y,z → log warning và overwrite.
   * @param {number} x
   * @param {number} y
   * @param {number} z
   * @param {string} color - hex "#RRGGBB"
   * @returns {Cell}
   */
  addCell(x, y, z, color) {
    const id = Cell.getId(x, y, z)
    if (_cells.has(id)) {
      console.warn(`[GridManager] Cell already exists at ${id}, overwriting`)
    }
    const cell = new Cell(x, y, z, color)
    _cells.set(id, cell)
    return cell
  },

  /**
   * Xóa cell khỏi grid.
   * @param {number} x
   * @param {number} y
   * @param {number} z
   * @returns {Cell | null} cell đã xóa, hoặc null nếu không tồn tại
   */
  removeCell(x, y, z) {
    const id = Cell.getId(x, y, z)
    const cell = _cells.get(id) ?? null
    if (cell) _cells.delete(id)
    return cell
  },

  /**
   * @param {number} x
   * @param {number} y
   * @param {number} z
   * @returns {Cell | null}
   */
  getCell(x, y, z) {
    return _cells.get(Cell.getId(x, y, z)) ?? null
  },

  /**
   * @param {number} x
   * @param {number} y
   * @param {number} z
   * @returns {boolean}
   */
  hasCell(x, y, z) {
    return _cells.has(Cell.getId(x, y, z))
  },

  /**
   * Lấy 6 neighbors của cell tại x,y,z.
   * Theo DATA_MODELS.md mục 3.
   * @param {number} x
   * @param {number} y
   * @param {number} z
   * @returns {{ top, bottom, left, right, front, back }}
   */
  getNeighbors(x, y, z) {
    return {
      top:    GridManager.getCell(x, y + 1, z),
      bottom: GridManager.getCell(x, y - 1, z),
      left:   GridManager.getCell(x - 1, y, z),
      right:  GridManager.getCell(x + 1, y, z),
      front:  GridManager.getCell(x, y, z + 1),
      back:   GridManager.getCell(x, y, z - 1),
    }
  },

  /**
   * Lấy cell cao nhất (y lớn nhất) tại cột x, z.
   * Dùng để xác định vị trí y khi click build (stack lên tầng trên cùng).
   * @param {number} x
   * @param {number} z
   * @returns {Cell | null}
   */
  getTopCell(x, z) {
    let topCell = null
    let maxY = -Infinity
    for (const cell of _cells.values()) {
      if (cell.x === x && cell.z === z && cell.y > maxY) {
        maxY = cell.y
        topCell = cell
      }
    }
    return topCell
  },

  /** @returns {Cell[]} tất cả cells trong grid */
  getAllCells() {
    return Array.from(_cells.values())
  },

  /** @returns {number} */
  getCellCount() {
    return _cells.size
  },

  /** Xóa toàn bộ grid (dùng cho load new world và test reset) */
  clear() {
    _cells.clear()
    console.log('[GridManager] Cleared')
  },
}

export { GridManager }
