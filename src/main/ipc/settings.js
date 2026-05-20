/**
 * settings.js — IPC Handler cho user settings
 *
 * Theo TASKS.md P6-07.
 * Lưu vào: app.getPath('userData') + '/settings.json'
 *
 * Schema mặc định:
 * {
 *   sound: true,
 *   music: true,
 *   masterVolume: 0.6,
 *   graphicsQuality: 'high',
 *   autosave: true,
 *   autosaveIntervalMs: 300000,
 * }
 *
 * Handlers:
 *   'settings:load' → { settings: object }
 *   'settings:save' (settings: object) → { success: boolean }
 */

const { app } = require('electron')
const fs = require('fs').promises
const path = require('path')

const SETTINGS_DEFAULTS = {
  sound: true,
  music: true,
  masterVolume: 0.6,
  graphicsQuality: 'high',  // 'low' | 'medium' | 'high'
  autosave: true,
  autosaveIntervalMs: 300000,  // 5 phút
}

function getSettingsPath() {
  return path.join(app.getPath('userData'), 'settings.json')
}

function registerSettingsHandler(ipcMain) {
  // Load settings — merge với defaults để handle missing keys
  ipcMain.handle('settings:load', async () => {
    try {
      const raw = await fs.readFile(getSettingsPath(), 'utf-8')
      const saved = JSON.parse(raw)
      // Merge: defaults làm base, saved override
      return { settings: { ...SETTINGS_DEFAULTS, ...saved } }
    } catch {
      // File không tồn tại hoặc invalid → trả về defaults
      return { settings: { ...SETTINGS_DEFAULTS } }
    }
  })

  // Save settings
  ipcMain.handle('settings:save', async (event, { settings }) => {
    try {
      // Chỉ lưu keys hợp lệ (whitelist)
      const toSave = {}
      for (const key of Object.keys(SETTINGS_DEFAULTS)) {
        if (key in settings) toSave[key] = settings[key]
      }
      await fs.writeFile(getSettingsPath(), JSON.stringify(toSave, null, 2), 'utf-8')
      return { success: true }
    } catch (err) {
      console.error('[settings] Save error:', err.message)
      return { success: false, error: err.message }
    }
  })
}

module.exports = { registerSettingsHandler, SETTINGS_DEFAULTS }
