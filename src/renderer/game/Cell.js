/**
 * Cell.js — Data Class cho mỗi ô trong grid
 *
 * Theo DATA_MODELS.md mục 2:
 * Schema: { id, x, y, z, color, assetType, rotation, mesh, metadata }
 *
 * KHÔNG phải singleton — mỗi cell là một instance riêng.
 */

export class Cell {
  /**
   * @param {number} x
   * @param {number} y
   * @param {number} z
   * @param {string} color - hex string "#RRGGBB"
   */
  constructor(x, y, z, color = '#F5DEB3', material = 'stone_quay') {
    this.id = Cell.getId(x, y, z)
    this.x = x
    this.y = y
    this.z = z
    this.color = color
    this.material = material
    this.assetType = '_fallback'   // sẽ được resolve bởi ProceduralRuleEngine
    this.rotation = 0              // sẽ được tính bởi ProceduralRuleEngine (radians)
    this.mesh = null               // THREE.Object3D — null cho đến khi spawn
    this.metadata = {}             // extensible
  }

  /**
   * Static method tạo cell ID từ coordinates.
   * @param {number} x
   * @param {number} y
   * @param {number} z
   * @returns {string} "x_y_z"
   */
  static getId(x, y, z) {
    return `${x}_${y}_${z}`
  }

  /**
   * Serialize cell thành plain object cho save file.
   * KHÔNG serialize mesh (chỉ lưu logic state).
   * @returns {object}
   */
  toJSON() {
    return {
      id: this.id,
      x: this.x,
      y: this.y,
      z: this.z,
      color: this.color,
      material: this.material,
      assetType: this.assetType,
      rotation: this.rotation,
      metadata: this.metadata ?? {},
    }
  }

  /**
   * Factory method tạo Cell từ JSON object.
   * @param {object} data
   * @returns {Cell}
   */
  static fromJSON(data) {
    const cell = new Cell(data.x, data.y, data.z, data.color, data.material ?? 'stone_quay')
    cell.assetType = data.assetType ?? '_fallback'
    cell.rotation = data.rotation ?? 0
    cell.metadata = data.metadata ?? {}
    return cell
  }
}
