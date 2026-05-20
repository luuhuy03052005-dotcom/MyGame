Bạn là Senior Three.js Graphics Engineer + Software Architect cho Coastlet Builder.

Hiện trạng: Phase D trước dùng Three.js `Water.js` + `Sky.js` nhưng preview vẫn chưa thấy mặt nước/ocean thật. Scene vẫn giống background xanh nhạt, không có ocean surface rõ ràng, không có horizon/skybox đủ mạnh. Vì vậy cần chuyển sang hướng custom lightweight ocean/sky lấy concept từ các repo local đã tải về trong `libraries/`.

Các repo local cần audit và port có chọn lọc:

* `libraries/Three.js-Ocean-Scene` từ `https://github.com/Nugget8/Three.js-Ocean-Scene`
* `libraries/ocean` từ `https://github.com/jbouny/ocean`
* `libraries/stylized-water` từ `https://github.com/thaslle/stylized-water`
* `libraries/threejs-water` từ `https://github.com/martinRenou/threejs-water`
* `libraries/Ocean` từ `https://github.com/Mohido/Ocean`

## Mục tiêu

Tạo môi trường coastal thật sự cho Coastlet Builder:

* Có ocean surface nhìn thấy rõ.
* Có skybox/horizon rõ.
* Có gợn sóng bằng normal maps.
* Có màu nước xanh ven biển, fresnel, specular nhẹ.
* Có fog/horizon blend nhưng không làm scene trắng xóa.
* Ocean chỉ là visual surface, không làm build target.
* Build/delete vẫn dùng invisible build plane/grid.
* Không phá UI/game feel/undo/redo/save/load.
* Không thêm React, R3F, jQuery, CommonJS.

## Kết luận kiến trúc bắt buộc

Repo ưu tiên số 1 là `Nugget8/Three.js-Ocean-Scene`.

Lý do:

* Có MIT license.
* Có procedural skybox.
* Có ocean surface shader.
* Có ocean volume material.
* Có 2 scrolling normal maps.
* Ocean geometry cực nhẹ, chỉ surface plane + volume box.
* Ocean đi theo camera trên XZ để tránh float precision issue.
* Thiết kế ưu tiên performance/mobile, phù hợp stylized desktop game.

Không được gọi repo Nugget8 là “No LICENSE”. Hãy audit lại license local cho chính xác.

## Bước 1 — Audit local files trước khi code

Inspect repo `libraries/Three.js-Ocean-Scene`:

Các file/folder cần đọc:

* `LICENSE`
* `README.md`
* `scene/Ocean.js`
* `scene/Skybox.js`
* `scene/SeaFloor.js`
* `materials/OceanMaterial.js`
* `materials/SkyboxMaterial.js`
* `shaders/OceanShaders.js`
* `shaders/SkyboxShader.js`
* `shaders/Settings.js`
* `images/waterNormal1.png`
* `images/waterNormal2.png`
* `images/bluenoise.png`
* các image texture khác nếu có

Ghi audit vào:

`.AI-agent/OCEAN_RESOURCE_AUDIT.md`

Bảng audit bắt buộc:

| Repo | License | Files inspected | Useful resources | Direct use? | Decision |
| ---- | ------- | --------------- | ---------------- | ----------- | -------- |

Decision chỉ được:

* `USE_DIRECTLY`
* `PORT_CONCEPT_ONLY`
* `REFERENCE_ONLY`
* `SKIP`

## Bước 2 — Tạo Third-party notices

Tạo hoặc cập nhật:

`THIRD_PARTY_NOTICES.md`

Nếu dùng shader/texture/code từ Nugget8 hoặc repo khác, ghi rõ:

```md
## Nugget8 / Three.js-Ocean-Scene

- Source: https://github.com/Nugget8/Three.js-Ocean-Scene
- Local path: libraries/Three.js-Ocean-Scene
- License: MIT
- Files used:
  - images/waterNormal1.png
  - images/waterNormal2.png
  - images/bluenoise.png
  - shaders/OceanShaders.js concept
  - shaders/SkyboxShader.js concept
- Usage:
  - Ported lightweight ocean surface, ocean volume and procedural skybox concepts into Coastlet Builder.
- Notes:
  - Code adapted to Coastlet Builder architecture, Vanilla JS ES Modules, current Three.js.
```

Nếu chỉ tham khảo ý tưởng mà không copy code/asset, ghi “Reference only”.

## Bước 3 — Tạo kiến trúc mới dựa trên Nugget8

Tạo thư mục:

`src/renderer/world/`

Tạo/cập nhật các file:

```txt
src/renderer/world/
├── CoastletSkyboxSystem.js
├── CoastletOceanSystem.js
├── CoastletOceanMaterial.js
├── CoastletSkyboxMaterial.js
├── CoastletEnvironmentManager.js
└── CoastletBuildPlane.js
```

Không xóa vội module cũ `SkySystem/OceanSystem/EnvironmentManager` nếu đã có. Có thể đổi sang fallback hoặc thay thế có kiểm soát.

## Bước 4 — Port procedural skybox từ Nugget8

Dựa trên:

* `scene/Skybox.js`
* `materials/SkyboxMaterial.js`
* `shaders/SkyboxShader.js`
* `shaders/Settings.js`

Yêu cầu tạo `CoastletSkyboxSystem.js`:

* Dùng cube skybox lớn bao quanh camera.
* Skybox luôn đi theo camera position.
* Port concept 3 gradient:

  * density gradient cho horizon sáng
  * luminosity gradient cho ánh sáng
  * twilight gradient cho dawn/sunset
* Có sun glow.
* Moon/stars có thể để optional/backlog nếu quá phức tạp.
* Có API:

  ```js
  CoastletSkyboxSystem.init(scene, camera)
  CoastletSkyboxSystem.update(deltaTime)
  CoastletSkyboxSystem.getLightDirection()
  CoastletSkyboxSystem.getLightColor()
  CoastletSkyboxSystem.dispose()
  ```
* Không dùng global camera import kiểu repo gốc. Inject `camera` từ app/SceneManager.
* Không dùng global deltaTime import. Nhận `deltaTime` từ RenderLoop.

## Bước 5 — Port ocean surface + volume từ Nugget8

Dựa trên:

* `scene/Ocean.js`
* `materials/OceanMaterial.js`
* `shaders/OceanShaders.js`
* `shaders/Settings.js`
* `images/waterNormal1.png`
* `images/waterNormal2.png`

Yêu cầu tạo `CoastletOceanSystem.js`:

* Ocean gồm 2 mesh:

  1. `oceanSurface`: flat plane ở y = seaLevel
  2. `oceanVolume`: box dưới mặt nước để hỗ trợ underwater/volume fog sau này
* Ocean đi theo camera trên XZ:

  ```js
  oceanRoot.position.set(camera.position.x, seaLevel, camera.position.z)
  ```
* Surface geometry nên rất nhẹ:

  * side length khoảng `3000–4000`
  * 2 triangles / 4 vertices là đủ
* Không dùng PlaneGeometry nhiều segment.
* Không dùng displacement geometry.
* Gợn sóng lấy từ 2 normal maps:

  ```txt
  assets/textures/water/waterNormal1.png
  assets/textures/water/waterNormal2.png
  ```
* Copy texture từ `libraries/Three.js-Ocean-Scene/images/` nếu license OK.
* Set `RepeatWrapping`.
* Surface shader phải có:

  * `_Time`
  * `_NormalMap1`
  * `_NormalMap2`
  * `_DirToLight`
  * `_Light`
  * fog/horizon color
  * fresnel/reflectivity
  * specular
* API:

  ```js
  CoastletOceanSystem.init({ scene, camera, seaLevel, skyboxSystem })
  CoastletOceanSystem.update(deltaTime)
  CoastletOceanSystem.setLightDirection(dir)
  CoastletOceanSystem.getSurface()
  CoastletOceanSystem.dispose()
  ```

Bắt buộc:

```js
oceanSurface.name = 'oceanSurface'
oceanSurface.userData.ignoreRaycast = true
oceanVolume.name = 'oceanVolume'
oceanVolume.userData.ignoreRaycast = true
```

Ocean không được làm build target.

## Bước 6 — Build plane riêng

Tạo `CoastletBuildPlane.js`:

* Invisible plane để click xây.
* Nằm ở `seaLevel` hoặc cao độ logic hiện tại.
* Không ảnh hưởng visual ocean.
* API:

  ```js
  CoastletBuildPlane.init(scene, seaLevel)
  CoastletBuildPlane.getObject()
  CoastletBuildPlane.dispose()
  ```
* Object:

  ```js
  buildPlane.name = 'buildPlane'
  buildPlane.visible = false
  buildPlane.userData.isBuildTarget = true
  buildPlane.userData.ignoreRaycast = false
  ```

Sửa `InputHandler.js`:

* Raycast chỉ vào:

  * `buildPlane`
  * building meshes hợp lệ
* Không raycast vào:

  * `oceanSurface`
  * `oceanVolume`
  * `skybox`
  * particles
  * ghostCube
  * bridgeOverlay
  * UI overlay

## Bước 7 — Tích hợp environment manager

Tạo/cập nhật `CoastletEnvironmentManager.js`:

```js
CoastletEnvironmentManager.init({
  scene,
  renderer,
  camera,
  sceneManager,
  seaLevel: -0.03,
})

CoastletEnvironmentManager.update(deltaTime)

CoastletEnvironmentManager.dispose()
```

Trong `init`:

1. Init Skybox.
2. Init Ocean.
3. Init BuildPlane.
4. Sync DirectionalLight theo `SkyboxSystem.getLightDirection()`.
5. Nếu PostProcessing đang làm washout, giảm bloom/exposure.

Trong `update`:

1. Update skybox.
2. Update ocean time.
3. Ocean root follow camera XZ.
4. Sync light direction/color.

## Bước 8 — Dùng các repo khác như enhancement, không thay core

### `thaslle/stylized-water`

Chỉ port concept:

* foam edge
* fresnel band
* stylized color
* wave distortion/noise

Không import React/R3F. Nếu cần, tạo backlog:

```txt
Future: Stylized foam layer from thaslle/stylized-water.
```

### `jbouny/ocean`

Chỉ tham khảo:

* water-material params
* fog/reflection style
* realistic water color
* normal map parameters

Không import jQuery, không dùng Three.js r71 API trực tiếp.

### `martinRenou/threejs-water`

Chỉ tham khảo:

* caustics/drop simulation
* fresnel/refraction ideas
* `water.png` nếu license/attribution OK

Nếu copy texture/code, ghi BSD-3-Clause attribution.

### `Mohido/Ocean`

Chỉ research:

* GPU Gems multi-pass render position/normal maps
* Không implement FFT/GPU ocean trong phase này.

## Bước 9 — Debug vì hiện tại nước chưa thấy

Sau khi implement, thêm debug logs tạm thời:

```js
console.log('[CoastletOceanSystem] surface added:', !!oceanSurface.parent)
console.log('[CoastletOceanSystem] normal maps:', normalMap1.image?.width, normalMap2.image?.width)
console.log('[CoastletOceanSystem] time:', oceanMaterial.uniforms._Time.value)
console.log('[CoastletBuildPlane] raycast target:', buildPlane.name)
```

Nếu texture load fail, show fallback:

* tạo procedural blue water material
* console.warn rõ ràng
* app không crash

## Bước 10 — Verification

Chạy:

```bash
npm run test
npm run dev
```

Manual checklist bắt buộc:

* Mở game thấy rõ ocean surface.
* Mặt biển có gợn sóng nhẹ từ normal maps.
* Có horizon/skybox thật, không chỉ background màu.
* Skybox đi theo camera, không bị lộ cạnh.
* Ocean đi theo camera XZ, không bị hết mặt nước khi zoom/pan.
* Build/delete hoạt động trên buildPlane.
* Không raycast nhầm ocean.
* Không lỗi console.
* FPS ổn định.
* Save/load/undo/redo không bị ảnh hưởng.
* Screenshot mới phải chứng minh thấy nước và skybox.

## Output report bắt buộc

Sau khi làm xong, báo cáo theo format:

```md
# Phase E Report — Nugget8 Ocean/Skybox Integration

## 1. Audit Summary
Bảng repo/license/files/decision.

## 2. Files Added/Changed
Liệt kê rõ file mới/sửa.

## 3. Resources Used
Texture/shader nào lấy từ đâu, license gì.

## 4. Architecture Notes
Giải thích vì sao bỏ `Water.js` baseline nếu nó không hiện rõ.
Giải thích vì sao dùng camera-centered ocean.
Giải thích vì sao ocean visual-only, buildPlane mới là raycast target.

## 5. Verification
- npm run test result
- screenshot result
- manual checklist

## 6. Remaining Backlog
- foam
- caustics
- sea floor chunks
- underwater view
- day/night cycle
- FFT ocean
```

Kết luận: ưu tiên port lightweight ocean/skybox từ `Nugget8/Three.js-Ocean-Scene`, không tiếp tục phụ thuộc vào `Water.js` nếu visual vẫn không rõ. Ocean phải là visual system, buildPlane là interaction system.
