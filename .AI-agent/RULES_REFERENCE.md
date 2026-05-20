# RULES_REFERENCE.md — Coastlet Builder
## Bộ luật Procedural Building Engine đầy đủ

> Agent phải đọc file này trước khi implement bất kỳ phần nào của ProceduralRuleEngine.js.  
> Đây là nguồn sự thật duy nhất cho mọi quyết định assetType và rotation.

---

## 1. Thứ tự ưu tiên rules (Priority Order)

```
1. Bridge detection (chạy sau mỗi build action, scan toàn grid)
2. Foundation rules  (y === 0)
3. Roof rules        (không có top neighbor)
4. Wall rules        (có top neighbor HOẶC có bottom neighbor)
```

Mỗi cell chạy qua `RuleEngine.resolve(cell, neighbors)` → nhận `{ assetType, rotation }`.

---

## 2. Helper: Horizontal Neighbor Count

```js
// Đếm số neighbor theo 4 hướng ngang (không tính top/bottom)
function countHorizontalNeighbors(neighbors) {
  let count = 0
  if (neighbors.left)  count++
  if (neighbors.right) count++
  if (neighbors.front) count++
  if (neighbors.back)  count++
  return count  // 0, 1, 2, 3, hoặc 4
}
```

---

## 3. Helper: Open Directions

```js
// Trả về mảng các hướng ngang KHÔNG có neighbor
// Direction index: 0=left, 1=right, 2=front, 3=back
function getOpenDirections(neighbors) {
  const open = []
  if (!neighbors.left)  open.push(0)
  if (!neighbors.right) open.push(1)
  if (!neighbors.front) open.push(2)
  if (!neighbors.back)  open.push(3)
  return open  // ví dụ [0, 2] = left và front đều trống
}
```

---

## 4. Rotation Calculation

```js
// Rotation là bội số của Math.PI/2 (0, π/2, π, 3π/2)
// Tương đương 0°, 90°, 180°, 270°

const ROTATION = {
  NORTH: 0,                    // hướng về back (Z-)
  EAST:  Math.PI / 2,          // hướng về right (X+)
  SOUTH: Math.PI,              // hướng về front (Z+)
  WEST:  (3 * Math.PI) / 2,    // hướng về left (X-)
}

// Rotation theo "hướng open nhất" (hướng không có neighbor)
// Dùng cho roof và wall mặt ngoài
function calcRotationFromOpenDir(openDirections) {
  const primary = openDirections[0]  // lấy hướng đầu tiên
  const map = { 0: ROTATION.WEST, 1: ROTATION.EAST, 2: ROTATION.SOUTH, 3: ROTATION.NORTH }
  return map[primary] ?? 0
}
```

---

## 5. Foundation Rules

**Áp dụng khi:** `cell.y === 0`

> **Thứ tự xét: F-2 TRƯỚC, F-1 SAU.** Vì với `y === 0`, `neighbors.bottom` gần như luôn null, nếu xét F-1 trước thì mọi cell đều thành `foundation_solid`, nuốt mất F-2. Quy tắc: "edge wins over interior".

```
CẦN THIẾT: cell ở tầng 0 (y === 0)

RULE F-2 (xét TRƯỚC): foundation_arch — cell rìa cụm
  Điều kiện: y === 0 VÀ countHorizontalNeighbors(neighbors) < 4
  Tức là: ít nhất 1 hướng ngang không có neighbor
  → assetType = "foundation_arch"
  → rotation = calcRotationFromOpenDir(openDirections)
              (xoay vòm về phía không có neighbor)

RULE F-1 (xét SAU): foundation_solid — cell interior hoàn toàn
  Điều kiện: y === 0 VÀ countHorizontalNeighbors(neighbors) === 4
  Tức là: cả 4 phía ngang đều có neighbor
  → assetType = "foundation_solid"
  → rotation = 0

RULE F-DEFAULT:
  Fallback khi không match → "foundation_arch", rotation = 0
  (Bình thường không bao giờ chạy vào đây vì F-2 cover hết case < 4)
```

**Ví dụ:**
- Cell đơn lẻ tại (0,0,0): count=0 → F-2 → `foundation_arch`, rotation=0
- Cell (1,0,0) với left≠null, right≠null, front=null, back=null: count=2 → F-2 → `foundation_arch` (vòm về front)
- Cell interior hoàn toàn bao quanh 4 phía: count=4 → F-1 → `foundation_solid`

**Implementation flow:**
```js
function resolveFoundation(cell, neighbors) {
  const open = getOpenDirections(neighbors)
  if (open.length > 0) {  // F-2 trước
    return { assetType: 'foundation_arch', rotation: calcRotationFromOpenDir(open) }
  }
  return { assetType: 'foundation_solid', rotation: 0 }  // F-1 sau
}
```

---

## 6. Wall Rules

**Áp dụng khi:** cell KHÔNG phải foundation VÀ KHÔNG phải roof

```
CẦN THIẾT: (y > 0 HOẶC có top neighbor) VÀ có neighbors.top !== null
→ Tức là cell đang ở giữa stack (không phải đỉnh)

RULE W-1: wall_corner
  Điều kiện: 2 neighbor ngang LIỀN KỀ nhau (không phải đối diện)
  Ví dụ: left≠null VÀ front≠null (góc TL)
         left≠null VÀ back≠null  (góc BL)
         right≠null VÀ front≠null (góc TR)
         right≠null VÀ back≠null  (góc BR)
  → assetType = "wall_corner"
  → rotation = góc của corner (hướng ra phía ngoài)

RULE W-2: wall_window (deterministic ~40%)
  Điều kiện: y > 0 VÀ là mặt ngoài (≥1 hướng ngang trống)
  VÀ cellHash(cell.id) % 10 < 4
  → assetType = "wall_window"
  → rotation = calcRotationFromOpenDir(openDirections)

  // KHÔNG dùng Math.random() — phải deterministic để reload ra y chang
  // cellHash là hàm hash đơn giản của chuỗi cell.id ("x_y_z")
  // Cùng cell.id → luôn cùng kết quả, dù chạy bao nhiêu lần

RULE W-DEFAULT: wall_flat
  Khi không match W-1 hoặc W-2
  → assetType = "wall_flat"
  → rotation = calcRotationFromOpenDir(openDirections) hoặc 0
```

**Corner detection:**
```js
function isCorner(neighbors) {
  const pairs = [
    [neighbors.left, neighbors.front],
    [neighbors.left, neighbors.back],
    [neighbors.right, neighbors.front],
    [neighbors.right, neighbors.back],
  ]
  return pairs.some(([a, b]) => a !== null && b !== null)
}
```

**Corner rotation:**
```js
// Xoay về hướng "ra ngoài" của góc (hướng không có neighbor)
function calcCornerRotation(neighbors) {
  if (!neighbors.left  && !neighbors.front) return ROTATION.NORTH  // góc right-back
  if (!neighbors.left  && !neighbors.back)  return ROTATION.EAST   // góc right-front
  if (!neighbors.right && !neighbors.front) return ROTATION.WEST   // góc left-back
  if (!neighbors.right && !neighbors.back)  return ROTATION.SOUTH  // góc left-front
  return 0
}
```

---

## 7. Roof Rules

**Áp dụng khi:** `neighbors.top === null` (không có cell trên → đây là đỉnh)

```
Đếm số neighbor ngang: N = countHorizontalNeighbors(neighbors)

N = 0: cell đơn lẻ không có neighbor ngang
  → assetType = "roof_peak"
  → rotation = 0

N = 1: chỉ có 1 neighbor ngang (đầu hồi)
  → assetType = "roof_peak"
  → rotation = calcRotationFromOpenDir(openDirections)
              (đỉnh nhọn hướng về phía trống)

N = 2, đối diện nhau (left+right HOẶC front+back):
  → assetType = "roof_gable"
  → rotation: left+right → NORTH (0), front+back → EAST (π/2)

N = 2, liền kề nhau (góc):
  → assetType = "roof_hip_corner"
  → rotation = calcCornerRotation(neighbors)

N = 3: ngã ba
  → assetType = "roof_t_junction"
  → rotation = hướng về phía neighbor đơn lẻ

N = 4: tất cả 4 hướng đều có neighbor
  → assetType = "roof_flat"
  → rotation = 0
```

**Kiểm tra "2 đối diện":**
```js
function isOpposite(neighbors) {
  const LR = neighbors.left !== null && neighbors.right !== null
  const FB = neighbors.front !== null && neighbors.back !== null
  const count = countHorizontalNeighbors(neighbors)
  return count === 2 && (LR || FB)
}
```

**T-junction rotation:**
```js
// Xoay về phía neighbor ĐƠN LẺ (side của T)
function calcTJunctionRotation(neighbors) {
  if (!neighbors.left)  return ROTATION.WEST   // mở về left
  if (!neighbors.right) return ROTATION.EAST   // mở về right
  if (!neighbors.front) return ROTATION.SOUTH  // mở về front
  if (!neighbors.back)  return ROTATION.NORTH  // mở về back
  return 0
}
```

---

## 8. Bridge Rules — DERIVED VISUAL OVERLAY

> **Quyết định kiến trúc (chốt MVP):** Bridge là **DERIVED OVERLAY**, không phải real cell.
>
> **Lý do:** Nếu bridge là cell thật, nó tham gia topology, neighbor lookup, undo/redo, save/load như block thường → side effects phức tạp, save file phình to, migration khó. Với derived overlay, `cells[]` chỉ gồm block do người chơi đặt, bridge regenerate từ logic sau mỗi resolve, không lưu vào save file.

**Bridge là gì trong kiến trúc:**
- Bridge KHÔNG có entry trong `GridManager` (không phải Cell)
- Bridge là `THREE.Object3D` riêng, lưu trong `BuildController._bridgeMeshes: Map<string, THREE.Object3D>`
- Key trong map: `"${x1}_${y}_${z1}__${x2}_${y}_${z2}"` (sorted)
- Bridge được rebuild hoàn toàn sau mỗi build/delete action

**Thuật toán:** Chạy sau MỖI build/delete action trong `BuildController._detectAndRenderBridges()`.

```
BƯỚC 1 — Clear all bridges
  BuildController._bridgeMeshes.forEach(mesh => scene.remove(mesh))
  BuildController._bridgeMeshes.clear()

BƯỚC 2 — Connected Components (trên logical cells, không tính bridge)
  Tìm tất cả "cụm" cell trong GridManager.
  Hai cell thuộc cùng cụm: có neighbor ngang trực tiếp (x±1 hoặc z±1) ở cùng độ cao Y.
  Dùng BFS/DFS.

BƯỚC 3 — Bridge Opportunity Scan
  Với mỗi cặp cụm (A, B):
  Tìm cặp (cellA ∈ A, cellB ∈ B) thỏa:
    - Cùng độ cao Y
    - Cách nhau đúng 2 đơn vị theo X: |cellA.x - cellB.x| === 2, cellA.z === cellB.z
      VÀ GridManager.getCell(midX, y, z) === null
    - HOẶC cách nhau đúng 2 đơn vị theo Z: |cellA.z - cellB.z| === 2, cellA.x === cellB.x
      VÀ GridManager.getCell(x, y, midZ) === null

BƯỚC 4 — Render Bridge Mesh
  Với mỗi BridgeSpec:
  → AssetManager.get('bridge_span') → clone mesh
  → Đặt tại world position của ô trống giữa
  → rotation: bridge theo X → NORTH (0), bridge theo Z → EAST (π/2)
  → scene.add(mesh)
  → _bridgeMeshes.set(key, mesh)
```

**Giới hạn:**
- Bridge chỉ sinh khi khoảng cách = 2 cells (1 ô trống ở giữa)
- Bridge KHÔNG sinh khi khoảng cách > 2
- Bridge KHÔNG sinh khi ô giữa đã có cell
- Bridge KHÔNG ảnh hưởng đến neighbor lookup của các cell thường
- Bridge KHÔNG xuất hiện trong save file

---

## 9. Full Resolution Flow

```js
// ProceduralRuleEngine.resolve(cell, neighbors)
function resolve(cell, neighbors) {
  // 1. Foundation check
  if (cell.y === 0) {
    return resolveFoundation(cell, neighbors)
  }

  // 2. Roof check (không có top neighbor)
  if (!neighbors.top) {
    return resolveRoof(cell, neighbors)
  }

  // 3. Wall (mọi trường hợp còn lại)
  return resolveWall(cell, neighbors)
}
```

---

## 10. Test Cases tham chiếu

| Input | Neighbors | Expected |
|-------|-----------|---------|
| Đơn lẻ (0,0,0) | all null | `foundation_arch`, rotation về phía nào cũng được |
| Cột 3 tầng: (0,0,0) | all null | `foundation_arch` |
| Cột 3 tầng: (0,1,0) | top≠null, bottom≠null, rest null | `wall_flat` |
| Cột 3 tầng: (0,2,0) | top=null, bottom≠null, rest null | `roof_peak` |
| 2x2 tại tầng 0 | mỗi cell có 2 neighbor ngang | `foundation_arch` (rìa có trống) |
| 2x2 tại tầng 1 (đỉnh) | 2 neighbor ngang liền kề | `roof_hip_corner` |
| Dải ngang 3 cell, cell giữa | left≠null, right≠null, top=null | `roof_gable` |
| 2 cell cách 1 ô (bridge test) | — | bridge_span sinh ra ở ô giữa |

---

## 11. Edge Cases & Fallbacks

| Trường hợp | Xử lý |
|-----------|-------|
| Cell y=0 có bottom neighbor | Không thể xảy ra theo GridManager logic — luôn stack lên |
| cell không có neighbors nào | `foundation_arch`, rotation=0 |
| Wall ở y=0 (có top neighbor) | Vẫn apply Wall rules, không override thành Foundation |
| Roof với 2 neighbor đối diện VÀ liền kề | Không thể — phải là N=4 (roof_flat) |
| Bridge hai đầu cùng màu | Dùng màu đó |
| Bridge hai đầu khác màu | Dùng màu của cell được xây sau |
| GLB không tìm thấy | AssetManager fallback → `_fallback_cube` |

---

## 12. Determinism Guarantee

```
RuleEngine là DETERMINISTIC hoàn toàn.
Cùng (cell, neighbors) → LUÔN ra cùng (assetType, rotation), không ngoại lệ.

wall_window dùng deterministic hash:
  cellHash("x_y_z") % 10 < 4
  → Cùng cell.id → luôn cùng kết quả → test stable, reload identical
  → KHÔNG dùng Math.random()
```

**cellHash implementation (djb2 lite):**
```js
function cellHash(cellId) {
  // djb2 hash đơn giản — đủ dùng cho phân bố 40%
  let hash = 5381
  for (let i = 0; i < cellId.length; i++) {
    hash = ((hash << 5) + hash) + cellId.charCodeAt(i)
    hash = hash & hash  // convert to 32-bit int
  }
  return Math.abs(hash)
}

// Dùng:
// wall_window khi: cellHash(cell.id) % 10 < 4
// Phân bố ~40%, deterministic, không cần seed
```
