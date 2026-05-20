# TASKS.md — Coastlet Builder
## Master Task Checklist

> Agent đọc file này để biết phải làm gì tiếp theo.  
> Đánh dấu `[x]` sau khi hoàn thành từng task.  
> **Không nhảy phase.**

> **Quyết định ngôn ngữ (supersede deep-research-report khuyến nghị TypeScript):**  
> Project dùng **JavaScript thuần (ES Modules)** cho source chính. TypeScript được bắt buộc trong deep report nhưng
> AGENTS.md không đề cập và ARCHITECTURE.md viết API bằng JS. Quyết định: **JS + JSDoc** cho MVP.  
> Nếu muốn migrate sang TS sau này, đó là refactor tách biệt, không phải Phase 0.

> **Dev flow (Vite-only — không dùng electron-reload):**  
> Dev: `vite` chạy tại `localhost:5173`, Electron `loadURL('http://localhost:5173')`  
> Prod: `vite build` (với `base: './'`) → `loadFile(path.join(distDir, 'index.html'))`

---

## PHASE 0 — Architecture Baseline
**Mục tiêu:** Electron mở được cửa sổ, Three.js render được cube, IPC cơ bản hoạt động.

### P0-01: Project scaffolding
- [ ] Tạo `package.json` với đúng dependencies (xem AGENTS.md mục 5)
- [ ] Tạo `electron-builder.yml` với app metadata cơ bản
- [ ] Tạo `.gitignore` phù hợp cho Electron + Node project
- [ ] Tạo cấu trúc thư mục đầy đủ theo AGENTS.md mục 2

### P0-02: Electron Main Process
- [ ] Tạo `src/main/main.js` — khởi tạo app, tạo BrowserWindow
- [ ] Tạo `src/main/window/createMainWindow.js` — factory function tạo window
- [ ] Window config: `width: 1280`, `height: 720`, `nodeIntegration: false`, `contextIsolation: true`
- [ ] Tạo `src/preload/preload.js` — expose `window.electronAPI` với `ping()` để test IPC
- [ ] Verify: app mở được không crash

### P0-03: Three.js Skeleton
- [ ] Tạo `src/renderer/index.html` — load app.js như module
- [ ] Tạo `src/renderer/app.js` — import Three.js, tạo scene, camera, renderer, render 1 cube
- [ ] WebGLRenderer gắn vào `<canvas>` full-window
- [ ] Resize handler cập nhật camera aspect ratio và renderer size
- [ ] Verify: thấy được cube trắng xoay trong cửa sổ

### P0-04: IPC Round-trip Test
- [ ] Main process register handler: `ipcMain.handle('ping', () => 'pong')`
- [ ] Preload expose: `window.electronAPI.ping()`
- [ ] Renderer gọi `ping()` và log kết quả vào console
- [ ] Verify: console log "pong" không lỗi

### P0-05: Dev Build (Vite-only)
- [ ] `vite.config.js` với `base: './'` — bắt buộc để `loadFile()` hoạt động ở production
- [ ] `npm run dev`: chạy Vite dev server (`localhost:5173`) + Electron `loadURL('http://localhost:5173')`
- [ ] `npm run build`: `vite build` → output tại `dist/renderer/`
- [ ] **KHÔNG dùng electron-reload — chỉ dùng Vite HMR**
- [ ] Console không có warning về security

### P0-06: Security Baseline (BẮT BUỘC trong Phase 0)
- [ ] `createMainWindow.js`: thêm **CSP** qua `session.defaultSession.webRequest.onHeadersReceived`
  - `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:`
- [ ] `main.js`: chặn navigation ngoài app
  ```js
  win.webContents.on('will-navigate', (e, url) => {
    if (!url.startsWith('http://localhost:5173')) e.preventDefault()
  })
  ```
- [ ] `main.js`: chặn `new-window`
  ```js
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  ```
- [ ] `ipcMain.handle`: validate sender trong mọi handler
  ```js
  ipcMain.handle('ping', (event) => {
    if (event.senderFrame.url !== 'http://localhost:5173') return null
    return 'pong'
  })
  ```
- [ ] Preload: chỉ expose API business-level, **KHÔNG expose raw `ipcRenderer`**
- [ ] Verify: mở DevTools → navigate sang URL ngoài → bị chặn
- [ ] Ghi Backlog: custom `app://` protocol thay `file://` cho production (Phase 6)

---

## PHASE 1 — Basic 3D Scene
**Mục tiêu:** Môi trường 3D hoàn chỉnh — camera, ánh sáng, mặt nước, raycaster nhận click.

### P1-01: SceneManager
- [ ] Tạo `src/renderer/engine/SceneManager.js`
- [ ] `SceneManager.init()` → tạo Scene, WebGLRenderer, đặt background color `#B8E0F7`
- [ ] `SceneManager.getScene()`, `SceneManager.getRenderer()` là public API
- [ ] Renderer output encoding: `THREE.SRGBColorSpace`

### P1-02: CameraController
- [ ] Tạo `src/renderer/engine/CameraController.js`
- [ ] PerspectiveCamera: `fov: 45`, `near: 0.1`, `far: 1000`
- [ ] Orbit controls tự implement (không dùng OrbitControls addon để giảm dependency):
  - Giữ chuột phải + drag → xoay (azimuth + elevation)
  - Scroll → zoom (thay đổi camera distance)
  - Clamp elevation: không được nhìn từ dưới lên (min 5°, max 85°)
  - Clamp zoom: min distance `3`, max distance `80`
- [ ] Phím F / nút Reset Camera → về vị trí mặc định `(10, 8, 10)`, target `(0, 0, 0)`

### P1-03: Lighting Setup
- [ ] `DirectionalLight` — color `#FFF5E0`, intensity `1.5`, position `(10, 20, 10)`
- [ ] `HemisphereLight` — skyColor `#87CEEB`, groundColor `#8B7355`, intensity `0.6`
- [ ] `AmbientLight` — color `#FFFFFF`, intensity `0.2`
- [ ] DirectionalLight cast shadow: `mapSize 2048x2048`

### P1-04: Ground Plane / Water Plane
- [ ] Tạo `PlaneGeometry(50, 50)` làm mặt nước
- [ ] Material: `MeshStandardMaterial`, color `#4A9EBF`, transparent, opacity `0.85`
- [ ] Nhận shadow (receiveShadow: true)
- [ ] Xoay để nằm ngang (rotation.x = -Math.PI/2)
- [ ] Tên: `"waterPlane"` — dùng để filter trong raycaster

### P1-05: RenderLoop
- [ ] Tạo `src/renderer/engine/RenderLoop.js`
- [ ] `requestAnimationFrame` loop
- [ ] Gọi `CameraController.update()` mỗi frame (smooth damping)
- [ ] Gọi `SceneManager.render()` mỗi frame
- [ ] Expose `RenderLoop.start()`, `RenderLoop.stop()`

### P1-06: InputHandler & Raycaster
- [ ] Tạo `src/renderer/engine/InputHandler.js`
- [ ] Mouse move → cập nhật normalized coords cho raycaster
- [ ] Left click → raycast vào scene, lọc object có tag `"buildable"`
- [ ] Right click → raycast tương tự, emit event `rightClick`
- [ ] Raycaster chỉ check objects trong `BuildController.getBuildableObjects()` — không cast vào toàn scene
- [ ] Emit custom events: `build:click`, `build:rightclick`, `build:hover`

### P1-07: Hover Highlight
- [ ] Khi hover lên vị trí buildable → hiển thị ghost cube màu trắng bán trong suốt
- [ ] Ghost cube không có shadow
- [ ] Ghost cube update mỗi mousemove (throttle 16ms)

---

## PHASE 2 — Grid System & Build/Delete
**Mục tiêu:** Click trái xây khối, click phải xóa, stack tầng, undo/redo hoạt động.

### P2-01: Cell Data Structure
- [ ] Tạo `src/renderer/game/Cell.js`
- [ ] Cell schema (xem DATA_MODELS.md):
  ```js
  { id, x, y, z, color, assetType, rotation, mesh, metadata }
  ```
- [ ] `Cell.getId(x, y, z)` → `"x_y_z"` static method

### P2-02: GridManager
- [ ] Tạo `src/renderer/game/GridManager.js`
- [ ] Internal store: `Map<string, Cell>` — key là `cell.id`
- [ ] `GridManager.addCell(x, y, z, color)` → trả về Cell mới
- [ ] `GridManager.removeCell(x, y, z)` → trả về Cell bị xóa (cho undo)
- [ ] `GridManager.getCell(x, y, z)` → Cell hoặc null
- [ ] `GridManager.hasCell(x, y, z)` → boolean
- [ ] `GridManager.getNeighbors(x, y, z)` → object `{ top, bottom, left, right, front, back }` — mỗi key là Cell hoặc null
- [ ] `GridManager.getAffectedCells(x, y, z)` → array Cell bị ảnh hưởng khi thêm/xóa tại (x,y,z)
- [ ] `GridManager.getAllCells()` → array tất cả Cell
- [ ] `GridManager.clear()` → xóa toàn bộ
- [ ] `GridManager.toJSON()` / `GridManager.fromJSON(data)` — serialize/deserialize
- [ ] UNIT TEST: `tests/grid.test.js` cover tất cả methods

### P2-03: BuildController
- [ ] Tạo `src/renderer/game/BuildController.js`
- [ ] Inject: GridManager, ProceduralRuleEngine, AssetManager, UndoRedoStack
- [ ] `BuildController.build(worldPos, color)`:
  1. Snap worldPos về grid coordinate `(x, y, z)`
  2. Nếu cell đã tồn tại tại (x, y, 0) → tìm y cao nhất + 1 (stack lên)
  3. Gọi `GridManager.addCell()`
  4. Chạy rule engine cho cell mới + affected cells
  5. Cập nhật mesh trong scene
  6. Push vào UndoRedoStack
- [ ] `BuildController.delete(cell)`: tương tự nhưng xóa
- [ ] `BuildController.getBuildableObjects()` → array Three.js objects có thể raycast

### P2-04: Coordinate Snapping
- [ ] World position → grid coordinate:
  ```js
  const CELL_SIZE = 1;
  const CELL_HEIGHT = 1;
  x = Math.round(worldPos.x / CELL_SIZE)
  z = Math.round(worldPos.z / CELL_SIZE)
  y = (stacked) // xác định từ GridManager
  ```
- [ ] Snap phải chính xác, không bị floating point drift

### P2-05: UndoRedoStack
- [ ] Tạo `src/renderer/game/UndoRedoStack.js`
- [ ] Stack lưu `Command` objects: `{ type: 'add'|'remove', cell: Cell, snapshot: CellSnapshot[] }`
- [ ] `push(command)` — thêm vào stack, clear redo stack
- [ ] `undo()` — pop undo stack, push vào redo stack, execute reverse
- [ ] `redo()` — pop redo stack, execute
- [ ] Max stack size: 50 commands (circular buffer hoặc slice)
- [ ] Hotkey: `Ctrl+Z` → undo, `Ctrl+Y` / `Ctrl+Shift+Z` → redo

### P2-06: Visual Feedback khi Build/Delete
- [ ] Khi xây: cube xuất hiện với scale animation `0 → 1` trong 150ms (easeOut)
- [ ] Khi xóa: cube shrink `1 → 0` trong 100ms, rồi remove từ scene
- [ ] Highlight hover: ghost cube màu `rgba(255,255,255,0.4)` theo con trỏ

---

## PHASE 3 — Procedural Rule Engine
**Mục tiêu:** Các cell tự chọn assetType phù hợp dựa trên context lân cận.

### P3-01: ProceduralRuleEngine Core
- [ ] Tạo `src/renderer/game/ProceduralRuleEngine.js`
- [ ] `RuleEngine.resolve(cell, neighbors)` → trả về `{ assetType, rotation }`
- [ ] Neighbors object: `{ top, bottom, left, right, front, back }` — boolean presence
- [ ] Logic phải đọc từ RULES_REFERENCE.md

### P3-02: Foundation Rules
- [ ] Nếu `y === 0` VÀ không có bottom neighbor → `foundation_solid`
- [ ] Nếu `y === 0` VÀ là cell ở rìa cụm → `foundation_arch` (có vòm phía nước)
- [ ] Logic xác định "rìa": ít nhất 1 phía ngang không có neighbor

### P3-03: Wall Rules
- [ ] Nếu có top neighbor → `wall_flat`
- [ ] Nếu nằm ở góc (2 phía ngang liền kề đều có neighbor) → `wall_corner`
- [ ] Nếu là mặt ngoài (có 1 phía ngang không có neighbor) → candidate cho `wall_window`
- [ ] `wall_window` xuất hiện theo xác suất: 40% các mặt ngoài ở tầng > 0

### P3-04: Roof Rules
- [ ] Nếu không có top neighbor → đây là tầng mái
- [ ] Tổng 4 hướng ngang có neighbor → xác định loại mái:
  - 0 hướng: `roof_peak` (tháp đơn lẻ)
  - 1 hướng: `roof_peak` (đầu hồi)
  - 2 hướng đối diện: `roof_gable`
  - 2 hướng liền kề (góc): `roof_hip_corner`
  - 3 hướng: `roof_t_junction`
  - 4 hướng: `roof_flat` (sân thượng / courtyard)
- [ ] Rotation tính theo hướng open nhất (hướng không có neighbor)

### P3-05: Bridge Rules
- [ ] Scan toàn bộ grid sau mỗi build action
- [ ] Tìm 2 cụm cell (connected components) cách nhau đúng 1 cell theo trục X hoặc Z, cùng độ cao Y
- [ ] Sinh `bridge_span` vào cell khoảng cách nếu chưa có cell tại đó
- [ ] Bridge chỉ sinh khi khoảng cách = 1 (không sinh bridge dài > 1 cell)

### P3-06: Rotation Calculation
- [ ] Rotation được tính theo hướng "open" của cell (hướng không có neighbor ở mặt ngoài)
- [ ] Rotation là bội số của `Math.PI / 2` (0, 90, 180, 270 độ)
- [ ] Helper: `RuleEngine.getOpenDirection(neighbors)` → 0 | 1 | 2 | 3

### P3-07: Batch Resolution
- [ ] `RuleEngine.resolveAll(cells)` → nhận array cell, resolve từng cell, trả về map `{cellId: {assetType, rotation}}`
- [ ] Dùng khi load world từ file JSON

### P3-08: Unit Tests
- [ ] `tests/procedural.test.js`
- [ ] Test case: cell đơn lẻ → foundation + roof_peak
- [ ] Test case: cột 3 tầng → foundation + wall_flat + roof_peak
- [ ] Test case: 2x2 cụm → foundation x4, wall, roof_flat
- [ ] Test case: L-shape → corner wall đúng góc
- [ ] Test case: 2 cụm cách 1 → bridge sinh ra

---

## PHASE 4 — Asset Integration
**Mục tiêu:** Thay fallback cube bằng GLB models thật. Asset Manager cache đúng cách.

### P4-01: AssetRegistry
- [ ] Tạo `src/renderer/assets/AssetRegistry.js`
- [ ] Export object mapping `assetType → filename`:
  ```js
  export const ASSET_REGISTRY = {
    foundation_solid: 'foundation_solid.glb',
    foundation_arch:  'foundation_arch.glb',
    wall_flat:        'wall_flat.glb',
    wall_window:      'wall_window.glb',
    wall_corner:      'wall_corner.glb',
    roof_peak:        'roof_peak.glb',
    roof_gable:       'roof_gable.glb',
    roof_hip_corner:  'roof_hip_corner.glb',
    roof_t_junction:  'roof_t_junction.glb',
    roof_flat:        'roof_flat.glb',
    bridge_span:      'bridge_span.glb',
    _fallback:        '_fallback_cube.glb',
  }
  ```

### P4-02: AssetManager
- [ ] Tạo `src/renderer/assets/AssetManager.js`
- [ ] Sử dụng `GLTFLoader` từ `three/addons/loaders/GLTFLoader.js`
- [ ] `AssetManager.preload(registryKeys[])` → load tất cả assets, return Promise
- [ ] `AssetManager.get(assetType)` → trả về THREE.Object3D clone (từ cache)
- [ ] Nếu `assetType` không tồn tại hoặc load lỗi → trả về `_fallback` model
- [ ] Cache: `Map<string, THREE.Object3D>` lưu original, clone khi get
- [ ] Loading progress: emit event `assetmanager:progress` với `{ loaded, total }`
- [ ] Loading screen hiển thị trong renderer khi preload

### P4-03: Material Color Override
- [ ] Mỗi cell có màu riêng → asset phải reflect màu đó
- [ ] Chuẩn: model GLB có mesh tên `"Wall"` hoặc `"Body"` là phần cần đổi màu
- [ ] `AssetManager.applyColor(object3D, hexColor)`:
  - Traverse tất cả mesh
  - Nếu mesh.name bao gồm `"Colorable"` → clone material, set color
  - Các mesh khác (mái, chi tiết) giữ nguyên màu
- [ ] Convention cho Blender: tên mesh cần đổi màu phải có suffix `_Colorable`

### P4-04: Cell Mesh Lifecycle
- [ ] `BuildController.spawnMesh(cell)` → lấy asset, apply color, đặt vào đúng position
- [ ] `BuildController.updateMesh(cell)` → gọi khi assetType thay đổi (replace mesh cũ)
- [ ] `BuildController.removeMesh(cell)` → remove từ scene, dispose geometry và material
- [ ] Dispose pattern bắt buộc:
  ```js
  mesh.geometry.dispose()
  mesh.material.dispose()
  scene.remove(mesh)
  ```

### P4-05: Placeholder Assets (nếu chưa có GLB thật)
- [ ] Tạo placeholder bằng Three.js primitives cho từng assetType:
  - foundation: `BoxGeometry(1, 0.3, 1)` màu nâu
  - wall: `BoxGeometry(1, 1, 1)` màu theo cell color
  - roof: `ConeGeometry(0.8, 0.6, 4)` màu cam đất
  - bridge: `BoxGeometry(1, 0.2, 1)` màu xám
- [ ] Placeholder phải cùng interface với GLB assets (Object3D)

---

## PHASE 5 — Visual Polish
**Mục tiêu:** Game trông đẹp — shadow, post-processing, water animation, âm thanh.

### P5-01: Shadow System
- [ ] `renderer.shadowMap.enabled = true`
- [ ] `renderer.shadowMap.type = THREE.PCFSoftShadowMap`
- [ ] DirectionalLight: `castShadow: true`, shadow camera frustum bao phủ grid `50x50`
- [ ] Tất cả mesh kiến trúc: `castShadow: true`, `receiveShadow: true`
- [ ] Water plane: `receiveShadow: true`

### P5-02: Tone Mapping & Color
- [ ] `renderer.toneMapping = THREE.ACESFilmicToneMapping`
- [ ] `renderer.toneMappingExposure = 1.2`
- [ ] Anti-aliasing: enable MSAA trong WebGLRenderer `{ antialias: true }`

### P5-03: PostProcessing (Optional nhưng Should)
- [ ] Tạo `src/renderer/engine/PostProcessing.js`
- [ ] Dùng `EffectComposer` từ `three/addons`
- [ ] Pass 1: `RenderPass`
- [ ] Pass 2: `SSAOPass` — radius `0.5`, intensity `0.3` (ambient occlusion nhẹ)
- [ ] Pass 3: `UnrealBloomPass` — threshold `0.9`, strength `0.15`, radius `0.5` (bloom rất nhẹ)
- [ ] Pass 4: `OutputPass`
- [ ] Setting: cho phép tắt post-processing để tăng FPS trên máy yếu

### P5-04: Stylized Water
- [ ] Water plane dùng `ShaderMaterial` tự viết (simple):
  ```glsl
  // vertex: offset Y theo sin wave nhỏ
  vPos = position;
  vPos.y += sin(position.x * 2.0 + time) * 0.02
           + sin(position.z * 1.5 + time * 0.8) * 0.02;
  
  // fragment: base color + Fresnel đơn giản
  vec3 baseColor = vec3(0.29, 0.62, 0.75);
  float fresnel = pow(1.0 - dot(viewDir, normal), 2.0);
  gl_FragColor = vec4(mix(baseColor, vec3(0.8, 0.95, 1.0), fresnel * 0.4), 0.85);
  ```
- [ ] Uniform `time` update mỗi frame
- [ ] Wave không được quá mạnh — chỉ nhẹ nhàng gợn

### P5-05: Build/Delete Animation
- [ ] Build: cell mesh scale from `(0, 0, 0)` to `(1, 1, 1)` trong 150ms, easeOutBack
- [ ] Delete: mesh scale from `(1, 1, 1)` to `(0.1, 0, 0.1)` trong 100ms, easeInBack, rồi remove
- [ ] Implement bằng `RenderLoop.addTween(object, targetProps, duration, easing, onComplete)`
- [ ] Không dùng thư viện animation ngoài — tự implement tweening đơn giản

### P5-06: Audio System
- [ ] `AudioContext` của Web Audio API (không dùng Howler để giảm dependency)
- [ ] Load `build.wav`, `delete.wav` dưới dạng ArrayBuffer → decode → AudioBuffer
- [ ] `AudioSystem.play(soundName)` — playback từ cache
- [ ] Âm lượng master: 0–1, default 0.6
- [ ] `ambient_sea.mp3`: loop, volume 0.2, bật tắt theo setting
- [ ] Toàn bộ audio off nếu `settings.sound === false`

### P5-07: Color Palette UI
- [ ] Tạo `src/renderer/ui/ColorPalette.js`
- [ ] 16 màu pastel mặc định (xem DATA_MODELS.md)
- [ ] Hiển thị dưới dạng grid swatch ở bottom-left
- [ ] Click swatch → active color thay đổi
- [ ] Phím `C` toggle ẩn/hiện palette
- [ ] Active color hiển thị viền trắng rõ

### P5-08: Toolbar UI
- [ ] Tạo `src/renderer/ui/Toolbar.js`
- [ ] Nút Save (icon), Load (icon), Reset Camera (icon), Toggle Sound (icon)
- [ ] Hiển thị top-right, style tối giản
- [ ] Tooltip khi hover

---

## PHASE 6 — Save/Load & Packaging
**Mục tiêu:** Lưu/tải JSON, screenshot, build .exe hoạt động.

### P6-01: WorldSerializer
- [ ] Tạo `src/renderer/game/WorldSerializer.js`
- [ ] `serialize(gridManager, colorPalette, camera, settings)` → JSON string
- [ ] `deserialize(jsonString)` → validate schema → trả về world data object
- [ ] Schema validation tối thiểu:
  - `version` phải tồn tại
  - `cells` phải là array
  - Mỗi cell phải có `x, y, z, color, assetType`
- [ ] Nếu validation fail: throw `SaveFileError` với message rõ ràng
- [ ] `SAVE_VERSION = "1.0.0"` là constant

### P6-02: IPC Save/Load
- [ ] `src/main/ipc/saveWorld.js`:
  ```js
  ipcMain.handle('save-world', async (event, { data, defaultPath }) => {
    const result = await dialog.showSaveDialog({ defaultPath, filters: [{ name: 'Coastlet Save', extensions: ['json'] }] })
    if (!result.canceled) {
      await fs.writeFile(result.filePath, data, 'utf-8')
      return { success: true, path: result.filePath }
    }
    return { success: false }
  })
  ```
- [ ] `src/main/ipc/loadWorld.js`: tương tự với `showOpenDialog` + `fs.readFile`
- [ ] Preload expose:
  ```js
  contextBridge.exposeInMainWorld('electronAPI', {
    saveWorld: (data, defaultPath) => ipcRenderer.invoke('save-world', { data, defaultPath }),
    loadWorld: () => ipcRenderer.invoke('load-world'),
    saveScreenshot: (dataURL) => ipcRenderer.invoke('save-screenshot', { dataURL }),
    ping: () => ipcRenderer.invoke('ping'),
  })
  ```

### P6-03: Autosave
- [ ] Autosave mỗi 5 phút (300000ms) hoặc sau 20 actions (whichever first)
- [ ] Lưu vào `userData` path của Electron: `app.getPath('userData') + '/autosave.json'`
- [ ] Khi mở app: kiểm tra autosave tồn tại → hỏi user có muốn restore không
- [ ] Autosave không hiện dialog — tự động ghi vào fixed path

### P6-04: Screenshot Export
- [ ] `renderer.domElement.toDataURL('image/png')` → gửi qua IPC
- [ ] Main process mở save dialog cho PNG
- [ ] UI: nút camera trong toolbar hoặc phím `F12`

### P6-05: Unit Tests Save/Load
- [ ] `tests/save-load.test.js`
- [ ] Test serialize → deserialize → world identical
- [ ] Test invalid JSON → throws SaveFileError
- [ ] Test version mismatch → throws với message rõ
- [ ] Test empty world → serialize/deserialize không lỗi

### P6-06: Electron Builder Config
- [ ] `electron-builder.yml` đầy đủ:
  ```yaml
  appId: com.coastlet.builder
  productName: Coastlet Builder
  directories:
    output: dist
  win:
    target: nsis
    icon: assets/icons/icon.ico
  mac:
    target: dmg
    icon: assets/icons/icon.icns
  linux:
    target: AppImage
    icon: assets/icons/icon.png
  files:
    - src/**/*
    - assets/**/*
    - package.json
  ```
- [ ] Tạo icon 512x512 PNG cho app (có thể placeholder)
- [ ] `npm run build` tạo installer trong `dist/`
- [ ] Test installer chạy được trên Windows 10/11

### P6-07: Settings Persistence
- [ ] Settings lưu vào `app.getPath('userData') + '/settings.json'`
- [ ] Load settings khi khởi động, merge với defaults
- [ ] Settings schema: `{ sound, music, graphicsQuality, masterVolume }`
- [ ] Tạo Settings UI tối giản (modal đơn giản)

---

## BACKLOG (Future, sau MVP)

- [ ] Irregular/deformed grid support
- [ ] WFC-inspired generation (nâng cấp từ rule-based)
- [ ] Courtyard detection algorithm
- [ ] Decorative props (chim, dây phơi, cây)
- [ ] Day/night cycle
- [ ] Multiple world slots
- [ ] Export to WebGL/HTML share link
- [ ] Localization (EN/VI)
