/**
 * OceanSystem.js - Beautiful realistic ocean surface
 */
import * as THREE from 'three'
import normal1Url from '../assets/textures/water/waterNormal1.png?url'
import normal2Url from '../assets/textures/water/waterNormal2.png?url'

let scene = null
let camera = null
let seaLevel = -0.03
let oceanRoot = null
let oceanMesh = null
let oceanMat = null
let nmap1 = null
let nmap2 = null
let elapsed = 0
let ready = false

const OceanSystem = {
  init({ scene: sc, camera: cam, seaLevel: sl }) {
    scene = sc
    camera = cam
    seaLevel = sl ?? -0.03

    const loader = new THREE.TextureLoader()
    nmap1 = loader.load(normal1Url, t => {
      t.wrapS = t.wrapT = THREE.RepeatWrapping
      t.repeat.set(12, 12)
      _ready()
    }, undefined, () => _ready())

    nmap2 = loader.load(normal2Url, t => {
      t.wrapS = t.wrapT = THREE.RepeatWrapping
      t.repeat.set(8, 8)
      _ready()
    }, undefined, () => _ready())

    oceanRoot = new THREE.Group()
    scene.add(oceanRoot)
    _makeMesh()
  },

  update(dt) {
    if (!ready || !oceanRoot) return
    elapsed += dt
    if (oceanMat) {
      oceanMat.uniforms.uTime.value = elapsed
      oceanMat.uniforms.uCam.value.copy(camera.position)
    }
    oceanRoot.position.set(camera.position.x, seaLevel, camera.position.z)
  },

  getSurface() { return oceanMesh },
  isReady() { return ready },

  dispose() {
    if (oceanMesh) { scene.remove(oceanMesh); oceanMesh.geometry?.dispose(); oceanMesh.material?.dispose() }
    nmap1?.dispose(); nmap2?.dispose()
    oceanRoot = null
  }
}

function _makeMesh() {
  const geo = new THREE.PlaneGeometry(2000, 2000, 64, 64)
  geo.rotateX(-Math.PI / 2)

  oceanMat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uN1: { value: null },
      uN2: { value: null },
      uCam: { value: new THREE.Vector3() },
      uSunDir: { value: new THREE.Vector3(0.5, 0.7, 0.4).normalize() },
    },
    vertexShader: `
varying vec2 vUv;
varying vec3 vWorldPos;
varying float vDist;

void main() {
  vUv = uv;
  vec4 worldPos = modelMatrix * vec4(position, 1.0);
  vWorldPos = worldPos.xyz;
  vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
  vDist = -mvPos.z;
  gl_Position = projectionMatrix * mvPos;
}
    `,
    fragmentShader: `
precision highp float;
uniform float uTime;
uniform sampler2D uN1;
uniform sampler2D uN2;
uniform vec3 uCam;
uniform vec3 uSunDir;
varying vec2 vUv;
varying vec3 vWorldPos;
varying float vDist;

void main() {
  // World-based UV for infinite tiling illusion
  vec2 worldUV = vWorldPos.xz * 0.003;

  // Four scrolling wave layers at different speeds/scales
  vec2 uv1 = worldUV + vec2(uTime * 0.06, uTime * 0.04);
  vec2 uv2 = worldUV * 0.7 + vec2(-uTime * 0.03, uTime * 0.05);
  vec2 uv3 = worldUV * 1.3 + vec2(uTime * 0.10, -uTime * 0.02);
  vec2 uv4 = worldUV * 0.4 + vec2(uTime * 0.015, uTime * 0.02);

  // Sample normal maps
  vec3 n1 = texture2D(uN1, uv1).rgb * 2.0 - 1.0;
  vec3 n2 = texture2D(uN2, uv2).rgb * 2.0 - 1.0;
  vec3 n3 = texture2D(uN1, uv3).rgb * 2.0 - 1.0;
  vec3 n4 = texture2D(uN2, uv4).rgb * 2.0 - 1.0;

  // Combine normals - big waves dominate, small ripples add detail
  vec3 waveNormal = normalize(n1 * 0.5 + n2 * 0.3 + n3 * 0.12 + n4 * 0.08);

  // View direction
  vec3 viewDir = normalize(uCam - vWorldPos);
  vec3 normal = vec3(0.0, 1.0, 0.0);

  // Fresnel - more reflection at grazing angles
  float cosTheta = max(0.0, dot(normal, viewDir));
  float fresnel = 0.04 + 0.96 * pow(1.0 - cosTheta, 4.0);

  // === OCEAN COLOR PALETTE - rich and vibrant ===
  // Deep ocean: rich navy blue
  vec3 deepOcean = vec3(0.02, 0.10, 0.30);
  // Mid water: rich teal
  vec3 midOcean = vec3(0.05, 0.30, 0.50);
  // Shallow water: vivid turquoise
  vec3 shallowOcean = vec3(0.08, 0.55, 0.65);
  // Foam/horizon: bright sky reflection
  vec3 foamColor = vec3(0.70, 0.87, 0.97);

  // Mix ocean colors by distance (perspective depth)
  float dist = length(vWorldPos - uCam);
  float distFade = clamp(dist * 0.0006, 0.0, 1.0);
  vec3 oceanCol = mix(deepOcean, midOcean, 0.25);
  oceanCol = mix(oceanCol, shallowOcean, 0.15);
  oceanCol = mix(oceanCol, foamColor, distFade * 0.6);

  // === SKY REFLECTION ===
  vec3 reflectDir = reflect(-viewDir, normal);
  float skyBlend = smoothstep(-0.1, 0.5, reflectDir.y);
  vec3 skyRefl = mix(foamColor, vec3(0.50, 0.72, 0.90), skyBlend);

  // Blend water and sky via Fresnel
  vec3 col = mix(oceanCol, skyRefl, fresnel * 0.75);

  // === SUN REFLECTION ON WATER ===
  vec3 halfVec = normalize(uSunDir + viewDir);
  float nDotH = max(0.0, dot(waveNormal, halfVec));
  float nDotL = max(0.0, dot(waveNormal, uSunDir));

  // Multiple specular layers for realistic water sparkle
  float spec1 = pow(nDotH, 512.0) * nDotL * 4.0;   // Tiny sharp glints
  float spec2 = pow(nDotH, 128.0) * nDotL * 1.5;   // Medium sparkles
  float spec3 = pow(nDotH, 32.0) * nDotL * 0.4;    // Broad shimmer

  vec3 sunColor = vec3(1.1, 1.0, 0.85);
  col += sunColor * spec1;
  col += sunColor * spec2 * 0.8;
  col += sunColor * spec3 * 0.5;

  // Sun path on water - elongated reflection
  float sunPath = pow(max(0.0, dot(reflectDir, uSunDir)), 16.0);
  vec3 sunPathCol = vec3(1.0, 0.9, 0.7) * sunPath * fresnel * 0.5;
  col += sunPathCol;

  // === ATMOSPHERIC FOG ===
  float fogDensity = 0.00025;
  float fog = 1.0 - exp(-vDist * fogDensity);
  fog = clamp(fog, 0.0, 0.80);
  col = mix(col, foamColor, fog);

  // Horizon blend - blend to sky color at far distances
  float horizonBlend = smoothstep(400.0, 1200.0, vDist);
  col = mix(col, foamColor, horizonBlend * 0.5);

  // Slight transparency at far distance
  float alpha = mix(0.97, 0.85, fog);

  gl_FragColor = vec4(col, alpha);
}
    `,
    transparent: true,
    side: THREE.FrontSide,
    depthWrite: true,
  })

  oceanMesh = new THREE.Mesh(geo, oceanMat)
  oceanMesh.name = 'oceanSurface'
  oceanMesh.userData.ignoreRaycast = true
  oceanMesh.renderOrder = 5
  oceanRoot.add(oceanMesh)
  oceanMat.uniforms.uN1.value = nmap1
  oceanMat.uniforms.uN2.value = nmap2
}

function _ready() {
  if (nmap1?.image && nmap2?.image) {
    ready = true
  }
}

export { OceanSystem }
