# 🏝️ Coastlet Builder — Tổng quan dự án

> *"Mỗi cú click phải tạo ra kết quả đẹp tức thì."*

---

## 1. Dự án là gì?

**Coastlet Builder** là một **desktop sandbox game** dạng "coastal town-building toy" — người chơi xây dựng thị trấn ven biển bằng cách click chuột. Hệ thống phía sau **tự động quyết định** hình dạng kiến trúc phù hợp: tường, mái, móng, cầu nối, cọc chống nước — tất cả đều sinh ra dựa trên ngữ cảnh xung quanh, không cần người chơi chọn từng mảnh thủ công.

### Triết lý cốt lõi
| Nguyên tắc | Ý nghĩa |
|-----------|---------|
| **Click = kết quả đẹp ngay** | Không cần học, không cần chọn mảnh |
| **Không bao giờ fail** | Không có trạng thái thua, không crash vì thiếu asset |
| **Thư giãn** | Không mục tiêu, không áp lực — xây cho vui |
| **Hệ thống thông minh** | Procedural engine tự quyết định kiến trúc |

---

## 2. Bối cảnh thương mại

Dự án được lấy cảm hứng từ **Townscaper** (2020, Oskar Stålberg) — game indie thành công về dạng "relaxing city builder procedural" — nhưng **định vị khác biệt rõ ràng**:

- Townscaper: lưới bất quy tắc, phong cách Scandinavian, island mềm mại
- **Coastlet Builder**: ngữ nghĩa hàng hải rõ ràng — pier, seawall, nhà sàn, cảng cá, đèn biển, cầu thang nước, thủy triều

> [!IMPORTANT]
> **Rủi ro IP được đánh giá kỹ trong `deep-research-report.md`.** Kết luận: "click đặt block + algorithm tự dựng kiến trúc" là **vùng ý tưởng/phương pháp** — không bị bảo hộ bản quyền. Nhưng visual identity, âm thanh, UI grammar, marketing copy nếu quá giống Townscaper thì có thể vướng trade dress. Chiến lược: **inspired by category, not by expression**.

---

## 3. Tầm nhìn trải nghiệm

```
Người chơi mở app
    → thấy mặt nước xanh lấp lánh, trời trong, nhạc biển nhẹ
    → click một ô trên mặt nước
    → một ngôi nhà nhỏ hiện ra với móng cọc, mái đỏ
    → click thêm bên cạnh
    → hai nhà tự nối tường lại, mái biến thành mái chạy dài
    → click thêm 1 ô cách 1 khoảng
    → một cây cầu gỗ tự sinh ra nối hai cụm nhà
    → Ctrl+Z → cầu biến mất
    → Ctrl+Y → cầu xuất hiện lại
    → Lưu file → đóng app → mở lại → thế giới nguyên vẹn
```

---

## 4. Stack kỹ thuật

```
┌─────────────────────────────────────────────────────┐
│  ELECTRON 30 (Desktop Shell)                        │
│  ┌─────────────────┐  ┌────────────────────────┐   │
│  │  Main Process   │  │  Renderer Process      │   │
│  │                 │  │                        │   │
│  │  - App lifecycle│  │  THREE.JS 0.165        │   │
│  │  - File dialogs │  │  - SceneManager        │   │
│  │  - Save/Load    │◄─┤  - CameraController    │   │
│  │  - Auto-update  │  │  - GridManager         │   │
│  │                 │  │  - RuleEngine          │   │
│  └────────┬────────┘  │  - AssetManager        │   │
│           │ IPC       │  - BuildController     │   │
│  ┌────────┴────────┐  └────────────────────────┘   │
│  │  Preload Bridge │                                │
│  │  contextBridge  │  - KHÔNG có nodeIntegration   │
│  │  (hẹp, safe)   │  - KHÔNG có require() trực tiếp│
│  └─────────────────┘                                │
└─────────────────────────────────────────────────────┘

Build Tool: Vite 5
Test: Vitest 1
Packaging: electron-builder 24
Language: JavaScript (ES Modules) — Vanilla, không React/Vue
```

---

## 5. Kiến trúc module

```
app.js (entry)
  │
  ├── SceneManager        → owns THREE.Scene, WebGLRenderer
  ├── CameraController    → orbit tự implement (no OrbitControls)
  ├── RenderLoop          → rAF loop + tween engine tự viết
  ├── InputHandler        → DOM events → Custom Events
  ├── PostProcessing      → SSAO + Bloom (Phase 5)
  │
  ├── BuildController     ← TRUNG TÂM ĐIỀU PHỐI
  │     ├── GridManager         → Map<"x_y_z", Cell>
  │     ├── ProceduralRuleEngine → quyết định assetType
  │     ├── AssetManager        → GLTFLoader cache + fallback
  │     └── UndoRedoStack       → 50 steps circular buffer
  │
  ├── WorldSerializer     → pure functions, serialize/deserialize
  │
  └── UI
        ├── ColorPalette  → 16 pastel swatches
        └── Toolbar       → Save, Load, Camera, Sound
```

### Luồng dữ liệu khi người chơi click

```
User Click
    ↓
InputHandler → emit 'build:click'
    ↓
BuildController.build(worldPos, color)
    ├─ GridManager.addCell(x, y, z)      ← lưu data thuần
    ├─ RuleEngine.resolve(cell, neighbors) ← quyết định hình dạng
    ├─ AssetManager.get(assetType)        ← lấy 3D model (hoặc fallback)
    ├─ scene.add(mesh) + applyColor()     ← render
    ├─ UndoRedoStack.push(command)        ← lịch sử undo
    └─ RenderLoop.addTween(scale 0→1)    ← animation xuất hiện 150ms
```

---

## 6. Procedural Rule Engine — Trái tim của game

Đây là module quan trọng nhất. Mỗi cell sau khi được đặt vào grid sẽ được **resolve** để tìm ra assetType phù hợp dựa trên 6 neighbor (top/bottom/left/right/front/back):

### Quy tắc Foundation (Móng)
| Điều kiện | Kết quả |
|-----------|---------|
| y === 0, không có bottom | `foundation_solid` |
| y === 0, là cell rìa cụm (≥1 phía ngang trống) | `foundation_arch` (có vòm phía nước) |

### Quy tắc Wall (Tường)
| Điều kiện | Kết quả |
|-----------|---------|
| Có top neighbor | `wall_flat` |
| 2 phía ngang liền kề đều có neighbor | `wall_corner` |
| Mặt ngoài (1 phía trống), tầng > 0 | `wall_window` (40% xác suất) |

### Quy tắc Roof (Mái)
| Số neighbor ngang | Kết quả |
|------------------|---------|
| 0 hoặc 1 | `roof_peak` |
| 2 đối diện | `roof_gable` |
| 2 liền kề (góc) | `roof_hip_corner` |
| 3 | `roof_t_junction` |
| 4 | `roof_flat` (sân thượng) |

### Quy tắc Bridge (Cầu tự động)
```
Sau mỗi build action:
  → Scan toàn bộ grid tìm connected components
  → Nếu 2 cụm cách đúng 1 cell, cùng độ cao Y
  → Tự sinh bridge_span tại ô khoảng trống đó
```

> **Tại sao Rule-based thay vì WFC/ML?**  
> Rule-based cho output **tất định** (deterministic) — cùng input luôn ra cùng output. Dễ debug, dễ test, dễ migrate save file. WFC có thể contradiction. ML cần dataset, runtime unpredictable. Với game desktop MVP cần QA ổn định → Rule-based là lựa chọn đúng.

---

## 7. Asset & Rendering Strategy

### Các loại asset cần có

| Asset | Format | Ghi chú |
|-------|--------|---------|
| `foundation_solid.glb` | GLB | Móng đặc |
| `foundation_arch.glb` | GLB | Móng có vòm |
| `wall_flat.glb` | GLB | Tường phẳng |
| `wall_window.glb` | GLB | Tường có cửa sổ |
| `wall_corner.glb` | GLB | Tường góc |
| `roof_peak.glb` | GLB | Mái nhọn |
| `roof_gable.glb` | GLB | Mái tam giác |
| `roof_hip_corner.glb` | GLB | Mái góc |
| `roof_t_junction.glb` | GLB | Mái ngã ba |
| `roof_flat.glb` | GLB | Sân thượng |
| `bridge_span.glb` | GLB | Cầu nối |
| `_fallback_cube.glb` | GLB | **BẮT BUỘC tồn tại** |

### Color System
- Mỗi cell có màu riêng (hex)
- Mesh GLB có mesh con tên kết thúc bằng `_Colorable` → clone material + set color
- Các phần còn lại (mái, chi tiết) giữ nguyên màu gốc

### Performance Targets
| Metric | Target |
|--------|--------|
| FPS | ≥ 60 trên GPU mid-range |
| Cell update latency | < 50ms sau click |
| Asset preload | < 3 giây toàn bộ |
| Memory | < 512MB sau 1000 cells |
| Max cells trước LOD | 500 cells |

---

## 8. Save System

### Nguyên tắc: **Lưu logic, không lưu mesh**
```json
{
  "meta": {
    "schemaVersion": 1,
    "appVersion": "0.1.0",
    "worldId": "uuid-v4",
    "randomSeed": 42,
    "createdAt": "2026-05-19T15:00:00Z"
  },
  "world": { "name": "My Town", "seaLevel": 0 },
  "camera": { "pitch": 0.8, "yaw": 0.5, "distance": 15, "target": [0, 0, 0] },
  "palette": [{ "key": "sand", "hex": "#F5DEB3" }],
  "cells": [
    { "id": "0_0_0", "q": 0, "r": 0, "h": 0, "occupied": true, "colorKey": "sand" }
  ]
}
```

Khi **load**: đọc cells → chạy RuleEngine.resolveAll() → dựng lại toàn bộ mesh từ đầu.

### Autosave
- Mỗi 5 phút hoặc sau 20 actions
- Lưu vào `userData/autosave.json` (không hiện dialog)
- Khi mở app: kiểm tra autosave → hỏi có muốn restore không

---

## 9. Visual & Audio

### Ánh sáng
- `DirectionalLight` — `#FFF5E0`, intensity 1.5, position (10, 20, 10)
- `HemisphereLight` — sky `#87CEEB`, ground `#8B7355`, intensity 0.6
- `AmbientLight` — `#FFFFFF`, intensity 0.2
- Shadow map: PCFSoft, 2048×2048

### Water Shader (tự viết)
```glsl
// Vertex: gợn sóng nhẹ
vPos.y += sin(position.x * 2.0 + time) * 0.02
        + sin(position.z * 1.5 + time * 0.8) * 0.02;

// Fragment: Fresnel effect
vec3 baseColor = vec3(0.29, 0.62, 0.75);
float fresnel = pow(1.0 - dot(viewDir, normal), 2.0);
gl_FragColor = vec4(mix(baseColor, vec3(0.8, 0.95, 1.0), fresnel * 0.4), 0.85);
```

### Post-Processing (Phase 5)
- SSAO: radius 0.5, intensity 0.3
- UnrealBloom: threshold 0.9, strength 0.15 (rất nhẹ)
- Tone Mapping: ACESFilmic, exposure 1.2

### Animations
- **Build**: mesh scale `0 → 1` trong 150ms, easeOutBack
- **Delete**: mesh scale `1 → 0` trong 100ms, easeInBack → remove

### Audio (Web Audio API, không Howler)
- `build.wav` → play khi xây
- `delete.wav` → play khi xóa
- `ambient_sea.mp3` → loop, volume 0.2

---

## 10. Camera System

Tự implement orbit controls (không dùng OrbitControls của Three.js):
- **Chuột phải + drag** → xoay (azimuth + elevation)
- **Scroll** → zoom
- **Clamp elevation**: [5°, 85°] — không nhìn từ dưới lên
- **Clamp zoom**: [3, 80] units
- **Phím F**: reset về `(10, 8, 10)`, target `(0, 0, 0)`

---

## 11. Security (Electron Hardening)

```js
// BẮT BUỘC — không được thay đổi
nodeIntegration: false
contextIsolation: true
sandbox: true
webSecurity: true
```

- Renderer **KHÔNG BAO GIỜ** gọi `require()`, `fs`, `path` trực tiếp
- Tất cả I/O đi qua `window.electronAPI` (được expose bởi preload)
- IPC chỉ dùng `ipcRenderer.invoke` ↔ `ipcMain.handle`

---

## 12. Lộ trình 7 Phase

```
Phase 0 ── Electron + Three.js skeleton chạy được, IPC ping/pong
    │
Phase 1 ── 3D scene, camera orbit, ánh sáng, water plane, raycaster, hover ghost
    │
Phase 2 ── Grid system, click xây/xóa, stack tầng, undo/redo (50 steps)
    │
Phase 3 ── Procedural rule engine: foundation/wall/roof/bridge
    │
Phase 4 ── GLB asset loading, material color override, placeholder primitives
    │
Phase 5 ── Shadow, post-processing, water shader, audio, color palette UI
    │
Phase 6 ── Save/Load JSON, screenshot, autosave, electron-builder packaging
    │
   MVP
```

> **Luật bất biến:** Không được nhảy phase. Phase 3 (procedural) và Phase 4 (assets) là hai phase dễ underestimate nhất.

---

## 13. Timeline & Chi phí ước tính

| Kịch bản | Team | Thời gian | Chi phí dev |
|----------|------|-----------|------------|
| Minimal (solo) | 1 dev full-time + 1 artist part-time | 5–6 tháng | $20K–$40K |
| **Typical** ← khuyến nghị | 1 lead + 1 engine dev + 1 UI dev + 1 artist | 7–9 tháng | $70K–$140K |
| Full-featured | 6–8 người | 10–14 tháng | $180K–$360K |

---

## 14. Trạng thái hiện tại

| Hạng mục | Trạng thái |
|---------|-----------|
| Tài liệu thiết kế | ✅ AGENTS.md, ARCHITECTURE.md, TASKS.md, deep-research-report.md |
| Code | ❌ Chưa có file nào — build từ đầu hoàn toàn |
| GLB Assets | ❌ Chưa có — dùng Three.js primitives làm placeholder |
| CONVENTIONS.md | ❌ Cần tạo |
| DATA_MODELS.md | ❌ Cần tạo |
| RULES_REFERENCE.md | ❌ Cần tạo |

**Bước tiếp theo:** Approve plan → chạy `npm init` → scaffold cấu trúc → Phase 0.

---

*Tài liệu này được tổng hợp từ: `AGENTS.md`, `ARCHITECTURE.md`, `TASKS.md`, `deep-research-report.md` trong `.AI-agent/`*
