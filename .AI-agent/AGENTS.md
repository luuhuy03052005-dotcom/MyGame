# AGENTS.md — Coastlet Builder
## AI Agent Master Configuration

> **Đọc file này trước tất cả.** Đây là nguồn sự thật duy nhất cho mọi quyết định kỹ thuật trong project này.

---

## 1. Tổng quan dự án

**Tên:** Coastlet Builder  
**Loại:** Desktop Sandbox Game — Procedural Coastal Town Builder  
**Stack:** Electron + Three.js + JavaScript (ES Modules)  
**Mục tiêu trải nghiệm:** Click-to-build, thư giãn, không fail state, đẹp mắt.

### Tinh thần thiết kế
- Mỗi cú click phải tạo ra kết quả đẹp tức thì — không cần người chơi chọn mảnh thủ công.
- Hệ thống tự quyết định tường, mái, móng, cầu nối dựa trên context lân cận.
- Không bao giờ crash vì thiếu asset — luôn có fallback.
- Không bao giờ làm hỏng save file — luôn validate trước khi dùng.

---

## 2. Cấu trúc thư mục

```
coastlet-builder/
├── AGENTS.md                    ← File này
├── TASKS.md                     ← Danh sách task theo phase
├── ARCHITECTURE.md              ← Thiết kế kỹ thuật chi tiết
├── CONVENTIONS.md               ← Quy ước code bắt buộc
├── DATA_MODELS.md               ← Schema dữ liệu
├── RULES_REFERENCE.md           ← Bộ luật procedural đầy đủ
├── package.json
├── electron-builder.yml
├── src/
│   ├── main/
│   │   ├── main.js              ← Electron main process entry
│   │   ├── ipc/
│   │   │   ├── saveWorld.js
│   │   │   └── loadWorld.js
│   │   └── window/
│   │       └── createMainWindow.js
│   ├── preload/
│   │   └── preload.js           ← Context bridge — KHÔNG để lộ Node API
│   └── renderer/
│       ├── index.html
│       ├── app.js               ← Entry point renderer
│       ├── engine/
│       │   ├── SceneManager.js
│       │   ├── CameraController.js
│       │   ├── RenderLoop.js
│       │   ├── InputHandler.js
│       │   └── PostProcessing.js
│       ├── game/
│       │   ├── GridManager.js
│       │   ├── Cell.js
│       │   ├── ProceduralRuleEngine.js
│       │   ├── BuildController.js
│       │   ├── UndoRedoStack.js
│       │   └── WorldSerializer.js
│       ├── assets/
│       │   ├── AssetManager.js
│       │   └── AssetRegistry.js
│       └── ui/
│           ├── ColorPalette.js
│           └── Toolbar.js
├── assets/
│   ├── models/
│   │   ├── foundation_solid.glb
│   │   ├── foundation_arch.glb
│   │   ├── wall_flat.glb
│   │   ├── wall_window.glb
│   │   ├── wall_corner.glb
│   │   ├── roof_peak.glb
│   │   ├── roof_hip.glb
│   │   ├── bridge_span.glb
│   │   └── _fallback_cube.glb   ← Luôn phải tồn tại
│   ├── sounds/
│   │   ├── build.wav
│   │   ├── delete.wav
│   │   └── ambient_sea.mp3
│   └── textures/
├── tests/
│   ├── grid.test.js
│   ├── procedural.test.js
│   └── save-load.test.js
└── docs/
```

---

## 3. Luật bất biến (KHÔNG được vi phạm)

### 3.1 Bảo mật Electron
```
nodeIntegration: false          ← BẮT BUỘC
contextIsolation: true          ← BẮT BUỘC
sandbox: true                   ← BẮT BUỘC trong production
webSecurity: true               ← BẮT BUỘC
```
> Renderer KHÔNG BAO GIỜ gọi `require()`, `fs`, `path` trực tiếp.  
> Tất cả I/O đi qua `window.electronAPI` được expose bởi preload.

### 3.2 Không bao giờ render lại toàn bộ world
- Sau mỗi action, chỉ update các cell bị ảnh hưởng (cell vừa click + 6 cell lân cận trực tiếp).
- `GridManager.getAffectedCells(x, y, z)` phải trả về đúng tập cell cần re-resolve.

### 3.3 Save file phải có version check
```js
if (data.version !== SAVE_VERSION) {
  // migrate hoặc báo lỗi rõ ràng — KHÔNG load mù
}
```

### 3.4 Asset fallback
```js
AssetManager.get(assetType) // Nếu không tìm thấy → trả về _fallback_cube
```
> Game không được crash vì thiếu GLB file.

### 3.5 Undo/Redo stack
- Min 20 bước, tốt nhất 50 bước.
- Ctrl+Z / Ctrl+Y phải hoạt động đồng nhất.

---

## 4. Thứ tự build (QUAN TRỌNG)

Đây là thứ tự duy nhất được phép làm. **Không nhảy phase.**

```
Phase 0 → Phase 1 → Phase 2 → Phase 3 → Phase 4 → Phase 5 → Phase 6
```

| Phase | Mục tiêu | File tham chiếu |
|-------|-----------|-----------------|
| 0 | Electron + Three.js skeleton chạy được | `tasks/PHASE_0.md` |
| 1 | 3D scene, camera, ánh sáng, raycaster | `tasks/PHASE_1.md` |
| 2 | Grid system, click xây/xóa, undo/redo | `tasks/PHASE_2.md` |
| 3 | Procedural rule engine (rule-based) | `tasks/PHASE_3.md` |
| 4 | Load GLB asset, asset registry, material color | `tasks/PHASE_4.md` |
| 5 | Lighting polish, shadow, post-processing, water, sound | `tasks/PHASE_5.md` |
| 6 | Save/Load JSON, screenshot, electron-builder packaging | `tasks/PHASE_6.md` |

---

## 5. Phụ thuộc package chính

```json
{
  "dependencies": {
    "electron": "^30.x",
    "three": "^0.165.x"
  },
  "devDependencies": {
    "electron-builder": "^24.x",
    "vitest": "^1.x",
    "vite": "^5.x"
  }
}
```

> Không dùng React/Vue/Angular. UI là vanilla JS DOM.  
> Không dùng jQuery.  
> Three.js import theo module: `import * as THREE from 'three'`

---

## 6. Giao tiếp giữa AI agent và codebase

Khi implement bất kỳ feature nào, agent phải:

1. Đọc `TASKS.md` để xác định task đang làm.
2. Đọc `ARCHITECTURE.md` để hiểu interface giữa các module.
3. Đọc `CONVENTIONS.md` để format code đúng.
4. Đọc `RULES_REFERENCE.md` nếu task liên quan đến procedural engine.
5. Đọc `DATA_MODELS.md` nếu task liên quan đến save/load.
6. Chạy test sau khi implement.
7. Đánh dấu task là `[x]` trong `TASKS.md`.

---

## 7. Definition of Done cho từng task

Một task được coi là **Done** khi:
- [ ] Code chạy không có console error.
- [ ] Không vi phạm luật bất biến ở mục 3.
- [ ] Có unit test nếu task liên quan đến logic (GridManager, RuleEngine, Serializer).
- [ ] Không có `TODO` chưa giải quyết trong code mới thêm vào.
- [ ] File size GLB assets mỗi model < 500KB.

---

## 8. Liên hệ tài liệu tham chiếu

| Tài liệu | Mục đích |
|----------|----------|
| `TASKS.md` | Checklist task toàn bộ project |
| `ARCHITECTURE.md` | API contract giữa các module |
| `CONVENTIONS.md` | Code style, naming, comment rules |
| `DATA_MODELS.md` | JSON schema save file, Cell schema |
| `RULES_REFERENCE.md` | Toàn bộ bộ luật procedural building |
