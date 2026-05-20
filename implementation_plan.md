# Kế hoạch Triển khai Graphic2.md — Game Feel Upgrade

Phân tích tài liệu `Graphic2.md` và đề xuất nâng cấp cảm giác tương tác (Game Feel) cho Coastlet Builder v0.2, theo đúng kiến trúc Vanilla JS/ES Modules hiện tại. Kế hoạch này tuân thủ 10 nguyên tắc khắt khe về kiến trúc và thuật ngữ từ đợt review.

---

## Trạng thái đồ họa hiện tại (Đã hoàn thành)

| Kỹ thuật từ Graphic2.md | Trạng thái |
|---|---|
| PCFSoftShadowMap + Shadow Bias | ✅ `SceneManager.js` |
| SSAO + UnrealBloom + FXAA Pipeline | ✅ `PostProcessing.js` |
| ACESFilmicToneMapping + sRGB | ✅ `SceneManager.js` |
| HemisphereLight + DirectionalLight + AmbientLight | ✅ `SceneManager.js` |
| MeshStandardMaterial PBR (roughness/metalness) | ✅ `AssetManager.js` |
| Dynamic Water Shader (waves + fresnel + foam) | ✅ `WaterPlane.js` |
| Scale-in/out animation cơ bản (0→1, 1→0) | ✅ `BuildController.js` + `RenderLoop.js` |
| Vertex Coloring (đổi màu cell runtime) | ✅ `BuildController._applyColor()` |
| castShadow/receiveShadow trên mọi mesh | ✅ `AssetManager.js` |

## Lộ trình triển khai & Scope (Gate Control)

| Phase | Kỹ thuật | Điều kiện bắt đầu (Gate) |
|---|---|---|
| **Phase A** | **Squash & Stretch Animation** | `BuildController` animation hiện tại đang hoạt động. |
| **Phase B** | **Particle System (Pooling)** | `RenderLoop` có `delta` truyền qua frame, Phase A test pass. |
| **Phase C** | **Seeded Façade Variation** | `ProceduralRuleEngine` và tests tồn tại, Phase B test pass. |
| **Backlog** | **InstancedMesh & WFC thật** | Tạm hoãn. Mesh management tập trung tại `BuildController` để dự phòng. |

---

## Phase A — Squash & Stretch Animation (ĐÃ DUYỆT)

Nâng cấp hiệu ứng xây/phá từ scale tuyến tính sang chuỗi animation đàn hồi 3 nhịp.

### [MODIFY] `src/renderer/engine/RenderLoop.js`

Mở rộng Mini Tween Engine hiện tại, giữ nguyên kiến trúc độc lập (Không GSAP):
- **Timeline/Chaining:** Thêm method `addTweenSequence(steps[])`. Nó sẽ đệ quy gọi `addTween` cho từng bước nối tiếp nhau thông qua `onComplete`. Target trực tiếp là `{x, y, z}`.
- **Easing mới:** Thêm `elasticOut`, `power2Out`, `power2In`, `power2InOut` vào `easingFn()`.
- **Callbacks:** Bổ sung gọi `tween.onStep(currentValues)` trong `processTweens` mỗi frame.

### [MODIFY] `src/renderer/game/BuildController.js`

- Thay thế `RenderLoop.addTween` bằng `RenderLoop.addTweenSequence`.
- **`_spawnMesh()`:**
  1. `{x:0, y:0, z:0}` → `{x:1.2, y:0.7, z:1.2}` (120ms, `power2Out`)
  2. `{x:1.2, y:0.7, z:1.2}` → `{x:0.9, y:1.15, z:0.9}` (100ms, `power2InOut`)
  3. `{x:0.9, y:1.15, z:0.9}` → `{x:1, y:1, z:1}` (120ms, `elasticOut`)
- **`_removeMesh()`:**
  1. `from: current_scale` → `{x:1.15, y:0.85, z:1.15}` (80ms, `power2Out`)
  2. `{x:1.15, y:0.85, z:1.15}` → `{x:0, y:0, z:0}` (120ms, `power2In`, trigger `dispose()`)

---

## Phase B — Particle System (Pooling) (CHỜ SAU PHASE A)

### [NEW] `src/renderer/engine/ParticleSystem.js`

**Kiến trúc Pool Memory-safe:**
- `init(scene)`: Tạo 1 `BufferGeometry` dùng chung. Dòng for tạo 50-80 `THREE.Mesh`, mỗi mesh clone 1 `MeshBasicMaterial` riêng (để chỉnh opacity độc lập). Toàn bộ để `visible = false` và push vào pool array.
- `spawnDust({ position, color, count })`: Nhận `position` là tọa độ thế giới (world coordinate, không phải grid x,y,z). Lọc ra `count` mesh trống trong pool, gắn pos, random velocity, opacity 1, `visible = true`.
- `update(deltaTime)`: Giảm lifetime/opacity, di chuyển theo velocity, trả về pool khi hết life. Không tạo/dispose object runtime.

---

## Phase C — Seeded Façade Variation (CHỜ SAU PHASE B)

**Kiến trúc Deterministic (Không `Math.random()`):**
- Tính toán topology signature rõ ràng, ví dụ `T1_BT1_L0_R0_F1_BK0` (Top, Bottom, Left, Right, Front, Back).
- `_facadeHash(cell.id, topologySignature)` băm ra một số nguyên cố định.
- **Weighted Variation:** Thay vì modulo đều, dùng tỷ lệ phần trăm (60% `wall_flat`, 40% `wall_window`).
- Chỉ trả về các asset ĐÃ CÓ trong `AssetRegistry` (`wall_flat`, `wall_window`, `wall_corner`).

---

## Verification Plan

### Automated Tests
- `npm run test`: All existing tests must pass.
- Bổ sung unit test cho tính deterministic (Phase C).

### Manual Verification
- **Phase A:** Verify animation squash & stretch.
- **Phase B:** Verify hạt bụi mượt, Memory tab không leak/tăng heap.
- **Phase C:** Xây tường, kiểm tra tỷ lệ 60/40, Undo/Redo kiến trúc không đổi.
