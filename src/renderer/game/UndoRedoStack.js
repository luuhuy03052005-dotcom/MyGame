/**
 * UndoRedoStack.js — Circular buffer cho undo/redo
 *
 * Theo TASKS.md P2-05 và DATA_MODELS.md mục 5.
 *
 * Command schema:
 * { type: 'add'|'remove', cell: Cell, affectedSnapshots: CellSnapshot[] }
 *
 * Public API:
 *   UndoRedoStack.push(command)
 *   UndoRedoStack.undo() → Command | null
 *   UndoRedoStack.redo() → Command | null
 *   UndoRedoStack.canUndo() → boolean
 *   UndoRedoStack.canRedo() → boolean
 *   UndoRedoStack.clear()
 */

const MAX_STEPS = 50  // theo CONVENTIONS.md mục 9

// Internal circular buffer
const _history = []       // array of commands
let _cursor = -1          // trỏ đến command hiện tại (đã undo đến)

const UndoRedoStack = {
  /**
   * Push command vào stack sau khi thực hiện action.
   * Xóa tất cả redo history (commands sau cursor).
   * @param {{ type: string, cell: object, affectedSnapshots: object[] }} command
   */
  push(command) {
    // Xóa redo branch khi có action mới
    if (_cursor < _history.length - 1) {
      _history.splice(_cursor + 1)
    }

    _history.push(command)
    _cursor = _history.length - 1

    // Giới hạn MAX_STEPS — xóa phần cũ nhất
    if (_history.length > MAX_STEPS) {
      _history.shift()
      _cursor = _history.length - 1
    }
  },

  /**
   * Lấy command để undo (không thực hiện undo — caller phải tự xử lý).
   * Di chuyển cursor về trước.
   * @returns {{ type, cell, affectedSnapshots } | null}
   */
  undo() {
    if (!UndoRedoStack.canUndo()) return null
    const command = _history[_cursor]
    _cursor--
    return command
  },

  /**
   * Lấy command để redo.
   * @returns {{ type, cell, affectedSnapshots } | null}
   */
  redo() {
    if (!UndoRedoStack.canRedo()) return null
    _cursor++
    return _history[_cursor]
  },

  canUndo: () => _cursor >= 0,

  canRedo: () => _cursor < _history.length - 1,

  /** Xóa toàn bộ history (dùng khi load world mới) */
  clear() {
    _history.length = 0
    _cursor = -1
  },

  /** Debug — số commands trong history */
  getSize: () => _history.length,

  /** Debug — cursor position */
  getCursor: () => _cursor,
}

export { UndoRedoStack }
