/**
 * autosave.js — IPC Handler cho autosave
 *
 * Autosave tự ghi vào userData path, không dùng dialog.
 * Theo TASKS.md P6-03:
 *   - Ghi vào: app.getPath('userData') + '/autosave.json'
 *   - Khi mở app: check autosave tồn tại → emit event
 *     để renderer hỏi user có muốn restore không
 *
 * Handlers:
 *   'autosave:write' (data: string) → { success: boolean }
 *   'autosave:read'                 → { exists: boolean, data?: string }
 *   'autosave:clear'                → { success: boolean }
 */

const { app } = require('electron')
const fs = require('fs').promises
const path = require('path')

function getAutosavePath() {
  return path.join(app.getPath('userData'), 'autosave.json')
}

function registerAutosaveHandler(ipcMain, getWindow) {
  // Write autosave
  ipcMain.handle('autosave:write', async (event, { data }) => {
    try {
      await fs.writeFile(getAutosavePath(), data, 'utf-8')
      return { success: true }
    } catch (err) {
      console.error('[autosave] Write error:', err.message)
      return { success: false, error: err.message }
    }
  })

  // Read autosave (khi khởi động renderer)
  ipcMain.handle('autosave:read', async () => {
    try {
      const filePath = getAutosavePath()
      await fs.access(filePath)  // throws nếu không tồn tại
      const data = await fs.readFile(filePath, 'utf-8')
      return { exists: true, data }
    } catch {
      return { exists: false }
    }
  })

  // Clear autosave (sau khi user load hoặc new world)
  ipcMain.handle('autosave:clear', async () => {
    try {
      await fs.unlink(getAutosavePath())
      return { success: true }
    } catch {
      return { success: true }  // không có file → cũng ok
    }
  })
}

module.exports = { registerAutosaveHandler }
