/**
 * CoastletSkyboxSystem.js — Procedural Skybox theo Nugget8/Three.js-Ocean-Scene
 *
 * Features:
 * - Cube skybox bao quanh camera
 * - Procedural day/night/twilight sky colors
 * - Procedural stars
 * - Sun/moon glow
 * - Light direction synced cho DirectionalLight
 *
 * Dựa trên: libraries/Three.js-Ocean-Scene/materials/SkyboxMaterial.js + shaders/SkyboxShader.js
 *
 * Public API:
 *   CoastletSkyboxSystem.init({ scene, camera })
 *   CoastletSkyboxSystem.update(deltaTime)
 *   CoastletSkyboxSystem.getLightDirection() → THREE.Vector3
 *   CoastletSkyboxSystem.getLightColor() → THREE.Color
 *   CoastletSkyboxSystem.dispose()
 */

import * as THREE from 'three'

let scene = null
let camera = null
let skybox = null
let skyMaterial = null

// Sky rotation (slow sun movement)
const SKY_SPEED = 0.02  // radians per second
let skyAngle = -1  // start at night-ish angle

// Light direction (normalized)
const lightDir = new THREE.Vector3(0, 1, 0)
const lightColor = new THREE.Color(1, 1, 1)

// Procedural stars
let starsTexture = null
const GRID_SIZE = 64
const STARS_COUNT = 8000
const MAX_OFFSET = 0.43

// Dither texture
let ditherTexture = null
let ditherSize = new THREE.Vector2()

// Sky rotation matrix
const rotationMatrix = new THREE.Matrix3()

// UP vector
const UP = new THREE.Vector3(0, 1, 0)

// Initial sun direction (noon)
const initialSunDir = new THREE.Vector3(0, 1, 0)

// Rotation axis: 30 degrees from Y axis
const rotationAxis = new THREE.Vector3(0, 0, 1).applyAxisAngle(new THREE.Vector3(0, 1, 0), THREE.MathUtils.degToRad(-30))

const CoastletSkyboxSystem = {
  /**
   * @param {{ scene: THREE.Scene, camera: THREE.Camera }} options
   */
  init({ scene: sceneRef, camera: cameraRef }) {
    scene = sceneRef
    camera = cameraRef

    // Load textures
    _loadTextures()

    // Create skybox mesh
    _createSkybox()

    console.log('[CoastletSkyboxSystem] Initialized')
    return skybox
  },

  /**
   * @param {number} deltaTime
   */
  update(deltaTime) {
    if (!skybox) return

    // Update sky rotation (slow sun movement)
    skyAngle += deltaTime * SKY_SPEED
    _updateSkyRotation()

    // Update light direction and color based on sun position
    _updateLight()

    // Skybox follows camera
    skybox.position.copy(camera.position)
  },

  /**
   * @returns {THREE.Vector3} normalized light direction
   */
  getLightDirection() {
    return lightDir.clone()
  },

  /**
   * @returns {THREE.Color} light color
   */
  getLightColor() {
    return lightColor.clone()
  },

  dispose() {
    if (skybox) {
      scene.remove(skybox)
      skybox.geometry?.dispose()
      skybox.material?.dispose()
    }
    if (ditherTexture) ditherTexture.dispose()
    if (starsTexture) starsTexture.dispose()
    skybox = null
    skyMaterial = null
    scene = null
    camera = null
  },
}

/**
 * Load dither and stars textures
 */
function _loadTextures() {
  // Dither texture (bluenoise)
  const ditherLoader = new THREE.TextureLoader()
  ditherTexture = ditherLoader.load('./assets/textures/water/bluenoise.png', (tex) => {
    ditherSize.set(tex.image.width, tex.image.height)
    tex.wrapS = THREE.RepeatWrapping
    tex.wrapT = THREE.RepeatWrapping
  })

  // Generate procedural stars
  starsTexture = _generateStarsTexture()
}

/**
 * Generate procedural stars as DataTexture
 */
function _generateStarsTexture() {
  const starsMap = new Uint8Array(GRID_SIZE * GRID_SIZE * 24)

  // Simple seeded random
  let seed = 87
  const random = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff
    return seed / 0x7fffffff
  }

  for (let i = 0; i < STARS_COUNT; i++) {
    const theta = random() * Math.PI * 2
    const phi = Math.acos(2 * random() - 1)
    const dir = new THREE.Vector3(
      Math.sin(phi) * Math.cos(theta),
      Math.sin(phi) * Math.sin(theta),
      Math.cos(phi)
    )

    // Convert direction to cubemap face UV
    const absDir = new THREE.Vector3(Math.abs(dir.x), Math.abs(dir.y), Math.abs(dir.z))
    let u = 0, v = 0, face = 0

    if (dir.z >= 0 && absDir.z >= absDir.x && absDir.z >= absDir.y) {
      // Positive Z
      u = Math.floor((dir.x / absDir.z + 1) * 0.5 * GRID_SIZE)
      v = Math.floor((dir.y / absDir.z + 1) * 0.5 * GRID_SIZE)
      face = 4
    } else if (dir.z < 0 && absDir.z >= absDir.x && absDir.z >= absDir.y) {
      // Negative Z
      u = Math.floor((-dir.x / absDir.z + 1) * 0.5 * GRID_SIZE)
      v = Math.floor((dir.y / absDir.z + 1) * 0.5 * GRID_SIZE)
      face = 5
    } else if (dir.y >= 0 && absDir.y >= absDir.x && absDir.y >= absDir.z) {
      // Positive Y
      u = Math.floor((dir.x / absDir.y + 1) * 0.5 * GRID_SIZE)
      v = Math.floor((-dir.z / absDir.y + 1) * 0.5 * GRID_SIZE)
      face = 2
    } else if (dir.y < 0 && absDir.y >= absDir.x && absDir.y >= absDir.z) {
      // Negative Y
      u = Math.floor((dir.x / absDir.y + 1) * 0.5 * GRID_SIZE)
      v = Math.floor((dir.z / absDir.y + 1) * 0.5 * GRID_SIZE)
      face = 3
    } else if (dir.x >= 0 && absDir.x >= absDir.y && absDir.x >= absDir.z) {
      // Positive X
      u = Math.floor((-dir.z / absDir.x + 1) * 0.5 * GRID_SIZE)
      v = Math.floor((dir.y / absDir.x + 1) * 0.5 * GRID_SIZE)
      face = 0
    } else {
      // Negative X
      u = Math.floor((dir.z / absDir.x + 1) * 0.5 * GRID_SIZE)
      v = Math.floor((dir.y / absDir.x + 1) * 0.5 * GRID_SIZE)
      face = 1
    }

    u = Math.max(0, Math.min(GRID_SIZE - 1, u))
    v = Math.max(0, Math.min(GRID_SIZE - 1, v))

    const j = (v * GRID_SIZE * 6 + face * GRID_SIZE + u) * 4
    starsMap[j] = Math.floor(THREE.MathUtils.lerp(128 - 128 * MAX_OFFSET, 128 + 128 * MAX_OFFSET, random()) * 0.5)
    starsMap[j + 1] = Math.floor(THREE.MathUtils.lerp(128 - 128 * MAX_OFFSET, 128 + 128 * MAX_OFFSET, random()) * 0.5)
    starsMap[j + 2] = Math.floor(Math.pow(random(), 6) * 255 * 0.3)  // dim stars
    starsMap[j + 3] = Math.floor(random() * 255 * 0.5)  // sparse
  }

  const texture = new THREE.DataTexture(starsMap, GRID_SIZE * 6, GRID_SIZE, THREE.RGBAFormat)
  texture.needsUpdate = true
  return texture
}

/**
 * Create skybox mesh with procedural shader
 */
function _createSkybox() {
  const HALF_SIZE = 2000

  // Cube vertices
  const vertices = new Float32Array([
    // Bottom face
    -HALF_SIZE, -HALF_SIZE, -HALF_SIZE,
    HALF_SIZE, -HALF_SIZE, -HALF_SIZE,
    -HALF_SIZE, -HALF_SIZE, HALF_SIZE,
    HALF_SIZE, -HALF_SIZE, HALF_SIZE,
    // Top face
    -HALF_SIZE, HALF_SIZE, -HALF_SIZE,
    HALF_SIZE, HALF_SIZE, -HALF_SIZE,
    -HALF_SIZE, HALF_SIZE, HALF_SIZE,
    HALF_SIZE, HALF_SIZE, HALF_SIZE,
  ])

  const indices = [
    2, 3, 0, 3, 1, 0,  // bottom
    0, 1, 4, 1, 5, 4,  // front
    1, 3, 5, 3, 7, 5,  // right
    3, 2, 7, 2, 6, 7,  // back
    2, 0, 6, 0, 4, 6,  // left
    4, 5, 6, 5, 7, 6   // top
  ]

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3))
  geometry.setAttribute('coord', new THREE.BufferAttribute(vertices.slice(), 3))
  geometry.setIndex(indices)

  // Create sky shader material
  skyMaterial = new THREE.ShaderMaterial({
    vertexShader: _getSkyboxVertexShader(),
    fragmentShader: _getSkyboxFragmentShader(),
    uniforms: {
      _SkyRotationMatrix: { value: rotationMatrix },
      _DitherTexture: { value: ditherTexture },
      _DitherTextureSize: { value: ditherSize },
      _SunVisibility: { value: 1.0 },
      _TwilightTime: { value: 0.0 },
      _TwilightVisibility: { value: 0.0 },
      _MoonVisibility: { value: 0.0 },
      _GridSize: { value: GRID_SIZE },
      _GridSizeScaled: { value: GRID_SIZE * 6 },
      _Stars: { value: starsTexture },
      _SpecularVisibility: { value: 1.0 },
      _DirToLight: { value: lightDir },
      _Light: { value: lightColor },
    },
    side: THREE.BackSide,
    depthWrite: false,
  })

  skybox = new THREE.Mesh(geometry, skyMaterial)
  skybox.name = 'skybox'
  skybox.frustumCulled = false  // Always render
  skybox.userData.ignoreRaycast = true

  scene.add(skybox)
}

/**
 * Update sky rotation matrix and light direction
 */
function _updateSkyRotation() {
  // Rodrigues rotation formula
  const cos = Math.cos(skyAngle)
  const cos1 = 1 - cos
  const sin = Math.sin(skyAngle)
  const ax = rotationAxis.x
  const ay = rotationAxis.y
  const az = rotationAxis.z
  const ax2 = ax * ax
  const ay2 = ay * ay
  const az2 = az * az

  rotationMatrix.set(
    cos + ax2 * cos1, ax * ay * cos1 - az * sin, ax * az * cos1 + ay * sin,
    ay * ax * cos1 + az * sin, cos + ay2 * cos1, ay * az * cos1 - ax * sin,
    az * ax * cos1 - ay * sin, az * ay * cos1 + ax * sin, cos + az2 * cos1
  )

  // Update sky material
  if (skyMaterial) {
    skyMaterial.uniforms._SkyRotationMatrix.value.copy(rotationMatrix)
  }
}

/**
 * Update light direction and color based on sun position
 */
function _updateLight() {
  // Rotate initial sun direction by rotation matrix
  const rotatedDir = initialSunDir.clone().applyMatrix3(rotationMatrix)
  lightDir.copy(rotatedDir).normalize()
  lightDir.negate()  // Point towards scene

  // Calculate sun visibility (1 = full day, 0 = night)
  const intensity = lightDir.dot(UP)
  const sunVis = THREE.MathUtils.clamp((intensity + 0.1) * 2, 0, 1)
  const twilightTime = THREE.MathUtils.clamp((intensity + 0.1) * 3, 0, 1)
  const twilightVis = 1 - Math.min(Math.abs(intensity * 3), 1)

  // Update sky material uniforms
  if (skyMaterial) {
    skyMaterial.uniforms._SunVisibility.value = sunVis
    skyMaterial.uniforms._TwilightTime.value = twilightTime
    skyMaterial.uniforms._TwilightVisibility.value = twilightVis
    skyMaterial.uniforms._SpecularVisibility.value = Math.sqrt(sunVis)
    skyMaterial.uniforms._DirToLight.value.copy(lightDir)
  }

  // Calculate light color (golden hour)
  const l = Math.min(sunVis + 0.333, 1)
  lightColor.setRGB(l, l * 0.95 + 0.05, l * 0.85 + 0.15)  // Warm white
}

/**
 * Skybox vertex shader
 */
function _getSkyboxVertexShader() {
  return /* glsl */`
    uniform mat3 _SkyRotationMatrix;

    varying vec3 _worldPos;
    varying vec3 _coord;

    void main() {
      _worldPos = position;
      _coord = _SkyRotationMatrix * _worldPos;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `
}

/**
 * Skybox fragment shader - procedural day/night sky with stars
 */
function _getSkyboxFragmentShader() {
  return /* glsl */`
    uniform sampler2D _DitherTexture;
    uniform vec2 _DitherTextureSize;
    uniform float _SunVisibility;
    uniform float _TwilightTime;
    uniform float _TwilightVisibility;
    uniform float _MoonVisibility;
    uniform float _GridSize;
    uniform float _GridSizeScaled;
    uniform sampler2D _Stars;
    uniform float _SpecularVisibility;
    uniform vec3 _DirToLight;
    uniform vec3 _Light;

    varying vec3 _worldPos;
    varying vec3 _coord;

    const float DITHER_STRENGTH = 0.1;
    const vec3 UP = vec3(0.0, 1.0, 0.0);

    const vec3 DAY_SKY_COLOR = vec3(0.45, 0.65, 0.85);
    const vec3 DAY_HORIZON_COLOR = vec3(0.75, 0.88, 0.95);
    const vec3 EARLY_TWILIGHT_COLOR = vec3(1.0, 0.83, 0.5);
    const vec3 LATE_TWILIGHT_COLOR = vec3(1.0, 0.4, 0.2);

    const float SUN_SHARPNESS = 2000.0;
    const float SUN_SIZE = 5.0;

    float dither = 0.0;

    vec2 sampleCubeCoords(vec3 dir) {
      vec3 absDir = abs(dir);
      float maxAxis = 1.0;
      float u = 0.0;
      float v = 0.0;
      float i = 0.0;

      if (dir.z >= 0.0 && absDir.z >= absDir.x && absDir.z >= absDir.y) {
        maxAxis = absDir.z; u = -dir.z; v = dir.y; i = 4.0;
      } else if (dir.z < 0.0 && absDir.z >= absDir.x && absDir.z >= absDir.y) {
        maxAxis = absDir.z; u = dir.z; v = dir.y; i = 5.0;
      } else if (dir.y >= 0.0 && absDir.y >= absDir.x && absDir.y >= absDir.z) {
        maxAxis = absDir.y; u = dir.x; v = -dir.z; i = 2.0;
      } else if (dir.y < 0.0 && absDir.y >= absDir.x && absDir.y >= absDir.z) {
        maxAxis = absDir.y; u = dir.x; v = dir.z; i = 3.0;
      } else if (dir.x >= 0.0 && absDir.x >= absDir.y && absDir.x >= absDir.z) {
        maxAxis = absDir.x; u = -dir.z; v = dir.y; i = 0.0;
      } else {
        maxAxis = absDir.x; u = dir.z; v = dir.y; i = 1.0;
      }

      u = i * (1.0 / 6.0) + (u / maxAxis + 1.0) * (1.0 / 12.0);
      v = (v / maxAxis + 1.0) * 0.5;
      return vec2(u, v);
    }

    void main() {
      vec3 worldDir = normalize(_worldPos);
      vec3 viewDir = normalize(_coord);

      // Dither
      vec2 screenUV = gl_FragCoord.xy / vec2(800.0, 600.0);
      float ditherSample = texture2D(_DitherTexture, screenUV * 4.0).x;
      dither = (ditherSample - 0.5) * DITHER_STRENGTH;

      // Horizon density
      float density = clamp(pow(1.0 - max(0.0, dot(worldDir, UP) + dither * 0.1), 2.0), 0.0, 1.0);

      // Sun
      float sunLight = dot(viewDir, UP);
      float sun = min(pow(max(0.0, sunLight), SUN_SHARPNESS) * SUN_SIZE, 1.0);

      // Sky colors
      vec3 day = mix(DAY_SKY_COLOR, DAY_HORIZON_COLOR, density);
      vec3 twilight = mix(LATE_TWILIGHT_COLOR, EARLY_TWILIGHT_COLOR, _TwilightTime);
      vec3 sky = mix(day, day, _SunVisibility);
      sky = mix(sky, twilight, density * clamp(sunLight * 0.5 + 0.5 + dither, 0.0, 1.0) * _TwilightVisibility);

      // Stars (only visible at night)
      if (_SunVisibility < 0.5) {
        vec2 cubeCoords = sampleCubeCoords(viewDir);
        vec4 gridValue = texture2D(_Stars, cubeCoords);

        vec2 gridCoords = vec2(cubeCoords.x * _GridSizeScaled, cubeCoords.y * _GridSize);
        vec2 gridCenterCoords = floor(gridCoords) + gridValue.xy;
        float starIntensity = max(0.0, 1.0 - min(distance(gridCoords, gridCenterCoords) * 50.0, 1.0));
        starIntensity *= gridValue.z * 0.5;
        starIntensity *= (1.0 - _SunVisibility) * 2.0;  // Fade with day

        sky += vec3(starIntensity);
      }

      // Sun glow
      sky += vec3(1.0, 0.98, 0.9) * sun * 0.8;

      // Horizon blend (fog color)
      float horizonBlend = pow(1.0 - abs(worldDir.y), 8.0);
      vec3 horizonColor = mix(DAY_HORIZON_COLOR, vec3(0.85, 0.9, 0.95), 0.5);
      sky = mix(sky, horizonColor, horizonBlend * 0.3);

      gl_FragColor = vec4(sky, 1.0);
    }
  `
}

export { CoastletSkyboxSystem }
