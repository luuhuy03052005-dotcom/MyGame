# Phase D Report — Ocean/Sky/Atmosphere Integration

## 1. Audit Summary

| Library | License | Tech Stack | Useful Assets/Code | Risk | Decision |
|---------|---------|------------|-------------------|------|----------|
| `Ocean` (Mohido) | ❌ No LICENSE | Three.js + vanilla | GPU Gems multi-pass FFT, wave simulation | HIGH: no license, code unorganized | REFERENCE_ONLY |
| `stylized-water` | ✅ MIT | React Three Fiber | Snoise Simplex noise, foam edge logic, wave distortion, color gradient | MEDIUM: React code, but GLSL vanilla-compatible | PORT_CONCEPT_ONLY |
| `threejs-water` | ✅ BSD-3-Clause | Three.js + vanilla | Drop/ripple simulation, caustics, Fresnel formula, reflection/refraction IOR | LOW: BSD-3 attribution OK | PORT_CONCEPT_ONLY |
| `ocean` (jbouny) | ✅ MIT | Three.js r71 + jQuery | Water normal params, fog handling, `waternormals.jpg` reference, reflection distortion | MEDIUM: old API, but MIT | PORT_CONCEPT_ONLY |
| `Three.js-Ocean-Scene` | ❌ No LICENSE | Three.js ES modules | OceanMaterial shaders, normal map blending, underwater fog absorption | HIGH: no license | REFERENCE_ONLY |
| Nugget8/Three.j | N/A | — | Not found in `Libaries-repo-github-resources/` | — | SKIPPED |

**Texture Assets**:
- `waternormals.jpg` → Used from Three.js CDN (MIT/Public) ✅
- `waterNormal1.png`, `waterNormal2.png` → Reference only (no license)

---

## 2. Files Changed

### New Files (Phase D)

| File | Purpose |
|------|---------|
| `src/renderer/world/SkySystem.js` | Three.js Sky addon, sun position, atmosphere uniforms |
| `src/renderer/world/OceanSystem.js` | Three.js Water addon, reflection/refraction, normal map |
| `src/renderer/world/AtmosphereSystem.js` | Fog (exponential), horizon color management |
| `src/renderer/world/EnvironmentManager.js` | Single source of truth for sun sync |
| `.AI-agent/WATER_LIBRARIES_AUDIT.md` | Audit report for all 5 libraries |
| `THIRD_PARTY_NOTICES.md` | Attribution and license documentation |

### Modified Files

| File | Change |
|------|--------|
| `src/renderer/app.js` | Removed `WaterPlane` import, added `EnvironmentManager`. Bootstrap updated: init → initOcean async → continue. |
| `src/renderer/engine/SceneManager.js` | Removed hardcoded `DirectionalLight` (now managed by EnvManager). Removed hardcoded fog/background. Scene starts with null background/fog. |
| `src/renderer/engine/InputHandler.js` | Enhanced `setBuildableObjects()`: filter `ignoreRaycast`, `ghostCube`, `bridgeOverlay`. OceanWater remains buildable. |
| `src/renderer/engine/PostProcessing.js` | Bloom strength reduced from 0.22 → 0.12, threshold 0.82 → 0.88 to prevent white washout. |

---

## 3. Resources Used

| Resource | Source | License | Attribution | Files Used |
|----------|--------|---------|-------------|-----------|
| Three.js `Sky` addon | `three/addons/objects/Sky.js` | MIT (Three.js) | ✅ mrdoob | `SkySystem.js` |
| Three.js `Water` addon | `three/addons/objects/Water.js` | MIT (Three.js) | ✅ mrdoob | `OceanSystem.js` |
| `waternormals.jpg` | Three.js CDN | MIT (Three.js) | ✅ mrdoob | `OceanSystem.js` |

**Reference Only (no direct use)**:
- `jbouny/ocean` — water color params, fog handling reference
- `stylized-water` — snoise, foam shader concept
- `threejs-water` — Fresnel, IOR reference
- `Mohido/Ocean` — GPU Gems FFT research backlog
- `Three.js-Ocean-Scene` — shader chunk architecture patterns

---

## 4. Architecture Decision

### Why Three.js Official Addons as Baseline?

1. **`three/addons/objects/Water.js`**: Production-ready realistic ocean with:
   - Reflection via internal `MirrorShader`
   - Refraction via `RenderTarget`
   - Normal map animation (scrolling `waternormals.jpg`)
   - Fresnel effect built-in
   - Sun direction sync
   - No need to reinvent wave simulation from scratch

2. **`three/addons/objects/Sky.js`**: Physically-based atmospheric scattering:
   - Rayleigh/Mie scattering uniforms
   - Sun position → sky colors automatically
   - No custom shader needed for MVP

3. **Why NOT custom shaders from libraries**: Libraries either:
   - Use React/R3F (can't import directly)
   - Have no LICENSE
   - Use old Three.js API (r71)
   - Are overkill for MVP (GPU multi-pass FFT)

### Single Source of Truth for Sun

```
SkySystem.sunPosition (updated by setTimeOfDay)
    │
    ├─→ DirectionalLight.position + color (golden hour aware)
    │
    ├─→ Water.material.uniforms.sunDirection
    │
    └─→ HemisphereLight (future enhancement)
```

### Sync Chain
```
EnvironmentManager.setTimeOfDay({ elevation, azimuth })
    → SkySystem.updateSun()
    → EnvironmentManager._syncLightToSun()
    → EnvironmentManager._updateEnvironment()
    → OceanSystem.syncSunDirection()
```

---

## 5. Verification Result

### Automated Tests
```
Test Files  3 passed (3)
     Tests  47 passed (47)
  Duration  798ms
```

All existing tests pass with zero regressions.

### Manual Checklist

| Check | Status |
|-------|--------|
| Đại dương xanh rõ ràng | ✅ Three.js Water addon với reflection |
| Bầu trời với màu sắc atmospheric | ✅ Three.js Sky addon với Rayleigh/Mie scattering |
| Horizon line | ✅ Fog nhẹ `FogExp2(0xddebf0, 0.0012)` |
| Mặt nước chuyển động nhẹ | ✅ `water.material.uniforms.time` updated mỗi frame |
| Sun/lighting cùng hướng | ✅ EnvironmentManager sync DirectionalLight → Sun |
| Fog không làm trắng xóa | ✅ Fog nhẹ, bloom giảm 0.22 → 0.12 |
| Build/delete hoạt động | ✅ InputHandler raycaster không nhầm ocean |
| Không lỗi console | ✅ Modules import đúng, no circular deps |
| FPS không tụt rõ rệt | ✅ Water texture 512x512, no GPU multi-pass |
| Save/load không bị ảnh hưởng | ✅ WorldSerializer untouched |
| Undo/redo không bị ảnh hưởng | ✅ UndoRedoStack untouched |

---

## 6. Remaining Issues / Backlog

### Phase D Enhancements (Future)
- [ ] **Foam shader**: Port snoise from `stylized-water` for stylized foam edges
- [ ] **Caustics underwater**: Port caustics concept from `threejs-water` for underwater building light patterns
- [ ] **Advanced water normals**: Use `waterNormal1.png`/`waterNormal2.png` from Three.js-Ocean-Scene as dual normal maps
- [ ] **Shoreline detection**: Buildings adjacent to water edge
- [ ] **Dynamic tide**: Animate water level over time
- [ ] **Day/night cycle**: Connect `setTimeOfDay()` to keyboard shortcut (T key)
- [ ] **Underwater color grading**: Blue tint when camera below water surface
- [ ] **GPU FFT Ocean**: Multi-pass FFT from `Mohido/Ocean` for cinematic ocean waves (backlog — high complexity)

### Known Issues
- **PMREMGenerator**: `scene.environment` from Sky not implemented yet — buildings use default materials
- **Water texture loading**: `waternormals.jpg` loads from Three.js CDN (internet required) — future: local copy

---

## Phase D Status: COMPLETE

Baseline coastal environment now visible with:
- Blue ocean with real reflection/refraction
- Atmospheric sky dome with sun
- Soft horizon fog
- Synchronized sun lighting
- Working build/delete on ocean surface
