# DATA_MODELS.md — Coastlet Builder
## Schema dữ liệu

> Nguồn sự thật duy nhất cho mọi cấu trúc dữ liệu.  
> Thay đổi schema → cập nhật file này TRƯỚC, rồi mới sửa code.

---

## 1. Hệ tọa độ — SQUARE GRID (x, y, z)

```
X → East (right)   Y → Up (tầng)   Z → South (depth)

Cell(0,0,0) = origin
Cell(1,0,0) = 1 ô East
Cell(0,1,0) = tầng 2
Cell(0,0,1) = 1 ô South

worldX = x * CELL_SIZE    (CELL_SIZE = 1)
worldY = y * CELL_HEIGHT  (CELL_HEIGHT = 1)
worldZ = z * CELL_SIZE
```

> ⚠️ `q`, `r` là axial hex coordinates — KHÔNG dùng trong project này.  
> Nếu thấy `q` hoặc `r` trong code → đó là BUG, phải sửa ngay.

---

## 2. Cell Schema

```js
{
  id: string,               // "x_y_z" — ví dụ "3_1_2"
  x: number,                // integer
  y: number,                // integer (tầng)
  z: number,                // integer
  color: string,            // hex "#RRGGBB"
  assetType: string,        // key trong ASSET_REGISTRY
  rotation: number,         // radians, bội số Math.PI/2
  mesh: THREE.Object3D | null,
  metadata: object,         // extensible, mặc định {}
}
```

### cell.toJSON() — chỉ lưu data thuần, KHÔNG lưu mesh

```js
{
  id: "3_1_2",
  x: 3, y: 1, z: 2,
  color: "#F5DEB3",
  assetType: "wall_flat",
  rotation: 1.5707963267948966
}
```

---

## 3. Neighbors

```js
// GridManager.getNeighbors(x, y, z) trả về:
{
  top:    Cell | null,   // (x, y+1, z)
  bottom: Cell | null,   // (x, y-1, z)
  left:   Cell | null,   // (x-1, y, z)
  right:  Cell | null,   // (x+1, y, z)
  front:  Cell | null,   // (x, y, z+1)
  back:   Cell | null,   // (x, y, z-1)
}
```

---

## 4. ResolveResult

```js
// ProceduralRuleEngine.resolve(cell, neighbors) trả về:
{ assetType: string, rotation: number }
```

---

## 5. Command (UndoRedo)

```js
{
  type: 'add' | 'remove',
  cell: Cell,
  affectedSnapshots: CellSnapshot[],
}

// CellSnapshot — trạng thái cell TRƯỚC action
{
  cellId: string,
  assetType: string,
  rotation: number,
}
```

---

## 6. BridgeSpec

```js
// RuleEngine._detectBridgeOpportunities() trả về:
{ x: number, y: number, z: number, direction: 'X' | 'Z' }
```

---

## 7. Save File Schema

**SAVE_VERSION = "1.0.0"** (constant trong WorldSerializer.js)

```json
{
  "meta": {
    "schemaVersion": 1,
    "appVersion": "0.1.0",
    "worldId": "uuid-v4",
    "createdAt": "2026-05-19T15:00:00.000Z",
    "updatedAt": "2026-05-19T16:30:00.000Z"
  },
  "world": { "name": "My Town", "seaLevel": 0 },
  "camera": {
    "azimuth": 0.785,
    "elevation": 0.611,
    "distance": 15.0,
    "target": [0.0, 0.0, 0.0]
  },
  "palette": {
    "activeColor": "#F5DEB3",
    "colors": ["#F5DEB3", "#DEB887", "..."]
  },
  "cells": [
    {
      "id": "0_0_0",
      "x": 0, "y": 0, "z": 0,
      "color": "#F5DEB3",
      "assetType": "foundation_solid",
      "rotation": 0
    }
  ]
}
```

> `randomSeed` **KHÔNG có** trong schema MVP — rule engine deterministic.  
> `colorKey` **KHÔNG dùng** — lưu hex trực tiếp để tránh broken khi palette thay đổi.

### Bảng trường bắt buộc

| Trường | Type | Ghi chú |
|--------|------|---------|
| `meta.schemaVersion` | integer | Dùng để migration |
| `meta.worldId` | string | UUID v4 |
| `cells[].x/y/z` | integer | Square grid coords |
| `cells[].color` | "#RRGGBB" | Hex trực tiếp |
| `cells[].assetType` | string | Key trong ASSET_REGISTRY |
| `cells[].rotation` | number | Bội số Math.PI/2 |

---

## 8. Asset Registry

```js
export const ASSET_REGISTRY = {
  foundation_solid:  'foundation_solid.glb',
  foundation_arch:   'foundation_arch.glb',
  wall_flat:         'wall_flat.glb',
  wall_window:       'wall_window.glb',
  wall_corner:       'wall_corner.glb',
  roof_peak:         'roof_peak.glb',
  roof_gable:        'roof_gable.glb',
  roof_hip_corner:   'roof_hip_corner.glb',
  roof_t_junction:   'roof_t_junction.glb',
  roof_flat:         'roof_flat.glb',
  bridge_span:       'bridge_span.glb',
  _fallback:         '_fallback_cube.glb',  // LUÔN phải tồn tại
}
```

### Placeholder primitives (Phase 0–4)

```js
foundation_solid  → BoxGeometry(1, 0.3, 1)     màu #8B4513
wall_flat         → BoxGeometry(1, 1, 0.1)     màu cell.color
roof_peak         → ConeGeometry(0.6, 0.6, 4)  màu #CD853F
bridge_span       → BoxGeometry(1, 0.2, 1)     màu #808080
_fallback         → BoxGeometry(1, 1, 1)       màu #FF00FF (dễ nhận bug)
```

> **Convention Blender (Phase 4+):** Mesh cần đổi màu → suffix `_Colorable`.

---

## 9. Palette màu mặc định (16 màu pastel)

```js
export const DEFAULT_PALETTE = [
  '#F5DEB3', '#DEB887', '#CD853F', '#8B4513',
  '#D2B48C', '#BC8F5F', '#E8A87C', '#F4A460',
  '#FFDEAD', '#FAEBD7', '#FFE4C4', '#FAD7A0',
  '#A8D8EA', '#7FB3D3', '#5D8AA8', '#A3C4BC',
]
```

---

## 10. WorldData (output của WorldSerializer.deserialize)

```js
{
  meta: { schemaVersion, appVersion, worldId, createdAt, updatedAt },
  world: { name, seaLevel },
  camera: { azimuth, elevation, distance, target: [x, y, z] },
  palette: { activeColor, colors: string[] },
  cells: CellJSON[],
}
```

---

## 11. ValidationResult

```js
{ valid: boolean, errors: string[] }
```

### Validation tối thiểu

| Điều kiện lỗi | Message |
|--------------|---------|
| Thiếu `meta.schemaVersion` | "Missing meta.schemaVersion" |
| `cells` không phải array | "cells must be an array" |
| Cell thiếu x/y/z | "Cell missing coordinate: {id}" |
| Cell thiếu `color` | "Cell missing color: {id}" |
| Cell `id` không khớp `x_y_z` | "Cell id mismatch: {id}" |
