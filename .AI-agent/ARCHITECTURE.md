# ARCHITECTURE.md — Coastlet Builder
## Thiết kế kỹ thuật & API Contract

> File này định nghĩa interface giữa các module. Agent phải follow đúng API này khi implement.  
> Nếu cần thay đổi interface → cập nhật file này trước, rồi mới sửa code.

---

## 1. Sơ đồ phụ thuộc module

```
app.js (entry)
  ├── SceneManager       ← owns THREE.Scene, WebGLRenderer
  ├── CameraController   ← owns PerspectiveCamera, orbit state
  ├── RenderLoop         ← owns rAF loop, tween engine
  ├── InputHandler       ← listens to DOM events, emits game events
  ├── PostProcessing     ← wraps EffectComposer
  │
  ├── BuildController    ← orchestrates build/delete actions
  │     ├── GridManager
  │     ├── ProceduralRuleEngine
  │     ├── AssetManager
  │     └── UndoRedoStack
  │
  ├── AssetManager       ← owns GLTFLoader cache
  │     └── AssetRegistry
  │
  ├── WorldSerializer    ← pure functions, no state
  │
  └── UI
        ├── ColorPalette
        └── Toolbar
```

**Main Process** (Electron):
```
main.js
  ├── createMainWindow.js
  └── ipc/
        ├── saveWorld.js    ← handles 'save-world' channel
        └── loadWorld.js    ← handles 'load-world' channel

preload.js → exposes window.electronAPI
```

---

## 2. API Contracts

### 2.1 SceneManager

```js
// Public API
SceneManager.init(canvasElement: HTMLCanvasElement): void
SceneManager.getScene(): THREE.Scene
SceneManager.getRenderer(): THREE.WebGLRenderer
SceneManager.render(camera: THREE.Camera): void
SceneManager.addObject(object: THREE.Object3D): void
SceneManager.removeObject(object: THREE.Object3D): void
SceneManager.setBackground(color: string): void

// Events: không emit events
```

### 2.2 CameraController

```js
// Public API
CameraController.init(camera: THREE.Camera, domElement: HTMLElement): void
CameraController.update(deltaTime: number): void  // gọi mỗi frame
CameraController.resetToDefault(): void
CameraController.getCamera(): THREE.Camera
CameraController.setPolarAngle(radians: number): void  // clamp auto

// State
CameraController.azimuth: number    // radians
CameraController.elevation: number  // radians, clamped [5°, 85°]
CameraController.distance: number   // clamped [3, 80]
CameraController.target: THREE.Vector3
```

### 2.3 RenderLoop

```js
// Public API
RenderLoop.init(sceneManager, cameraController, postProcessing): void
RenderLoop.start(): void
RenderLoop.stop(): void
RenderLoop.addTween(tween: TweenConfig): TweenHandle
RenderLoop.removeTween(handle: TweenHandle): void

// TweenConfig type:
// {
//   object: THREE.Object3D,
//   from: Record<string, number>,    // e.g. { 'scale.x': 0, 'scale.y': 0 }
//   to: Record<string, number>,
//   duration: number,                // ms
//   easing: 'linear'|'easeOut'|'easeOutBack'|'easeInBack',
//   onComplete?: () => void
// }
```

### 2.4 InputHandler

```js
// Public API
InputHandler.init(domElement: HTMLElement, camera: THREE.Camera, scene: THREE.Scene): void
InputHandler.setBuildableObjects(objects: THREE.Object3D[]): void
InputHandler.dispose(): void

// Events emitted (on window):
// 'build:hover'      → detail: { worldPos: Vector3, gridPos: {x,y,z} } | null
// 'build:click'      → detail: { worldPos: Vector3, gridPos: {x,y,z} }
// 'build:rightclick' → detail: { cell: Cell } | null
// 'ui:keydown'       → detail: { key: string, ctrl: boolean, shift: boolean }
```

### 2.5 GridManager

```js
// Public API
GridManager.addCell(x: number, y: number, z: number, color: string): Cell
GridManager.removeCell(x: number, y: number, z: number): Cell | null
GridManager.getCell(x: number, y: number, z: number): Cell | null
GridManager.hasCell(x: number, y: number, z: number): boolean
GridManager.getNeighbors(x: number, y: number, z: number): Neighbors
GridManager.getAffectedCells(x: number, y: number, z: number): Cell[]
GridManager.getAllCells(): Cell[]
GridManager.getTopCellAt(x: number, z: number): Cell | null  // cell cao nhất tại cột (x,z)
GridManager.clear(): void
GridManager.toJSON(): object
GridManager.fromJSON(data: object): void

// Neighbors type:
// {
//   top: Cell|null, bottom: Cell|null,
//   left: Cell|null, right: Cell|null,
//   front: Cell|null, back: Cell|null
// }

// Axis convention:
// X → horizontal (East-West)
// Y → vertical (Up-Down)
// Z → horizontal (North-South)
// "left" = X-1, "right" = X+1, "front" = Z+1, "back" = Z-1
```

### 2.6 Cell

```js
// Constructor
new Cell(x, y, z, color)

// Properties
cell.id: string          // "x_y_z"
cell.x, cell.y, cell.z: number
cell.color: string       // hex "#RRGGBB"
cell.assetType: string   // key trong ASSET_REGISTRY
cell.rotation: number    // radians, bội số PI/2
cell.mesh: THREE.Object3D | null
cell.metadata: object    // extensible

// Static
Cell.getId(x, y, z): string
Cell.fromJSON(obj): Cell
cell.toJSON(): object
```

### 2.7 ProceduralRuleEngine

```js
// Public API
RuleEngine.resolve(cell: Cell, neighbors: Neighbors): ResolveResult
RuleEngine.resolveAll(cells: Cell[], gridManager: GridManager): Map<string, ResolveResult>

// ResolveResult type:
// { assetType: string, rotation: number }

// Internal helpers (private, nhưng phải test):
RuleEngine._getOpenDirections(neighbors): number[]  // [0,1,2,3] là 4 hướng ngang
RuleEngine._countHorizontalNeighbors(neighbors): number
RuleEngine._isFoundation(cell, neighbors): boolean
RuleEngine._isRoof(cell, neighbors): boolean
RuleEngine._detectBridgeOpportunities(gridManager): BridgeSpec[]

// BridgeSpec type:
// { x: number, y: number, z: number, direction: 'X'|'Z' }
```

### 2.8 BuildController

```js
// Public API
BuildController.init(gridManager, ruleEngine, assetManager, undoRedoStack, sceneManager): void
BuildController.build(worldPos: THREE.Vector3, color: string): void
BuildController.delete(cell: Cell): void
BuildController.getBuildableObjects(): THREE.Object3D[]
BuildController.repaintCell(cell: Cell, color: string): void  // Phase 5+ feature

// Internal
BuildController._snapToGrid(worldPos): {x, y, z}
BuildController._resolveAndUpdate(affectedCells: Cell[]): void
BuildController._spawnMesh(cell: Cell): void
BuildController._updateMesh(cell: Cell): void
BuildController._removeMesh(cell: Cell): void
```

### 2.9 AssetManager

```js
// Public API
AssetManager.preload(keys: string[]): Promise<void>
AssetManager.get(assetType: string): THREE.Object3D   // returns clone
AssetManager.applyColor(object3D: THREE.Object3D, hexColor: string): void
AssetManager.dispose(): void

// Events emitted:
// 'assetmanager:progress' → detail: { loaded: number, total: number }
// 'assetmanager:ready'    → no detail
```

### 2.10 WorldSerializer

```js
// Pure functions — không có state, không có side effects
WorldSerializer.serialize(
  gridManager: GridManager,
  palette: { activeColor: string, colors: string[] },
  camera: { position: Vector3, target: Vector3, zoom: number },
  settings: object
): string   // JSON string

WorldSerializer.deserialize(jsonString: string): WorldData

WorldSerializer.validate(data: object): ValidationResult

// WorldData type:
// { version, grid, palette, cells, camera, settings }

// ValidationResult type:
// { valid: boolean, errors: string[] }

// Throws: SaveFileError extends Error
```

### 2.11 UndoRedoStack

```js
// Public API
UndoRedoStack.push(command: Command): void
UndoRedoStack.undo(): Command | null
UndoRedoStack.redo(): Command | null
UndoRedoStack.canUndo(): boolean
UndoRedoStack.canRedo(): boolean
UndoRedoStack.clear(): void
UndoRedoStack.size(): number    // undo stack size

// Command type:
// {
//   type: 'add' | 'remove',
//   cell: Cell,
//   affectedSnapshots: CellSnapshot[]
// }

// CellSnapshot type:
// { cellId: string, assetType: string, rotation: number }
// (snapshot state trước khi action, để restore)
```

### 2.12 window.electronAPI (Preload Bridge)

```js
// Exposed via contextBridge.exposeInMainWorld
window.electronAPI = {
  ping: () => Promise<string>,
  saveWorld: (jsonData: string, defaultPath?: string) => Promise<{ success: boolean, path?: string }>,
  loadWorld: () => Promise<{ success: boolean, data?: string, error?: string }>,
  saveScreenshot: (dataURL: string) => Promise<{ success: boolean, path?: string }>,
  getAppVersion: () => Promise<string>,
}
```

---

## 3. Event Bus Pattern

> Các module giao tiếp qua `window` custom events thay vì import lẫn nhau trực tiếp (trừ constructor injection).

### Events chuẩn:

| Event name | Emitter | Data | Consumer |
|------------|---------|------|----------|
| `build:click` | InputHandler | `{worldPos, gridPos}` | BuildController |
| `build:rightclick` | InputHandler | `{cell}` | BuildController |
| `build:hover` | InputHandler | `{worldPos, gridPos}` | BuildController (ghost) |
| `ui:keydown` | InputHandler | `{key, ctrl, shift}` | BuildController, CameraController |
| `palette:colorchange` | ColorPalette | `{color: string}` | BuildController |
| `assetmanager:progress` | AssetManager | `{loaded, total}` | Loading UI |
| `assetmanager:ready` | AssetManager | - | app.js |
| `world:saved` | Toolbar | `{path}` | Toolbar (update title) |
| `world:loaded` | Toolbar | - | app.js (rebuild world) |

### Cách emit:
```js
window.dispatchEvent(new CustomEvent('build:click', { detail: { worldPos, gridPos } }))
```

### Cách listen:
```js
window.addEventListener('build:click', (e) => {
  const { worldPos, gridPos } = e.detail
})
```

---

## 4. Render Architecture

```
RenderLoop.tick(timestamp)
  │
  ├── deltaTime = timestamp - lastTimestamp
  │
  ├── CameraController.update(deltaTime)       ← smooth orbit damping
  │
  ├── WaterShader.updateTime(timestamp)        ← wave animation
  │
  ├── RenderLoop._processTweens(deltaTime)     ← build/delete animations
  │
  └── PostProcessing.render() hoặc            ← nếu enabled
      SceneManager.render(camera)              ← nếu không có post
```

---

## 5. Coordinate System

```
Three.js sử dụng right-hand coordinate system:
  X → East (right)
  Y → Up
  Z → South (toward camera in default view)

Grid convention:
  cell(0,0,0) = origin
  cell(1,0,0) = 1 unit East
  cell(0,1,0) = 1 unit Up (tầng 2)
  cell(0,0,1) = 1 unit South

World position của cell(x, y, z):
  worldX = x * CELL_SIZE          (CELL_SIZE = 1)
  worldY = y * CELL_HEIGHT         (CELL_HEIGHT = 1)
  worldZ = z * CELL_SIZE
```

---

## 6. File Loading Strategy

```
App startup:
  1. SceneManager.init()
  2. CameraController.init()
  3. RenderLoop.init()
  4. InputHandler.init()
  5. AssetManager.preload(ALL_KEYS)
     → show loading screen
     → listen 'assetmanager:progress'
  6. 'assetmanager:ready' → hide loading screen
  7. Setup event listeners (build:click, etc.)
  8. Check autosave → restore dialog
  9. RenderLoop.start()
```

---

## 7. Performance Constraints

| Metric | Target | Enforcement |
|--------|--------|-------------|
| FPS | ≥ 60 trên GPU mid-range | Profiler kiểm tra định kỳ |
| Cell update latency | < 50ms sau click | Chỉ update affected cells |
| Asset load | < 3 giây toàn bộ preload | Cache + compress GLB |
| Memory | < 512MB sau 1000 cells | Dispose mesh khi xóa cell |
| Max cells | 500 cells trước khi cần LOD | InstancedMesh cho future |

---

## 8. Error Handling Convention

```js
// ✅ Đúng — fail gracefully
try {
  const asset = AssetManager.get(assetType)
  cell.mesh = asset
} catch (err) {
  console.warn(`[AssetManager] Fallback to cube: ${err.message}`)
  cell.mesh = AssetManager.get('_fallback')
}

// ✅ Đúng — validation trước khi dùng
const result = WorldSerializer.validate(data)
if (!result.valid) {
  showErrorDialog(`Save file lỗi: ${result.errors.join(', ')}`)
  return
}

// ❌ Sai — crash game vì asset thiếu
cell.mesh = assetCache[assetType]  // undefined nếu thiếu

// ❌ Sai — swallow error
try { ... } catch(e) {}  // không log, không fallback
```
