/**
 * createMainWindow.js — Factory tạo BrowserWindow chính
 *
 * Security hardening theo AGENTS.md mục 3.1 và P0-06:
 * - nodeIntegration: false
 * - contextIsolation: true
 * - sandbox: true
 * - webSecurity: true
 * - CSP header
 * - Navigation lock
 * - window.open block
 */

const { BrowserWindow, session } = require('electron')
const path = require('path')

// Dev nếu chưa package; prod nếu đã package
// app.isPackaged là cách chính thống của Electron để detect
const { app } = require('electron')

/**
 * Tạo và cấu hình BrowserWindow chính.
 * @returns {BrowserWindow}
 */
function createMainWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 720,
    minWidth: 960,
    minHeight: 600,
    title: 'Coastlet Builder',
    backgroundColor: '#1a1a2e',  // màu tối trong khi load
    show: false,                 // ẩn cho đến khi ready-to-show để tránh flash trắng
    webPreferences: {
      // Security — AGENTS.md mục 3.1 — BẮT BUỘC, KHÔNG thay đổi
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
      preload: path.join(__dirname, '../../preload/preload.js'),
    },
  })

  // Hiện window khi đã render xong — tránh flash trắng
  win.once('ready-to-show', () => {
    win.show()
  })

  // Dev: load Vite dev server
  // Prod: load file tĩnh từ Vite build output
  // Lý do dùng loadFile() thay vì loadURL('file://...'):
  // loadFile() xử lý path separator và encoding an toàn hơn trên mọi OS
  const isDev = !app.isPackaged
  if (isDev) {
    win.loadURL('http://localhost:5173')
    // Mở DevTools tự động trong dev mode
    win.webContents.openDevTools({ mode: 'detach' })
  } else {
    win.loadFile(path.join(__dirname, '../../../dist/renderer/index.html'))
  }

  // === Security: CSP Header ===
  // Thêm CSP vào mọi response — ngay cả khi Vite đã serve
  // Lý do: đây là lớp bảo vệ phía app, không phụ thuộc vào server config
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          "default-src 'self'; " +
          "script-src 'self'; " +
          "style-src 'self' 'unsafe-inline'; " +
          "img-src 'self' data: blob:; " +
          "connect-src 'self' ws://localhost:5173"  // Vite HMR WebSocket
        ],
      },
    })
  })

  // === Security: Block navigation ngoài app ===
  // Ngăn XSS navigation ra ngoài hoặc phishing redirect
  win.webContents.on('will-navigate', (event, url) => {
    const isDev = !app.isPackaged
    const allowedOrigins = isDev
      ? ['http://localhost:5173']
      : ['file://']

    const isAllowed = allowedOrigins.some(origin => url.startsWith(origin))
    if (!isAllowed) {
      console.warn(`[Security] Blocked navigation to: ${url}`)
      event.preventDefault()
    }
  })

  // === Security: Block window.open() ===
  // Ngăn renderer mở cửa sổ mới tùy tiện
  win.webContents.setWindowOpenHandler(({ url }) => {
    console.warn(`[Security] Blocked window.open: ${url}`)
    return { action: 'deny' }
  })

  return win
}

module.exports = { createMainWindow }
