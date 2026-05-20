/**
 * main.js — Electron Main Process Entry Point
 *
 * Luồng khởi động:
 * 1. app.whenReady() → createMainWindow()
 * 2. Đăng ký tất cả IPC handlers
 * 3. app.on('activate') → tạo lại window nếu dock click (macOS)
 */

const { app, ipcMain, BrowserWindow } = require('electron')
const path = require('path')
const { createMainWindow }      = require('./window/createMainWindow')
const { registerSaveHandler }   = require('./ipc/saveWorld')
const { registerLoadHandler }   = require('./ipc/loadWorld')
const { registerAutosaveHandler } = require('./ipc/autosave')
const { registerSettingsHandler } = require('./ipc/settings')

let mainWindow = null

// Khởi động app khi Electron sẵn sàng
app.whenReady().then(async () => {
  mainWindow = createMainWindow()

  // Đăng ký tất cả IPC handlers — phải làm sau khi window tồn tại
  registerIpcHandlers()

  // macOS: recreate window khi click dock icon và không còn window nào
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createMainWindow()
    }
  })
})

// Đóng app khi tất cả windows đã đóng (trừ macOS)
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

/**
 * Đăng ký tất cả IPC handlers tập trung tại đây.
 * Lý do: dễ audit, dễ thêm/bớt, tránh đăng ký phân tán khắp nơi.
 */
function registerIpcHandlers() {
  // Ping/pong — test IPC round-trip (Phase 0)
  ipcMain.handle('ping', (event) => {
    if (!isValidSender(event)) return null
    return 'pong'
  })

  // Save/Load world — dialog + fs
  registerSaveHandler(ipcMain, () => mainWindow)
  registerLoadHandler(ipcMain, () => mainWindow)

  // Autosave — silent write to userData (P6-03)
  registerAutosaveHandler(ipcMain, () => mainWindow)

  // Settings persistence — userData/settings.json (P6-07)
  registerSettingsHandler(ipcMain)

  // App version
  ipcMain.handle('app:getVersion', (event) => {
    if (!isValidSender(event)) return null
    return app.getVersion()
  })
}

/**
 * Validate rằng IPC event đến từ main window của app.
 * Bảo vệ chống trường hợp renderer phụ hoặc injected content gọi IPC.
 *
 * @param {Electron.IpcMainInvokeEvent} event
 * @returns {boolean}
 */
function isValidSender(event) {
  if (!mainWindow) return false
  return event.sender === mainWindow.webContents
}
