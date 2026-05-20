/**
 * preload.js — Context Bridge
 *
 * Quy tắc bắt buộc (AGENTS.md 3.1 + CONVENTIONS.md):
 * - KHÔNG expose raw `ipcRenderer` ra renderer
 * - KHÔNG expose Node APIs (fs, path, require...)
 * - Chỉ expose API business-level có tên rõ ràng
 * - Mọi payload đi qua IPC phải là JSON-serializable
 *
 * Renderer dùng: window.electronAPI.methodName()
 */

const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  /** Ping/pong test IPC */
  ping: () => ipcRenderer.invoke('ping'),

  /** Lưu world ra file — mở save dialog */
  saveWorld: (jsonData, defaultPath) =>
    ipcRenderer.invoke('save-world', { data: jsonData, defaultPath }),

  /** Tải world từ file — mở open dialog */
  loadWorld: () => ipcRenderer.invoke('load-world'),

  /** Screenshot PNG — mở save dialog */
  saveScreenshot: (dataURL) =>
    ipcRenderer.invoke('save-screenshot', { dataURL }),

  /** Autosave (P6-03) — không dùng dialog */
  autosave: {
    write: (jsonData) => ipcRenderer.invoke('autosave:write', { data: jsonData }),
    read:  ()         => ipcRenderer.invoke('autosave:read'),
    clear: ()         => ipcRenderer.invoke('autosave:clear'),
  },

  /** Settings (P6-07) */
  settings: {
    load: ()           => ipcRenderer.invoke('settings:load'),
    save: (settings)   => ipcRenderer.invoke('settings:save', { settings }),
  },

  /** App version */
  getAppVersion: () => ipcRenderer.invoke('app:getVersion'),
})
