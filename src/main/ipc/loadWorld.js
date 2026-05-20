/**
 * loadWorld.js — IPC Handler cho load world
 *
 * Mở native open dialog → đọc file JSON → trả về content.
 * Tất cả file I/O nằm ở main process.
 */

const { dialog } = require('electron')
const fs = require('fs').promises

/**
 * Đăng ký handler 'load-world' vào ipcMain.
 * @param {Electron.IpcMain} ipcMain
 * @param {() => BrowserWindow} getWindow
 */
function registerLoadHandler(ipcMain, getWindow) {
  ipcMain.handle('load-world', async (event) => {
    const win = getWindow()
    if (!win) return { success: false, error: 'No window' }

    try {
      const result = await dialog.showOpenDialog(win, {
        filters: [
          { name: 'Coastlet Save', extensions: ['json'] },
          { name: 'All Files', extensions: ['*'] },
        ],
        properties: ['openFile'],
      })

      if (result.canceled || result.filePaths.length === 0) {
        return { success: false }
      }

      const filePath = result.filePaths[0]
      const data = await fs.readFile(filePath, 'utf-8')
      console.log(`[loadWorld] Loaded from: ${filePath}`)
      return { success: true, data, path: filePath }
    } catch (err) {
      console.error(`[loadWorld] Error: ${err.message}`)
      return { success: false, error: err.message }
    }
  })
}

module.exports = { registerLoadHandler }
