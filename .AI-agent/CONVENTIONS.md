# CONVENTIONS.md — Coastlet Builder
## Quy ước code bắt buộc

> Agent phải đọc file này trước khi viết bất kỳ dòng code nào.  
> Mọi vi phạm convention đều được coi là bug cần fix ngay.

---

## 1. Ngôn ngữ & Module System

```js
// ✅ Đúng — ES Module syntax
import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { SceneManager } from './engine/SceneManager.js'

// ❌ Sai — CommonJS
const THREE = require('three')
module.exports = { SceneManager }
```

- **Chỉ dùng ES Modules** (`import`/`export`). Không dùng `require()`.
- **Không dùng React, Vue, Angular.** UI là vanilla JS DOM.
- **Không dùng jQuery.**
- **Không dùng TypeScript** trong source chính — nhưng JSDoc type annotation được khuyến khích.

---

## 2. Quy ước đặt tên

### File & Module
| Loại | Convention | Ví dụ |
|------|-----------|-------|
| Module JS | PascalCase | `SceneManager.js`, `GridManager.js` |
| Test file | camelCase + `.test.js` | `grid.test.js`, `procedural.test.js` |
| Entry point | lowercase | `app.js`, `main.js`, `preload.js` |
| HTML | lowercase | `index.html` |

### Class & Singleton
```js
// ✅ Module-singleton (export object, không phải class instance)
// Mọi module trong engine/ và game/ đều là singleton object

const SceneManager = {
  init(canvasElement) { ... },
  getScene() { ... },
}

export { SceneManager }

// ✅ Data class dùng class syntax
export class Cell {
  constructor(x, y, z, color) { ... }
}

// ❌ Sai — export class rồi new ở nơi khác với singleton
export class SceneManager { ... }  // singleton thì không làm thế này
```

### Variables & Functions
```js
// Variables: camelCase
const cellSize = 1
const buildableObjects = []
let activeColor = '#FFFFFF'

// Constants (module-level): SCREAMING_SNAKE_CASE
const CELL_SIZE = 1
const CELL_HEIGHT = 1
const SAVE_VERSION = '1.0.0'
const MAX_UNDO_STEPS = 50

// Functions: camelCase động từ + danh từ
function addCell(x, y, z, color) { ... }
function getNeighbors(x, y, z) { ... }
function resolveAssetType(cell, neighbors) { ... }

// Private (không export): tiền tố _
function _snapToGrid(worldPos) { ... }
function _detectBridges(gridManager) { ... }
```

### Events
```js
// Custom event: namespace:action — lowercase, dấu hai chấm
'build:click'
'build:hover'
'build:rightclick'
'ui:keydown'
'palette:colorchange'
'assetmanager:progress'
'assetmanager:ready'
'world:saved'
'world:loaded'
```

---

## 3. Comment bắt buộc

### Module header
Mọi file module phải có header comment:
```js
/**
 * SceneManager.js
 * Quản lý THREE.Scene và WebGLRenderer.
 * Là singleton — không khởi tạo bằng new.
 *
 * Public API:
 *   SceneManager.init(canvas)
 *   SceneManager.getScene()
 *   SceneManager.getRenderer()
 *   SceneManager.render(camera)
 */
```

### Quyết định kỹ thuật quan trọng phải có comment "tại sao"
```js
// ✅ Đúng — giải thích lý do
// Chỉ raycast vào buildableObjects, không cast vào toàn scene.
// Lý do: cast vào toàn scene sẽ bắt cả water plane và ghost cube,
// gây ra sai vị trí build. Performance cũng tốt hơn khi set nhỏ hơn.
raycaster.intersectObjects(BuildController.getBuildableObjects())

// ❌ Sai — comment dư thừa (mô tả cái code đã nói)
// Raycast vào buildable objects
raycaster.intersectObjects(BuildController.getBuildableObjects())
```

### Không để lại `TODO` chưa giải quyết
```js
// ❌ Không được merge nếu còn TODO này
// TODO: add bridge detection
```

---

## 4. Error Handling

### Pattern bắt buộc — fail gracefully
```js
// ✅ Asset fallback
try {
  const asset = AssetManager.get(cell.assetType)
  scene.add(asset)
} catch (err) {
  console.warn(`[BuildController] Asset fallback: ${err.message}`)
  const fallback = AssetManager.get('_fallback')
  scene.add(fallback)
}

// ✅ Validate trước khi dùng
const result = WorldSerializer.validate(data)
if (!result.valid) {
  // Báo lỗi rõ ràng — không load mù
  console.error(`[WorldSerializer] Invalid save: ${result.errors.join(', ')}`)
  return
}

// ❌ Swallow error — cấm
try { ... } catch (e) {}

// ❌ Crash không có fallback
cell.mesh = assetCache[assetType]   // undefined nếu key sai
```

### Prefix log theo module
```js
console.log('[GridManager] Cell added:', cellId)
console.warn('[AssetManager] Fallback used for:', assetType)
console.error('[WorldSerializer] Validation failed:', errors)
```

---

## 5. Three.js Conventions

### Import
```js
// ✅ Đúng
import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'

// ❌ Sai — import trực tiếp default
import THREE from 'three'
```

### Dispose bắt buộc khi xóa mesh
```js
// Mọi chỗ remove mesh khỏi scene PHẢI dispose
function removeMesh(cell) {
  if (!cell.mesh) return
  cell.mesh.geometry.dispose()
  if (Array.isArray(cell.mesh.material)) {
    cell.mesh.material.forEach(m => m.dispose())
  } else {
    cell.mesh.material.dispose()
  }
  scene.remove(cell.mesh)
  cell.mesh = null   // xóa reference để GC thu hồi
}
```

### Naming convention cho Three.js objects
```js
// Object có name để filter trong raycaster/scene
waterPlane.name = 'waterPlane'     // dùng để loại khỏi raycast
ghostCube.name = 'ghostCube'       // hover preview
buildableGroup.name = 'buildable'  // raycast target

// userData để lưu metadata game-level
mesh.userData = { cellId: cell.id, isBuilding: true }
```

---

## 6. IPC (Electron)

```js
// ✅ Đúng — trong preload.js
contextBridge.exposeInMainWorld('electronAPI', {
  ping: () => ipcRenderer.invoke('ping'),
  saveWorld: (data, path) => ipcRenderer.invoke('save-world', { data, path }),
  loadWorld: () => ipcRenderer.invoke('load-world'),
  saveScreenshot: (dataURL) => ipcRenderer.invoke('save-screenshot', { dataURL }),
})

// ✅ Đúng — trong renderer
const result = await window.electronAPI.saveWorld(jsonString)

// ❌ Sai — renderer không được làm thế này
const { ipcRenderer } = require('electron')
ipcRenderer.invoke('save-world', data)
```

---

## 7. Custom Event Pattern

```js
// Emit (InputHandler, ColorPalette, etc.)
window.dispatchEvent(new CustomEvent('build:click', {
  detail: { worldPos, gridPos }
}))

// Listen (BuildController, etc.)
window.addEventListener('build:click', (e) => {
  const { worldPos, gridPos } = e.detail
  BuildController.build(worldPos, activeColor)
})
```

> Không import module A trực tiếp vào module B nếu chúng không phải là dependency rõ ràng.  
> Giao tiếp qua Events thay vì circular imports.

---

## 8. File Size & Asset Limits

| Loại asset | Giới hạn |
|-----------|---------|
| Mỗi file GLB | < 500 KB |
| Mỗi texture | < 1 MB (source), nên dùng KTX2 cho release |
| Audio WAV/MP3 | < 300 KB (SFX), < 3 MB (ambient) |

---

## 9. Test Conventions

```js
// Dùng Vitest
import { describe, it, expect, beforeEach } from 'vitest'
import { GridManager } from '../src/renderer/game/GridManager.js'

describe('GridManager', () => {
  beforeEach(() => {
    GridManager.clear()
  })

  it('addCell returns a Cell with correct coordinates', () => {
    const cell = GridManager.addCell(1, 0, 2, '#FF0000')
    expect(cell.x).toBe(1)
    expect(cell.y).toBe(0)
    expect(cell.z).toBe(2)
    expect(cell.id).toBe('1_0_2')
  })
})
```

- Test file đặt trong `/tests/`
- Mỗi test phải có `beforeEach` reset state nếu module có state
- Tên test: **động từ + kết quả mong đợi** (tiếng Anh)

---

## 10. Definition of Done cho mỗi task

Một task chỉ được đánh dấu `[x]` khi:
- [ ] Code chạy không có console error
- [ ] Không vi phạm luật bất biến trong AGENTS.md mục 3
- [ ] Không còn `TODO` chưa giải quyết trong code mới
- [ ] Có unit test nếu task liên quan đến logic (GridManager, RuleEngine, Serializer)
- [ ] File GLB (khi có) < 500 KB
