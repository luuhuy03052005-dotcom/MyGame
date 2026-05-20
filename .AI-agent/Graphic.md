# UPGRADE PROMPT — Coastlet Builder v0.2
# Mức độ: CRITICAL (logic) + MAJOR (graphics) + POLISH (UI)
# Đọc AGENTS.md + ARCHITECTURE.md trước khi làm bất kỳ task nào.
# Không nhảy task. Làm theo đúng thứ tự Priority 1 → 2 → 3.

---

## PRIORITY 1 — BUG FIX LOGIC (chặn chơi được)

### FIX-01: Ghost cube position sai
PROBLEM: Ghost preview mesh xuất hiện ở góc màn hình thay vì
         theo con trỏ chuột vào điểm raycast trên water/grid.
ROOT CAUSE: Raycaster dùng mouse coordinates chưa được normalized
            đúng cách (-1 to +1) khi tính theo canvas size.
FIX:
  InputHandler.js — updateMousePosition():
    mouse.x = (event.clientX / renderer.domElement.clientWidth) * 2 - 1
    mouse.y = -(event.clientY / renderer.domElement.clientHeight) * 2 + 1
  Ghost mesh phải snap đúng vào grid cell dưới cursor.
  Ghost mesh chỉ visible khi raycast hit water plane hoặc top face của cell.
VERIFY: Ghost cube bám sát cursor mượt, snap chính xác vào grid.

### FIX-02: Multi-floor linking — tường không merge visual
PROBLEM: Khi stack 2+ tầng, mỗi tầng vẫn render như object riêng biệt,
         thấy rõ đường chia ngang giữa các tầng.
ROOT CAUSE: ProceduralRuleEngine chưa phân biệt đúng:
  - Cell có top neighbor → wall_mid (tường thân giữa, không có mái)
  - Cell không có top neighbor → wall_top + roof
  - Cell không có bottom neighbor → wall_base (có móng)
FIX — ProceduralRuleEngine.js:
  Bổ sung sub-rule "wall_mid" cho cell có cả top VÀ bottom neighbor:
    if (neighbors.top && neighbors.bottom && y > 0):
      assetType = 'wall_mid'    ← không có mái, không có sệ đáy
    if (!neighbors.top && neighbors.bottom && y > 0):
      assetType = 'wall_top'   ← tầng đỉnh: chuẩn bị đặt mái
    if (!neighbors.bottom || y === 0):
      assetType = 'foundation_wall'  ← tầng nền: có móng hoặc cọc
  Sau khi addCell/removeCell, gọi resolveAll() cho toàn bộ
  cột (x,z) bị ảnh hưởng — không chỉ cell vừa click.
VERIFY: Stack 4 tầng → nhìn nghiêng thấy 1 khối liền mạch,
        không thấy đường chia.

### FIX-03: Foundation/pillar dưới mặt nước thiếu
PROBLEM: Nhà mọc thẳng từ y=0 không có cọc chống.
FIX — ProceduralRuleEngine.js:
  Bổ sung rule: nếu cell ở y=0 và không có bottom neighbor
    và là cell rìa (ít nhất 1 phía ngang trống):
      assetType = 'foundation_arch'  ← vòm/cọc chống ven nước
    else:
      assetType = 'foundation_solid'
  Placeholder geometry cho foundation_arch:
    CylinderGeometry(0.08, 0.12, 0.4, 6) x4 góc (cọc gỗ)
    + BoxGeometry(1, 0.15, 1) (sàn nền phẳng trên cọc)
    Group tất cả lại, đặt tại y = -0.2
VERIFY: Nhà ven rìa có cọc chống nhô xuống mặt nước.

### FIX-04: Roof rotation không đúng hướng
PROBLEM: Mái (cone) không xoay để hướng open side ra ngoài.
FIX — ProceduralRuleEngine.js, method _getOpenDirection():
  Tính open direction dựa trên 4 neighbor ngang (L/R/F/B).
  Nếu openDir = LEFT  → rotation.y = Math.PI / 2
  Nếu openDir = RIGHT → rotation.y = -Math.PI / 2
  Nếu openDir = FRONT → rotation.y = 0
  Nếu openDir = BACK  → rotation.y = Math.PI
  Với roof_gable (2 neighbor đối diện):
    align theo trục có neighbor (gable ridge song song 2 cell có nhau)
  Rotation phải được lưu vào cell.rotation và apply vào mesh.
VERIFY: Xây dãy 3x1 cell → mái 2 đầu chúc ra ngoài đúng chiều.

---

## PRIORITY 2 — GRAPHICS OVERHAUL (chất lượng hình ảnh)

### GFX-01: Thay CSS background bằng 3D water plane thật
INSTALL: không cần thư viện mới — dùng Three.js ShaderMaterial.
REMOVE: CSS background color trên canvas/body.
IMPLEMENT — WaterShader.js (file mới):

  vertexShader: `
    uniform float uTime;
    varying vec2 vUv;
    varying vec3 vWorldPos;
    void main() {
      vUv = uv;
      vec3 pos = position;
      // Gợn sóng nhỏ, không quá mạnh
      pos.y += sin(pos.x * 1.8 + uTime * 0.6) * 0.025
             + sin(pos.z * 2.2 + uTime * 0.8) * 0.018
             + sin((pos.x + pos.z) * 1.2 + uTime * 0.4) * 0.012;
      vWorldPos = (modelMatrix * vec4(pos, 1.0)).xyz;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
    }
  `

  fragmentShader: `
    uniform float uTime;
    uniform vec3 uSunDirection;
    varying vec2 vUv;
    varying vec3 vWorldPos;
    void main() {
      // Base water color gradient — cạn → sâu
      vec3 shallowColor = vec3(0.47, 0.78, 0.82);  // #78C7D1
      vec3 deepColor    = vec3(0.18, 0.42, 0.62);  // #2E6B9E
      float depth = clamp(length(vWorldPos.xz) / 30.0, 0.0, 1.0);
      vec3 baseColor = mix(shallowColor, deepColor, depth);
      
      // Foam lines theo sóng
      float foam = smoothstep(0.6, 0.8,
        sin(vWorldPos.x * 3.0 + uTime) * sin(vWorldPos.z * 2.5 + uTime * 0.7));
      baseColor = mix(baseColor, vec3(0.92, 0.97, 1.0), foam * 0.3);
      
      // Specular highlight đơn giản
      vec3 viewDir = normalize(cameraPosition - vWorldPos);
      float spec = pow(max(dot(reflect(-uSunDirection, vec3(0,1,0)), viewDir), 0.0), 32.0);
      baseColor += vec3(spec * 0.4);
      
      gl_FragColor = vec4(baseColor, 0.88);
    }
  `

  PlaneGeometry: 80x80, segments: 64x64 (cần nhiều vertex để sóng đẹp)
  Update mỗi frame: uTime += delta * 0.5
  receiveShadow: true
  Đặt tại y = -0.05 (hơi chìm xuống dưới foundation)

Sky: Thay background = new THREE.Color('#B8E0F7') bằng:
  THREE.GradientTexture hoặc:
  renderer.setClearColor(0xC8E8F5)
  + thêm haze gradient: FogExp2(0xC8E8F5, 0.012) → tạo depth

### GFX-02: Shadow system hoàn chỉnh
renderer.shadowMap.enabled = true
renderer.shadowMap.type = THREE.PCFSoftShadowMap

DirectionalLight:
  castShadow = true
  shadow.mapSize.width = shadow.mapSize.height = 2048
  shadow.camera: left=-25, right=25, top=25, bottom=-25, near=0.5, far=60
  shadow.bias = -0.001  ← chống shadow acne
  shadow.normalBias = 0.02

Tất cả building mesh: castShadow = true, receiveShadow = true
Water plane: receiveShadow = true (bóng nhà đổ xuống nước)
Ground plane (nếu có đất): receiveShadow = true

### GFX-03: Post-processing pipeline — INSTALL packages
npm install three  (đã có)
Dùng addons từ three/addons — không cần install thêm:

IMPORT:
  import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
  import { RenderPass }     from 'three/addons/postprocessing/RenderPass.js'
  import { SSAOPass }       from 'three/addons/postprocessing/SSAOPass.js'
  import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'
  import { OutputPass }     from 'three/addons/postprocessing/OutputPass.js'
  import { ShaderPass }     from 'three/addons/postprocessing/ShaderPass.js'
  import { FXAAShader }     from 'three/addons/shaders/FXAAShader.js'

PIPELINE (thứ tự quan trọng):
  1. RenderPass(scene, camera)
  2. SSAOPass — radius: 0.4, minDistance: 0.001, maxDistance: 0.02
     → Ambient occlusion: góc khuất giữa tường/nền tối hơn, tạo depth
  3. UnrealBloomPass — threshold: 0.85, strength: 0.12, radius: 0.4
     → Bloom cực nhẹ ở vùng highlight nắng, không bị chói
  4. ShaderPass(FXAAShader) — anti-aliasing cuối pipeline
  5. OutputPass — tone mapping + color space

Tone Mapping:
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.15

### GFX-04: Building materials — từ flat color sang PBR-lite

INSTALL:
  npm install gsap  ← cho animation (thay tween tự viết)

Thay MeshStandardMaterial hiện tại bằng MeshStandardMaterial với:
  roughness: 0.85   ← không bóng, surface nhám như vữa/gỗ
  metalness: 0.0
  envMapIntensity: 0.3

Tạo 3 material class riêng biệt, nhận diện visual rõ ràng:

  WALL material (tường nhà):
    color: theo cell.color (hex)
    roughness: 0.9, metalness: 0.0
    Thêm subtle normal variation bằng procedural noise nếu có texture

  ROOF material (mái):
    color: '#3D5A47'  ← xanh rêu đậm cố định (không theo palette)
    roughness: 0.7, metalness: 0.1  ← hơi bóng hơn tường (ngói)
    ConeGeometry cho roof_peak: radiusTop=0, radiusBottom=0.52,
    height=0.55, radialSegments=4 → pyramid shape sắc nét hơn

  FOUNDATION material (móng/cọc):
    color: '#8B7355'  ← nâu đất cố định
    roughness: 0.95   ← thô nhất
    Hơi tối hơn tường để phân biệt rõ đất/nhà

PILLAR geometry (cọc gỗ thay cylinder trơn):
  CylinderGeometry(0.06, 0.08, 0.5, 8) — tapered từ trên xuống
  Màu: '#5C4033' (nâu gỗ tối)

### GFX-05: Environment & Atmosphere

Sky gradient (dùng CSS gradient trên element phủ sau canvas):
  background: linear-gradient(180deg, #87CEEB 0%, #C8E8F5 60%, #DCF0F8 100%)
  Hoặc dùng THREE.Sky từ three/addons/objects/Sky.js:
    sun position = (0.5, 0.8, 0.2) normalized
    turbidity = 3, rayleigh = 0.5 → bầu trời trong, ít mây

Fog:
  scene.fog = new THREE.FogExp2(0xC8E8F5, 0.015)
  → Objects xa mờ dần vào màu trời, tạo depth perception tốt hơn

Ambient Occlusion ground contact:
  Thêm shadow-catcher plane sát đáy building group:
  MeshShadowMaterial(), nhận shadow, không cast

---

## PRIORITY 3 — UI/UX REDESIGN

### UI-01: Toolbar redesign — glass morphism style
INSTALL:
  Không cần thêm thư viện — thuần CSS + vanilla JS

CSS cho toolbar (thay style hiện tại):
  .toolbar {
    background: rgba(255, 255, 255, 0.72);
    backdrop-filter: blur(20px) saturate(180%);
    -webkit-backdrop-filter: blur(20px) saturate(180%);
    border: 1px solid rgba(255, 255, 255, 0.5);
    border-radius: 16px;
    box-shadow: 0 4px 24px rgba(0, 0, 0, 0.08),
                0 1px 2px rgba(0, 0, 0, 0.04);
    padding: 8px 16px;
    display: flex;
    align-items: center;
    gap: 4px;
  }

Toolbar buttons:
  Kích thước: 36x36px, border-radius: 10px
  Hover: background rgba(0,0,0,0.06), transition 0.15s ease
  Active/pressed: background rgba(0,0,0,0.12), scale(0.94)
  Icon: SVG 18px, color #4A5568

Thêm tooltip (CSS only, không cần JS):
  data-tooltip="Undo" → ::after content với
  background: rgba(0,0,0,0.75), color: white,
  border-radius: 6px, padding: 4px 8px, font-size: 11px

Separator giữa các group:
  1px solid rgba(0,0,0,0.08), height 20px

### UI-02: Color palette redesign
CSS cho palette bar:
  .palette-bar {
    background: rgba(255, 255, 255, 0.72);
    backdrop-filter: blur(20px);
    border: 1px solid rgba(255, 255, 255, 0.5);
    border-radius: 999px;   ← pill shape
    box-shadow: 0 4px 24px rgba(0,0,0,0.08);
    padding: 10px 20px;
    display: flex;
    align-items: center;
    gap: 8px;
  }

Color swatches:
  Kích thước: 28px circle (thay 24px)
  Border khi inactive: 2px solid rgba(0,0,0,0.08)
  Border khi active: 3px solid white + box-shadow: 0 0 0 2px [color]
  Hover: transform scale(1.15), transition 0.1s
  "COLOR" label: font Inter/System-UI, size 10px, weight 600,
                 color #94A3B8, letter-spacing 0.08em

INSTALL Google Fonts Inter:
  <link> tag trong index.html:
  https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap
  Áp dụng font-family: 'Inter', sans-serif cho toàn bộ UI

### UI-03: Controls hint panel
.controls-panel {
  background: rgba(0, 0, 0, 0.45);
  backdrop-filter: blur(12px);
  border-radius: 12px;
  padding: 12px 16px;
  color: rgba(255,255,255,0.85);
  font-size: 11px;
  line-height: 1.7;
}

Mỗi row: span.key (background rgba(255,255,255,0.15),
          border-radius 4px, padding 1px 6px, font mono)
          + span.desc

### UI-04: Loading screen

Thêm loading overlay trước khi scene ready:
<div id="loading-screen">
  Logo "COASTLET" animated (CSS letter-spacing animation)
  Dot progress indicator (3 dots nhấp nháy)
  "Building your world..." text
</div>

CSS:
  #loading-screen {
    position: fixed; inset: 0;
    background: linear-gradient(135deg, #B8E0F7, #D4EEF7);
    display: flex; flex-direction: column;
    align-items: center; justify-content: center;
    z-index: 9999;
    transition: opacity 0.5s ease;
  }

Ẩn loading sau khi 'assetmanager:ready' fire.

### UI-05: Build animation upgrade — dùng GSAP
Sau khi install GSAP (Priority 2 GFX-04):

Thay tween tự implement bằng:

BUILD animation:
  gsap.from(mesh.scale, {
    x: 0, y: 0, z: 0,
    duration: 0.2,
    ease: 'back.out(1.4)'
  })
  gsap.from(mesh.position, {
    y: mesh.position.y - 0.3,
    duration: 0.2,
    ease: 'power2.out'
  })

DELETE animation:
  gsap.to(mesh.scale, {
    x: 0.1, y: 0, z: 0.1,
    duration: 0.15,
    ease: 'back.in(1.5)',
    onComplete: () => {
      scene.remove(mesh)
      mesh.geometry.dispose()
      mesh.material.dispose()
    }
  })

### UI-06: Hover ghost upgrade
Ghost mesh thay vì cube mờ:
  - Chỉ hiển thị wireframe outline + fill mờ 15%
  - Material: MeshBasicMaterial({ color: 0xFFFFFF, transparent: true,
              opacity: 0.15, wireframe: false })
  - Thêm EdgesGeometry overlay màu trắng opacity 0.6
  - Ghost mesh animate nhẹ: bob up-down 0.03 units theo sin(time)
  - Khi invalid position (không thể xây): đổi sang màu đỏ #FF6B6B opacity 0.2

---

## PACKAGES CẦN INSTALL

npm install gsap

# Đã có sẵn trong three/addons — không cần install thêm:
# EffectComposer, SSAOPass, UnrealBloomPass, FXAAShader,
# OutputPass, RenderPass, Sky

# Font:
# Thêm link tag Google Fonts Inter vào index.html

---

## VERIFY CHECKLIST sau khi hoàn thành

[ ] Ghost cube bám cursor chính xác, không lệch
[ ] Stack 3 tầng → nhìn thấy 1 khối liền, không thấy đường chia
[ ] Foundation cọc xuất hiện dưới nhà ven rìa
[ ] Mái xoay đúng chiều theo neighbor context
[ ] Mặt nước có sóng, gradient sâu-cạn, specular highlight mặt trời
[ ] Nhà đổ bóng xuống nước và đất
[ ] Ambient occlusion làm tối góc khuất giữa các nhà
[ ] Fog làm nhòa nhà xa, tạo depth
[ ] Toolbar và palette có glass morphism effect
[ ] Build animation smooth với GSAP easeOutBack
[ ] Delete animation collapse rồi disappear
[ ] Loading screen hiện → fade out khi scene ready
[ ] FPS >= 60 sau tất cả upgrade trên máy mid-range