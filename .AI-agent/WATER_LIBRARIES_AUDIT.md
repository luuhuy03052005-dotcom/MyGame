# Water Libraries Audit — Phase D

## Audit Summary

| Library | License | Tech Stack | Useful Assets/Code | Risk | Decision |
|---------|---------|------------|-------------------|------|----------|
| `Ocean` (Mohido) | No LICENSE found | Three.js + vanilla | GPU Gems Ch.1 wave simulation, multi-pass FFT, skybox reference | HIGH: no license, code unorganized, GPU multi-pass overkill for MVP | REFERENCE_ONLY |
| `stylized-water` | MIT | React Three Fiber | Snoise function, foam edge logic, wave distortion, color gradient shader concepts | MEDIUM: React code, but GLSL is vanilla-compatible, snoise is reference-quality | PORT_CONCEPT_ONLY (snoise/foam) |
| `threejs-water` | BSD-3-Clause | Three.js + vanilla | Water simulation (drop/ripple), caustics idea, cube skybox, `water.png` texture | LOW: BSD-3 license OK with attribution | PORT_CONCEPT_ONLY (caustics, texture reference) |
| `ocean` (jbouny) | MIT | Three.js r71 + jQuery | Realistic plane water params, reflection distortion, fog handling, `waternormals.jpg` texture, skybox images | MEDIUM: Old Three.js r71, jQuery present, but MIT license, params/textures usable with attribution | PORT_CONCEPT_ONLY (params, textures) |
| `Three.js-Ocean-Scene` | No LICENSE found | Three.js ES modules | OceanMaterial.js (surface/volume/object shaders), normal map blending, underwater fog absorption, `waterNormal1.png`, `waterNormal2.png`, SkyboxMaterial | HIGH: no license, but ES modules architecture comparable to our project | REFERENCE_ONLY (architecture patterns) |

## Detailed Findings

### 1. `Ocean` (Mohido/Ocean) — REFERENCE_ONLY

**Missing LICENSE.** Cannot use directly.

- Multi-pass GPU ocean simulation (FFT-based, GPU Gems Ch.1)
- 3 render passes: wave positions/normals → final render → normal/position map viewer
- Very impressive visual but completely overkill for MVP
- Code is explicitly marked "unorganized"
- **Conclusion**: Use for advanced ocean research backlog only.

### 2. `stylized-water` (thaslle/stylized-water) — PORT_CONCEPT_ONLY

**License**: MIT ✅

**Tech**: React Three Fiber, but GLSL shaders are framework-agnostic.

- **Snoise function** (lines 8-39): High-quality Simplex noise implementation — reference-quality, can port to vanilla JS.
- **Foam edge logic**: `smoothstep(0.08, 0.001, colorBase)` pattern for stylized foam — can port.
- **Wave distortion**: UV-based wave thresholding with oscillating threshold — concept can port.
- **Color gradient**: Near/far color mixing based on distance — portable concept.
- **NOT porting**: React components, R3F hooks, CSS.
- **Files usable as reference**: `src/components/Water/shaders/vertex.glsl`, `src/components/Water/shaders/fragment.glsl`
- **Must attribute**: MIT license, author Thalles (thaslle)

### 3. `threejs-water` (martinrenou/threejs-water) — PORT_CONCEPT_ONLY

**License**: BSD-3-Clause ✅ (requires attribution)

**Tech**: Three.js + vanilla, old API but compatible.

- **WaterSimulation class**: Drop/ripple simulation using render targets — interesting for interactive water.
- **Caustics class**: Light caustics computation on pool geometry — concept can inspire future work.
- **Water class**: Reflection/refraction with IOR, Fresnel — good reference for water optics.
- **Fresnel formula**: `mix(0.25, 1.0, pow(1.0 - dot(normal, -incomingRay), 3.0))` — standard pattern, usable.
- **Files usable as reference**: `index.js` (architecture), `shaders/water/fragment.glsl`
- **Textures**: `water.png` (pool tiles), skybox cube images
- **Must attribute**: BSD-3-Clause, author Martin Renou

### 4. `ocean` (jbouny/ocean) — PORT_CONCEPT_ONLY

**License**: MIT ✅

**Tech**: Three.js r71 + jQuery. Old but MIT license OK.

- **Realistic wave parameters**: Gerstner wave math, time-based displacement.
- **Fog handling**: Fog exponential falloff on water surface.
- **Reflection distortion**: Normal map scrolling for wave reflection.
- **`waternormals.jpg`**: Used by Three.js official Water addon — this is THE texture to use.
- **Skybox images**: 6-face skybox in `demo_mobile/assets/img/` — NOT using these (will use Sky addon instead).
- **NOT porting**: jQuery code, old Three.js r71 API.
- **Files usable as reference**: `water-material.js`, `params.json`
- **Must attribute**: MIT license, author Jérémy Bouny

### 5. `Three.js-Ocean-Scene` (Nugget8/Three.j equivalent) — REFERENCE_ONLY

**No LICENSE found.** Cannot use directly.

- **OceanMaterial.js**: Surface/volume/object ShaderMaterials using `#include <ocean>` chunks.
- **ShaderChunks pattern**: `#include <common>`, `#include <ocean>`, `#include <skybox>` — interesting modular shader architecture.
- **Normal map blending**: 2 normal maps with velocity offsets (VELOCITY_1, VELOCITY_2) — reference quality.
- **Underwater fog absorption**: `vec3(1.0) / vec3(10.0, 40.0, 100.0)` RGB absorption rates — great reference for future underwater effects.
- **Textures**: `waterNormal1.png`, `waterNormal2.png` — good quality.
- **Skybox shader**: Custom day/night/twilight sky with stars — complex, but Sky addon covers this.
- **Conclusion**: Missing license makes this reference-only. Architecture patterns (ShaderChunks) are noted for future.

### 6. Nugget8/Three.j — SKIPPED

No folder matching "Nugget8", "Three.j", or similar found in `Libaries-repo-github-resources/`.

---

## Decision Matrix

### Direct Use (USE_DIRECTLY)
None — all require either license review or React/R3F migration.

### Port Concept Only (PORT_CONCEPT_ONLY)

| Concept | Source | License | Attribution Required |
|---------|--------|---------|---------------------|
| Snoise Simplex noise | stylized-water | MIT | ✅ Yes (Thalles) |
| Foam edge shader logic | stylized-water | MIT | ✅ Yes (Thalles) |
| Fresnel formula | threejs-water | BSD-3 | ✅ Yes (Martin Renou) |
| Water normal params | jbouny/ocean | MIT | ✅ Yes (Jérémy Bouny) |
| `waternormals.jpg` texture | jbouny/ocean or Three.js CDN | MIT / Public | ✅ Yes (Jérémy Bouny) |

### Reference Only (REFERENCE_ONLY)
- Mohido/Ocean (no license, GPU multi-pass overkill)
- Three.js-Ocean-Scene (no license, architecture patterns noted)

### Skip
- Nugget8/Three.j equivalent — not found

---

## Phase D Implementation Plan

### Baseline (Three.js Official Addons)
1. `SkySystem.js` — Three.js `Sky` addon, single source of truth for sun
2. `OceanSystem.js` — Three.js `Water` addon with `waternormals.jpg` from jbouny/ocean
3. `AtmosphereSystem.js` — Fog (light), no more white haze
4. `EnvironmentManager.js` — Sync sun across Sky/DirectionalLight/Water

### Future Enhancement (after baseline stable)
- Port snoise from stylized-water for stylized foam shader
- Use `waterNormal1.png`/`waterNormal2.png` from Three.js-Ocean-Scene as normal maps for advanced water
- Caustics concept from threejs-water for underwater building effect

---

## Texture Assets Status

| Texture | Source | License | Status |
|---------|--------|---------|--------|
| `waternormals.jpg` | jbouny/ocean or Three.js CDN | MIT / Public | ✅ Use from CDN |
| `waterNormal1.png` | Three.js-Ocean-Scene | No license | ⚠️ Reference only |
| `waterNormal2.png` | Three.js-Ocean-Scene | No license | ⚠️ Reference only |
| `water.png` | threejs-water | BSD-3 | ⚠️ Reference only |
| Skybox images | jbouny/ocean, threejs-water | Various | ❌ Not using (Sky addon handles) |

**Decision**: Use official Three.js CDN for `waternormals.jpg`:
`https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/textures/waternormals.jpg`
(Public domain / Three.js examples license)
