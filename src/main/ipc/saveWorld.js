/**
 * saveWorld.js — IPC Handler cho save world
 *
 * Mở native save dialog → ghi file JSON → trả về kết quả.
 * Tất cả file I/O nằm ở main process — renderer không bao giờ
 * access fs trực tiếp.
 */

const { dialog } = require('electron')
const fs = require('fs').promises

/**
 * Đăng ký handler 'save-world' vào ipcMain.
 * @param {Electron.IpcMain} ipcMain
 * @param {() => BrowserWindow} getWindow - getter để tránh circular dep
 */
function registerSaveHandler(ipcMain, getWindow) {
  ipcMain.handle('save-world', async (event, { data, defaultPath }) => {
    const win = getWindow()
    if (!win) return { success: false, error: 'No window' }

    try {
      const result = await dialog.showSaveDialog(win, {
        defaultPath: defaultPath || 'my-town.json',
        filters: [
          { name: 'Coastlet Save', extensions: ['json'] },
          { name: 'All Files', extensions: ['*'] },
        ],
      })

      if (result.canceled || !result.filePath) {
        return { success: false }
      }

      await fs.writeFile(result.filePath, data, 'utf-8')
      console.log(`[saveWorld] Saved to: ${result.filePath}`)
      return { success: true, path: result.filePath }
    } catch (err) {
      console.error(`[saveWorld] Error: ${err.message}`)
      return { success: false, error: err.message }
    }
  })

  // Screenshot handler — save PNG
  ipcMain.handle('save-screenshot', async (event, { dataURL }) => {
    const win = getWindow()
    if (!win) return { success: false }

    try {
      const result = await dialog.showSaveDialog(win, {
        defaultPath: `coastlet-${Date.now()}.png`,
        filters: [{ name: 'PNG Image', extensions: ['png'] }],
      })

      if (result.canceled || !result.filePath) return { success: false }

      // dataURL = 'data:image/png;base64,...'
      const base64 = dataURL.replace(/^data:image\/png;base64,/, '')
      await fs.writeFile(result.filePath, Buffer.from(base64, 'base64'))
      return { success: true, path: result.filePath }
    } catch (err) {
      console.error(`[saveScreenshot] Error: ${err.message}`)
      return { success: false, error: err.message }
    }
  })
}

module.exports = { registerSaveHandler }
