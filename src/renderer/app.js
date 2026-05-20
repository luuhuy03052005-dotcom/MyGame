/**
 * app.js — Renderer Entry Point (Phase 0–6)
 * Thứ tự khởi động theo ARCHITECTURE.md mục 6:
 * 1.  SceneManager.init()
 * 2.  CameraController.init()
 * 3.  RenderLoop.init()
 * 4.  WaterPlane.init()
 * 5.  GhostCube.init()
 * 6.  AssetManager.preload()
 * 7.  BuildController.init()
 * 8.  InputHandler.init()
 * 9.  WorldSerializer (no init needed — pure functions)
 * 10. ColorPalette.init()
 * 11. Toolbar.init()
 * 12. setupGameEvents()
 * 13. RenderLoop.start()
 */

import * as THREE from 'three'
// Engine
import { SceneManager }     from './engine/SceneManager.js'
import { CameraController } from './engine/CameraController.js'
import { RenderLoop }       from './engine/RenderLoop.js'
import { GhostCube }        from './engine/GhostCube.js'
import { ParticleSystem }   from './engine/ParticleSystem.js'
import { InputHandler }     from './engine/InputHandler.js'
import { AudioSystem }      from './engine/AudioSystem.js'
// World (Phase E — Nugget8 Ocean/Skybox)
import { CoastletEnvironmentManager } from './world/CoastletEnvironmentManager.js'
// Game
import { GridManager }          from './game/GridManager.js'
import { ProceduralRuleEngine } from './game/ProceduralRuleEngine.js'
import { BuildController }      from './game/BuildController.js'
import { UndoRedoStack }        from './game/UndoRedoStack.js'
import { WorldSerializer }      from './game/WorldSerializer.js'
// Assets
import { AssetManager }    from './assets/AssetManager.js'
import { VALID_ASSET_TYPES } from './assets/AssetRegistry.js'
// UI
import { ColorPalette } from './ui/ColorPalette.js'
import { Toolbar }      from './ui/Toolbar.js'

console.log('[app.js] All imports done')

// ===== Loading Screen =====
const loadingScreen  = document.getElementById('loading-screen')
const loadingBarFill = document.getElementById('loading-bar-fill')
const loadingStatus  = document.getElementById('loading-status')

function setLoadingProgress(percent, message) {
  loadingBarFill.style.width = `${percent}%`
  loadingStatus.textContent  = message
}
function hideLoadingScreen() {
  loadingScreen.classList.add('hidden')
  setTimeout(() => loadingScreen.remove(), 600)
}

// ===== Bootstrap =====
async function bootstrap() {
  setLoadingProgress(5,  'Initializing scene...')
  const canvas = document.getElementById('canvas')
  SceneManager.init(canvas)

  setLoadingProgress(15, 'Camera & controls...')
  CameraController.init(SceneManager.getCamera(), canvas)

  setLoadingProgress(25, 'Starting render loop...')
  RenderLoop.init(SceneManager, CameraController)

  setLoadingProgress(30, 'Building ocean & sky...')
  CoastletEnvironmentManager.init({
    scene: SceneManager.getScene(),
    renderer: SceneManager.getRenderer(),
    camera: SceneManager.getCamera(),
    sceneManager: SceneManager,
    seaLevel: -0.03,
  })
  RenderLoop.onTick((delta) => CoastletEnvironmentManager.update(delta))

  setLoadingProgress(40, 'Waiting for ocean textures...')
  await CoastletEnvironmentManager.waitForReady()

  const buildPlane = CoastletEnvironmentManager.getBuildPlane()

  setLoadingProgress(50, 'Hover preview...')
  GhostCube.init(SceneManager.getScene())
  
  setLoadingProgress(55, 'Particle System...')
  ParticleSystem.init(SceneManager.getScene())
  RenderLoop.onTick((delta) => ParticleSystem.update(delta))

  setLoadingProgress(60, 'Loading assets...')
  await AssetManager.preload(VALID_ASSET_TYPES)

  setLoadingProgress(75, 'Setting up game logic...')
  BuildController.init(
    SceneManager.getScene(),
    GridManager,
    ProceduralRuleEngine,
    AssetManager,
    UndoRedoStack
  )

  // Raycaster — update buildable objects sau mỗi build/delete
  InputHandler.init(canvas, SceneManager.getCamera())
  const refreshBuildables = () => InputHandler.setBuildableObjects([
    buildPlane,  // Invisible build plane - this is the raycast target
    ...BuildController.getBuildableObjects(),
  ])
  refreshBuildables()
  window.addEventListener('build:click',      () => setTimeout(refreshBuildables, 0))
  window.addEventListener('build:rightclick', () => setTimeout(refreshBuildables, 0))

  setLoadingProgress(85, 'Building UI...')
  const uiRoot = document.getElementById('ui-root')
  ColorPalette.init(uiRoot)
  Toolbar.init(uiRoot)

  setLoadingProgress(95, 'Connecting IPC...')
  if (window.electronAPI) {
    try {
      const pong = await window.electronAPI.ping()
      console.log('[app.js] IPC:', pong)
    } catch (e) {
      console.error('[app.js] IPC error:', e)
    }
  } else {
    console.warn('[app.js] Browser mode — no Electron IPC')
  }

  setupGameEvents()

  // Load Settings & Check Autosave sau bootstrap
  await _initializeSettingsAndAutosave()

  setLoadingProgress(100, 'Ready!')
  await new Promise(r => setTimeout(r, 300))
  hideLoadingScreen()

  RenderLoop.start()
  console.log('[app.js] Full bootstrap complete ✅')
}

// ===== Game Event Bus =====
let _currentWorldMeta = null  // re-use worldId khi save lại
let _actionCount = 0          // Đếm số actions cho incremental autosave (P6-03)
let _autosaveTimer = null
let _settings = {
  sound: true,
  music: true,
  masterVolume: 0.6,
  graphicsQuality: 'high',
  autosave: true,
  autosaveIntervalMs: 300000,
}

function _incrementActionAndCheckAutosave() {
  _actionCount++
  if (_settings.autosave && _actionCount >= 20) {
    _actionCount = 0
    _doSilentAutosave()
  }
}

function setupGameEvents() {
  // Keyboard
  window.addEventListener('ui:keydown', (e) => {
    const { key, ctrl, shift } = e.detail
    if (key === 'f' || key === 'F') CameraController.resetToDefault()
    if (key === 'F12') _doScreenshot()
    if (ctrl && key === 'z') _doUndo()
    if (ctrl && (key === 'y' || (shift && key === 'Z'))) _doRedo()
    if (ctrl && key === 's') _doSave()
    if (ctrl && key === 'o') _doLoad()
  })

  // Color palette → BuildController
  window.addEventListener('palette:colorchange', (e) => {
    BuildController.setActiveColor(e.detail.color)
  })

  // Undo/Redo state → Toolbar buttons
  const syncUndoRedo = () => {
    Toolbar.setUndoEnabled(UndoRedoStack.canUndo())
    Toolbar.setRedoEnabled(UndoRedoStack.canRedo())
  }
  window.addEventListener('build:click',      () => { syncUndoRedo(); _incrementActionAndCheckAutosave(); })
  window.addEventListener('build:rightclick', () => { syncUndoRedo(); _incrementActionAndCheckAutosave(); })

  // Toolbar buttons → actions
  window.addEventListener('toolbar:save',          _doSave)
  window.addEventListener('toolbar:load',          _doLoad)
  window.addEventListener('toolbar:undo',          _doUndo)
  window.addEventListener('toolbar:redo',          _doRedo)
  window.addEventListener('toolbar:resetcamera',   () => CameraController.resetToDefault())
  window.addEventListener('toolbar:newworld',      () => _doNewWorld(true))
  window.addEventListener('toolbar:screenshot',    _doScreenshot)
  // toolbar:togglepalette — handled trực tiếp bởi ColorPalette._setupKeyboard
  // toolbar:togglegrid — Phase 5 post: toggle grid helper mesh
  window.addEventListener('toolbar:togglegrid',    _doToggleGrid)
}

// Grid helper toggle
let _gridHelper = null
async function _doToggleGrid() {
  const scene = SceneManager.getScene()
  if (_gridHelper) {
    scene.remove(_gridHelper)
    _gridHelper.material.dispose()
    _gridHelper.geometry.dispose()
    _gridHelper = null
  } else {
    const { GridHelper } = await import('three')
    _gridHelper = new GridHelper(24, 24, 0x90A8C0, 0xB8D4E8)
    _gridHelper.material.opacity = 0.35
    _gridHelper.material.transparent = true
    _gridHelper.position.y = 0.01  // hơi trên mặt nước để không z-fight
    scene.add(_gridHelper)
  }
}

// ===== Initializer cho Settings & Autosave =====
async function _initializeSettingsAndAutosave() {
  if (!window.electronAPI) return

  // 1. Load settings (P6-07)
  try {
    const res = await window.electronAPI.settings.load()
    if (res && res.settings) {
      _settings = res.settings
      console.log('[app.js] User settings loaded:', _settings)
    }
  } catch (err) {
    console.error('[app.js] Settings load error:', err)
  }

  // Khởi tạo AudioSystem bằng cấu hình âm lượng/âm thanh
  AudioSystem.init(_settings)

  // 2. Setup periodic autosave timer (5 mins)
  if (_settings.autosave) {
    _autosaveTimer = setInterval(_doSilentAutosave, _settings.autosaveIntervalMs)
  }

  // 3. Check autosave existence at startup (P6-03)
  try {
    const autoRes = await window.electronAPI.autosave.read()
    if (autoRes && autoRes.exists && autoRes.data) {
      // Prompt user to restore
      const restore = window.confirm(
        'An autosave from your previous session was found. Would you like to restore it?'
      )
      if (restore) {
        const success = _loadWorldFromJson(autoRes.data)
        if (success) {
          Toolbar.showToast('Session restored successfully! 🗺️', 'success')
        }
      } else {
        // Clear autosave so we don't prompt again
        await window.electronAPI.autosave.clear()
        console.log('[app.js] Autosave cleared by user rejection')
      }
    }
  } catch (err) {
    console.error('[app.js] Autosave restore prompt error:', err)
  }
}

// ===== Actions =====

function _doUndo() {
  BuildController.undo()
  Toolbar.setUndoEnabled(UndoRedoStack.canUndo())
  Toolbar.setRedoEnabled(UndoRedoStack.canRedo())
  _incrementActionAndCheckAutosave()
}

function _doRedo() {
  BuildController.redo()
  Toolbar.setUndoEnabled(UndoRedoStack.canUndo())
  Toolbar.setRedoEnabled(UndoRedoStack.canRedo())
  _incrementActionAndCheckAutosave()
}

async function _doSave() {
  if (!window.electronAPI) {
    Toolbar.showToast('Save requires Electron desktop app', 'error')
    return
  }
  try {
    const json = WorldSerializer.serialize(
      GridManager,
      { azimuth: 0.785, elevation: 0.611, distance: 15, target: [0, 0, 0] },
      { activeColor: ColorPalette.getActiveColor(), colors: [] },
      _currentWorldMeta ?? {}
    )
    const result = await window.electronAPI.saveWorld(json)
    if (result.success) {
      const parsed = JSON.parse(json)
      _currentWorldMeta = { worldId: parsed.meta.worldId, createdAt: parsed.meta.createdAt }
      Toolbar.showToast('World saved! 💾', 'success')
      // Xóa autosave khi đã lưu thủ công thành công
      await window.electronAPI.autosave.clear()
    } else if (result.error) {
      Toolbar.showToast('Save failed: ' + result.error, 'error')
    }
  } catch (err) {
    Toolbar.showToast('Save error: ' + err.message, 'error')
    console.error('[app.js] Save error:', err)
  }
}

async function _doLoad() {
  if (!window.electronAPI) {
    Toolbar.showToast('Load requires Electron desktop app', 'error')
    return
  }
  try {
    const result = await window.electronAPI.loadWorld()
    if (!result.success) return

    const success = _loadWorldFromJson(result.data)
    if (success) {
      Toolbar.showToast('World loaded! 🗺️', 'success')
      // Xóa autosave khi load file mới thành công
      await window.electronAPI.autosave.clear()
    }
  } catch (err) {
    Toolbar.showToast('Load error: ' + err.message, 'error')
    console.error('[app.js] Load error:', err)
  }
}

/**
 * Shared JSON loading logic.
 * @param {string} jsonString
 * @returns {boolean} success
 */
function _loadWorldFromJson(jsonString) {
  try {
    const { valid, data, errors } = WorldSerializer.deserialize(jsonString)
    if (!valid) {
      Toolbar.showToast('Invalid file: ' + errors[0], 'error')
      return false
    }

    _doNewWorld(false)

    if (data.palette?.activeColor) {
      ColorPalette.setActiveColor(data.palette.activeColor)
    }

    // Rebuild cells từ save data
    for (const cellData of data.cells) {
      const cell = GridManager.addCell(cellData.x, cellData.y, cellData.z, cellData.color)
      cell.assetType = cellData.assetType
      cell.rotation  = cellData.rotation
    }

    // Re-resolve và spawn tất cả
    ProceduralRuleEngine.resolveAll(GridManager, (cell) => {
      if (!cell.mesh) {
        const mesh = AssetManager.get(cell.assetType)
        _applyColorToMesh(mesh, cell.color)
        mesh.position.set(cell.x, cell.y + 0.5, cell.z)
        mesh.rotation.y = cell.rotation
        mesh.userData = { cellId: cell.id, isBuilding: true }
        mesh.name = 'building'
        SceneManager.getScene().add(mesh)
        cell.mesh = mesh
      }
    })

    _currentWorldMeta = { worldId: data.meta.worldId, createdAt: data.meta.createdAt }
    UndoRedoStack.clear()
    Toolbar.setUndoEnabled(false)
    Toolbar.setRedoEnabled(false)
    return true
  } catch (err) {
    console.error('[app.js] Error parsing world JSON:', err)
    return false
  }
}

/**
 * Silent Autosave (P6-03)
 */
async function _doSilentAutosave() {
  if (!window.electronAPI || GridManager.getAllCells().length === 0) return
  try {
    const json = WorldSerializer.serialize(
      GridManager,
      { azimuth: 0.785, elevation: 0.611, distance: 15, target: [0, 0, 0] },
      { activeColor: ColorPalette.getActiveColor(), colors: [] },
      _currentWorldMeta ?? {}
    )
    const res = await window.electronAPI.autosave.write(json)
    if (res.success) {
      console.log('[Autosave] World autosaved silently')
    }
  } catch (err) {
    console.warn('[Autosave] Silent autosave failed:', err)
  }
}

/**
 * Screenshot Export (P6-04)
 */
async function _doScreenshot() {
  if (!window.electronAPI) {
    Toolbar.showToast('Screenshot requires Electron desktop app', 'error')
    return
  }
  try {
    // 1. Vẽ frame mới lên canvas trước khi chụp
    SceneManager.render()

    // 2. Lấy data URL
    const canvas = SceneManager.getRenderer().domElement
    const dataURL = canvas.toDataURL('image/png')

    // 3. Gọi IPC để lưu file
    const res = await window.electronAPI.saveScreenshot(dataURL)
    if (res.success) {
      Toolbar.showToast('Screenshot saved successfully! 📷', 'success')
    }
  } catch (err) {
    Toolbar.showToast('Screenshot failed: ' + err.message, 'error')
    console.error('[app.js] Screenshot error:', err)
  }
}

function _doNewWorld(showToast) {
  GridManager.getAllCells().forEach(cell => {
    if (cell.mesh) SceneManager.getScene().remove(cell.mesh)
  })
  GridManager.clear()
  UndoRedoStack.clear()
  _currentWorldMeta = null
  Toolbar.setUndoEnabled(false)
  Toolbar.setRedoEnabled(false)
  if (showToast) Toolbar.showToast('New world created 🗺️', 'info')
}

// Helper dùng trong load flow
function _applyColorToMesh(obj, hexColor) {
  const color = new THREE.Color(hexColor)
  obj.traverse((child) => {
    if (child.isMesh && child.userData.isColorable) {
      child.material = child.material.clone()
      child.material.color = color
    }
  })
}

// ===== Run =====
bootstrap().catch(err => {
  console.error('[app.js] Bootstrap failed:', err)
  if (loadingStatus) {
    loadingStatus.textContent = 'Error: ' + err.message
    loadingStatus.style.color = '#ff6b6b'
  }
})
