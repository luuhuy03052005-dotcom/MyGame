# Third Party Notices

This file documents all third-party resources used in Coastlet Builder.

---

## Kenney Graphic Kit

- **Source**: Kenney asset kit
- **Local source**: `C:\Users\luuhu\OneDrive\Desktop\Project\Townscraper\Graphic-kit`
- **License**: Creative Commons Zero (CC0)
- **Files used**:
  - `Models/GLB format/*.glb`
  - `Models/GLB format/Textures/colormap.png`
- **Usage**:
  - Stylized modular building assets for Coastlet Builder.
- **Notes**:
  - Integrated as GLB assets through Three.js `GLTFLoader`.

---

## Nugget8 / Three.js-Ocean-Scene (MIT) — PRIMARY SOURCE

- **Source**: https://github.com/Nugget8/Three.js-Ocean-Scene
- **Local path**: `libraries/Three.js-Ocean-Scene`
- **License**: MIT (Copyright 2023 Nugget8)
- **Files used directly**:
  - `images/waterNormal1.png` — copied to `src/renderer/assets/textures/water/`
  - `images/waterNormal2.png` — copied to `src/renderer/assets/textures/water/`
  - `images/bluenoise.png` — copied to `src/renderer/assets/textures/water/`
  - `scene/Ocean.js` — ported ocean geometry concept (4 vertices, 2 triangles surface)
  - `scene/Skybox.js` — ported skybox camera-following pattern
  - `shaders/Settings.js` — ported skybox/ocean shader constants
  - `shaders/SkyboxShader.js` — ported procedural sky shader concept
  - `shaders/OceanShaders.js` — ported ocean surface shader concept
  - `materials/OceanMaterial.js` — ported ocean material setup pattern
  - `materials/SkyboxMaterial.js` — ported skybox material setup pattern
- **Usage in Coastlet Builder**:
  - Custom `CoastletSkyboxSystem.js` — procedural day/night sky with stars
  - Custom `CoastletOceanSystem.js` — ocean surface + volume, camera-following
  - Custom `CoastletOceanMaterial.js` — 2 normal map scrolling, fresnel, specular
  - Custom `CoastletBuildPlane.js` — invisible raycast plane for build interaction
- **Notes**:
  - Code adapted to Coastlet Builder architecture: Vanilla JS ES Modules, current Three.js
  - Textures copied locally under MIT license
  - Architecture patterns (camera-following ocean, ultra-lightweight geometry) adopted

---

## Three.js Core Library

### Three.js (`three`)

- **Source**: https://github.com/mrdoob/three.js
- **License**: MIT
- **Version**: ^0.165.0
- **Usage**: Core 3D engine for scene, camera, renderer, materials, shaders, textures

---

## Other Libraries (Reference Only)

### jbouny/ocean

- **Source**: https://github.com/jbouny/ocean
- **Author**: Jérémy Bouny
- **License**: MIT
- **Usage in Coastlet Builder**: **Reference only** — audited for water color parameters, fog handling
- **Notes**: No code/texture copied. MIT license noted.

### stylized-water

- **Source**: https://github.com/thaslle/stylized-water
- **Author**: Thalles (thaslle)
- **License**: MIT
- **Usage in Coastlet Builder**: **Reference only** — audited for snoise, foam shader logic
- **Notes**: React R3F code not used. Concepts noted for future foam enhancement.

### threejs-water

- **Source**: https://github.com/martinrenou/threejs-water
- **Author**: Martin Renou
- **License**: BSD-3-Clause
- **Usage in Coastlet Builder**: **Reference only** — audited for Fresnel, caustics, IOR
- **Notes**: BSD-3 attribution noted. Code not copied.

### Mohido/Ocean

- **Source**: https://github.com/Mohido/Ocean
- **License**: Not specified (no LICENSE file)
- **Usage in Coastlet Builder**: **Reference only** — GPU Gems FFT research for backlog
- **Notes**: Cannot use due to unclear license. High complexity, overkill for MVP.

---

## Internal Dependencies

### Electron

- **Source**: https://github.com/electron/electron
- **License**: MIT
- **Version**: ^30.0.0

### Vite

- **Source**: https://github.com/vitejs/vite
- **License**: MIT
- **Version**: ^5.2.0

### Lucide Icons

- **Source**: https://github.com/lucide-icons/lucide
- **License**: ISC
- **Version**: ^1.16.0

### Vitest

- **Source**: https://github.com/vitest-dev/vitest
- **License**: MIT
- **Version**: ^1.6.0

### Electron Builder

- **Source**: https://github.com/electron-userland/electron-builder
- **License**: MIT
- **Version**: ^24.13.3
