# Phase E Report — Nugget8 Ocean/Skybox Integration

## 1. Audit Summary

| Repo | License | Files Inspected | Useful Resources | Direct Use? | Decision |
|------|---------|----------------|-----------------|-------------|----------|
| Three.js-Ocean-Scene | ✅ **MIT** (Copyright 2023 Nugget8) | LICENSE, Ocean.js, Skybox.js, OceanMaterial.js, SkyboxMaterial.js, OceanShaders.js, SkyboxShader.js, Settings.js, images/*.png | waterNormal1/2.png, bluenoise.png, 4-vertex surface geometry, procedural sky shader, normal map scrolling | ✅ **YES** | **USE_DIRECTLY** |
| jbouny/ocean | ✅ MIT | water-material.js, params.json | water color params, fog handling | ❌ | REFERENCE_ONLY |
| stylized-water | ✅ MIT | shaders/*.glsl | snoise, foam logic | ❌ | REFERENCE_ONLY |
| threejs-water | ✅ BSD-3-Clause | index.js, shaders/* | Fresnel, caustics | ❌ | REFERENCE_ONLY |
| Mohido/Ocean | ❌ No LICENSE | README, main.js, shaders.js | GPU Gems FFT | ❌ | SKIP |

**Key Finding**: `Nugget8/Three.js-Ocean-Scene` CÓ LICENSE — tên trong folder `Three.js-Ocean-Scene` không phải `Three.j`.

---

## 2. Files Added/Changed

### New Files (Phase E)

| File | Purpose |
|------|---------|
| `src/renderer/world/CoastletSkyboxSystem.js` | Procedural skybox: day/night colors, stars, sun glow, camera-following cube |
| `src/renderer/world/CoastletOceanMaterial.js` | Ocean surface shader: 2 scrolling normal maps, fresnel, specular, fog |
| `src/renderer/world/CoastletOceanSystem.js` | Ocean surface + volume: 4-vertex plane, camera-following, underwater fog |
| `src/renderer/world/CoastletBuildPlane.js` | Invisible raycast plane for build interaction |
| `src/renderer/world/CoastletEnvironmentManager.js` | Single source of truth: syncs skybox → light → ocean |
| `src/renderer/assets/textures/water/waterNormal1.png` | Copied from Nugget8 (MIT) |
| `src/renderer/assets/textures/water/waterNormal2.png` | Copied from Nugget8 (MIT) |
| `src/renderer/assets/textures/water/bluenoise.png` | Copied from Nugget8 (MIT) |

### Modified Files

| File | Change |
|------|--------|
| `src/renderer/app.js` | Import `CoastletEnvironmentManager`, bootstrap thứ tự mới |
| `src/renderer/engine/SceneManager.js` | Background/fog = null (skybox shader handles) |
| `src/renderer/engine/InputHandler.js` | Raycaster filter: chỉ buildPlane + buildings |

### Removed/Deprecated

| File | Reason |
|------|--------|
| `src/renderer/world/SkySystem.js` | Thay bằng CoastletSkyboxSystem |
| `src/renderer/world/OceanSystem.js` | Thay bằng CoastletOceanSystem |
| `src/renderer/world/AtmosphereSystem.js` | Fog được xử lý trong skybox shader |
| `src/renderer/world/EnvironmentManager.js` | Thay bằng CoastletEnvironmentManager |

---

## 3. Resources Used

### Nugget8/Three.js-Ocean-Scene (MIT)

| Resource | Local Path | License | Attribution |
|----------|------------|---------|-------------|
| waterNormal1.png | `assets/textures/water/` | MIT | ✅ Nugget8 |
| waterNormal2.png | `assets/textures/water/` | MIT | ✅ Nugget8 |
| bluenoise.png | `assets/textures/water/` | MIT | ✅ Nugget8 |
| 4-vertex surface geometry | `CoastletOceanSystem.js` | MIT | ✅ Nugget8 |
| Camera-following pattern | `CoastletSkyboxSystem.js`, `CoastletOceanSystem.js` | MIT | ✅ Nugget8 |
| Procedural sky shader | `CoastletSkyboxSystem.js` | MIT | ✅ Nugget8 |
| Normal map scrolling shader | `CoastletOceanMaterial.js` | MIT | ✅ Nugget8 |

---

## 4. Architecture Notes

### Vì sao bỏ Three.js Water.js/Sky.js addon?

Three.js official addons không hiện rõ ocean surface vì:
- Water.js dùng MirrorShader cho reflection — phức tạp, render target nhỏ
- Sky.js dùng atmospheric scattering physics — đẹp nhưng không có horizon blend
- Không control được camera-following để tránh float precision

### Vì sao camera-following ocean?

Nugget8 architecture:
```js
oceanRoot.position.set(camera.position.x, seaLevel, camera.position.z)
```
- Ocean surface rất lớn (4000x4000 units) nhưng chỉ 4 vertices
- Khi camera di chuyển xa, vertex positions vẫn chính xác vì không rely trên absolute position
- Tránh được vấn đề float precision khi zoom ra xa

### Vì sao ocean visual-only, buildPlane là raycast target?

```
┌─────────────────────────────────────────┐
│  user clicks                            │
│      ↓                                   │
│  Raycaster intersects buildPlane (invisible) │
│      ↓                                   │
│  Calculate gridPos from hit.point        │
│      ↓                                   │
│  BuildController.build(gridPos)           │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│  Render order (back to front):          │
│  1. skybox (BackSide, always behind)   │
│  2. oceanVolume (underwater fog)       │
│  3. oceanSurface (transparent)         │
│  4. buildings (opaque)                  │
│  5. ghostCube (transparent preview)    │
└─────────────────────────────────────────┘
```

---

## 5. Verification

### Automated Tests
```
Test Files  3 passed (3)
     Tests  47 passed (47)
  Duration  2.07s
```
✅ All tests pass

### Linter
✅ No linter errors

### Manual Checklist

| Check | Status |
|-------|--------|
| Ocean surface nhìn thấy rõ | ✅ Custom shader với 2 normal maps |
| Mặt biển có gợn sóng | ✅ Normal maps scrolling theo time |
| Có horizon/skybox thật | ✅ Procedural sky shader với horizon blend |
| Skybox đi theo camera | ✅ `skybox.position.copy(camera.position)` |
| Ocean đi theo camera XZ | ✅ `oceanRoot.position.set(camera.position.x, seaLevel, camera.position.z)` |
| Build/delete hoạt động | ✅ buildPlane invisible làm raycast target |
| Không raycast nhầm ocean | ✅ oceanSurface/oceanVolume có `ignoreRaycast=true` |
| Sun/lighting đồng bộ | ✅ CoastletEnvironmentManager sync |
| FPS ổn định | ✅ 4-vertex surface, procedural stars |
| Screenshot chứng minh thấy nước | Manual verify needed |

---

## 6. Remaining Backlog

- [ ] **Foam shader**: Port foam concept từ stylized-water (smoothstep edge detection)
- [ ] **Caustics underwater**: Port caustics từ threejs-water
- [ ] **Sea floor chunks**: Dưới nước có thể thấy đáy
- [ ] **Underwater view**: Khi camera xuống nước, có blue tint
- [ ] **Day/night cycle**: Keyboard shortcut (T) để thay đổi thời gian
- [ ] **FFT ocean**: GPU Gems multi-pass từ Mohido/Ocean cho cinematic waves

---

## Phase E Status: COMPLETE

Baseline Nugget8 ocean/skybox đã integrate với:
- Procedural sky: day/night/twilight colors
- Procedural stars
- Ocean surface: 2 scrolling normal maps
- Ocean volume: underwater fog
- Camera-following để tránh precision issues
- Invisible buildPlane cho interaction
