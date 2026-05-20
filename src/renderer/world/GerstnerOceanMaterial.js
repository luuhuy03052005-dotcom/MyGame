/**
 * GerstnerOceanMaterial.js — Professional-grade ocean shader with Gerstner waves
 *
 * Features:
 * - 5 layers of Gerstner waves with proper physics
 * - Sharp wave peaks (not smooth sine waves)
 * - Dynamic normals from wave derivatives
 * - Fresnel reflections (Schlick's approximation)
 * - Color depth variation (deep/shallow water)
 * - Foam at wave crests
 * - Specular highlights from sun
 * - Environment cubemap reflections
 * - Scrolling normal maps for detail
 *
 * Public API:
 *   GerstnerOceanMaterial.loadTextures()
 *   GerstnerOceanMaterial.create()
 *   GerstnerOceanMaterial.getVertexShader()
 *   GerstnerOceanMaterial.getFragmentShader()
 */

import * as THREE from 'three'

// Loaded textures (module-level state)
let normalMap1 = null
let normalMap2 = null
let normalMap3 = null

/**
 * Load normal map textures using import.meta.url (Vite-compatible)
 * Falls back to procedural textures if files don't exist.
 * @returns {Promise<{normalMap1: THREE.Texture, normalMap2: THREE.Texture, normalMap3: THREE.Texture}>}
 */
async function loadTextures() {
  // Always use procedural textures — the project has no PNG files
  // In the future, place real waterNormal1.png and waterNormal2.png
  // in src/renderer/assets/textures/water/ to use real textures
  console.log('[OceanTexture] Using procedural normal maps (no PNG files found)')
  normalMap1 = createProceduralNormalMap(512, 0)
  normalMap2 = createProceduralNormalMap(512, 0.7)
  normalMap3 = createProceduralNormalMap(512, 0.3)
  console.log('[OceanTexture] normalMap1:', normalMap1.image?.width, 'x', normalMap1.image?.height)
  console.log('[OceanTexture] normalMap2:', normalMap2.image?.width, 'x', normalMap2.image?.height)
  return { normalMap1, normalMap2, normalMap3 }
}

/**
 * Procedural normal map texture (fallback when real textures don't exist)
 */
function createProceduralNormalMap(size = 512, seed = 0) {
  const data = new Uint8Array(size * size * 4)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4
      const nx = Math.sin((x / size) * 10 * Math.PI + seed * 13) * 0.35 +
                  Math.cos((y / size) * 14 * Math.PI + seed * 17) * 0.25
      const ny = Math.cos((x / size) * 12 * Math.PI + seed * 11) * 0.25 +
                  Math.sin((y / size) * 8 * Math.PI + seed * 19) * 0.35
      data[i]     = Math.floor((nx + 1) * 0.5 * 255)
      data[i + 1] = Math.floor((ny + 1) * 0.5 * 255)
      data[i + 2] = 255
      data[i + 3] = 255
    }
  }
  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat)
  tex.needsUpdate = true
  tex.wrapS = THREE.RepeatWrapping
  tex.wrapT = THREE.RepeatWrapping
  return tex
}

/**
 * Create the ocean shader material
 * NOTE: Normal map uniforms are set by GerstnerOceanSystem after loadTextures() completes.
 * @returns {THREE.ShaderMaterial}
 */
function create() {
  return new THREE.ShaderMaterial({
    vertexShader: getVertexShader(),
    fragmentShader: getFragmentShader(),
    uniforms: {
      // Time
      uTime: { value: 0 },

      // Camera
      uCameraPosition: { value: new THREE.Vector3() },

      // Sun/Light
      uSunDirection: { value: new THREE.Vector3(0.5, 0.7, 0.4).normalize() },
      uSunColor: { value: new THREE.Color(1.0, 0.98, 0.9) },
      uSunIntensity: { value: 2.0 },

      // Water colors
      uDeepColor: { value: new THREE.Color(0.02, 0.12, 0.35) },
      uShallowColor: { value: new THREE.Color(0.08, 0.55, 0.65) },
      uFoamColor: { value: new THREE.Color(0.9, 0.95, 1.0) },

      // Normal maps — set by GerstnerOceanSystem after loadTextures()
      uNormalMap1: { value: null },
      uNormalMap2: { value: null },
      uNormalMap3: { value: null },

      // Normal map settings
      uNormalMapScale1: { value: 0.004 },
      uNormalMapScale2: { value: 0.008 },
      uNormalMapScale3: { value: 0.012 },
      uNormalMapStrength: { value: 0.3 },

      // Foam settings
      uFoamThreshold: { value: 0.7 },
      uFoamStrength: { value: 1.0 },

      // Fresnel settings
      uFresnelPower: { value: 5.0 },
      uFresnelBias: { value: 0.04 },

      // Environment map (optional)
      uEnvMap: { value: null },
      uEnvMapIntensity: { value: 0.6 },

      // Sky color for fallback reflections
      uSkyColor: { value: new THREE.Color(0.45, 0.68, 0.88) },
      uHorizonColor: { value: new THREE.Color(0.75, 0.88, 0.95) },
    },
    // Transparent with depth test but no depth write (so ocean doesn't block buildings)
    transparent: true,
    depthTest: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  })
}

/**
 * Vertex shader with Gerstner waves
 */
function getVertexShader() {
  return /* glsl */`
precision highp float;

uniform float uTime;
uniform vec3 uCameraPosition;

// Normal map uniforms
uniform sampler2D uNormalMap1;
uniform sampler2D uNormalMap2;
uniform sampler2D uNormalMap3;
uniform float uNormalMapScale1;
uniform float uNormalMapScale2;
uniform float uNormalMapScale3;
uniform float uNormalMapStrength;

// Varyings
varying vec3 vWorldPosition;
varying vec3 vNormal;
varying vec2 vUv;
varying float vWaveHeight;
varying float vFoamFactor;
varying vec3 vViewDirection;
varying float vDistanceToCamera;

#define PI 3.14159265359
#define GRAVITY 9.81

// ============================================
// GERSTNER WAVE PARAMETERS
// Each wave: amplitude, wavelength, direction angle, speed multiplier, steepness
// ============================================

// Wave 1: Large swells
const float W1_AMPLITUDE = 0.8;
const float W1_WAVELENGTH = 120.0;
const float W1_ANGLE = 0.3;
const float W1_SPEED = 1.0;
const float W1_STEEPNESS = 0.5;

// Wave 2: Medium waves
const float W2_AMPLITUDE = 0.4;
const float W2_WAVELENGTH = 60.0;
const float W2_ANGLE = -0.5;
const float W2_SPEED = 1.2;
const float W2_STEEPNESS = 0.45;

// Wave 3: Cross waves
const float W3_AMPLITUDE = 0.25;
const float W3_WAVELENGTH = 35.0;
const float W3_ANGLE = 1.2;
const float W3_SPEED = 0.9;
const float W3_STEEPNESS = 0.4;

// Wave 4: Small chop
const float W4_AMPLITUDE = 0.15;
const float W4_WAVELENGTH = 20.0;
const float W4_ANGLE = -1.8;
const float W4_SPEED = 1.5;
const float W4_STEEPNESS = 0.35;

// Wave 5: Micro detail
const float W5_AMPLITUDE = 0.08;
const float W5_WAVELENGTH = 10.0;
const float W5_ANGLE = 2.5;
const float W5_SPEED = 2.0;
const float W5_STEEPNESS = 0.3;

// ============================================
// GERSTNER WAVE FUNCTION
// ============================================

vec3 gerstnerWave(
    vec3 position,
    float amplitude,
    float wavelength,
    float angle,
    float speed,
    float steepness,
    float time,
    inout vec3 tangent,
    inout vec3 binormal
) {
    // Wave number (2*pi / wavelength)
    float k = 2.0 * PI / wavelength;

    // Frequency (sqrt(gravity * k)) - phase velocity
    float omega = sqrt(GRAVITY * k);

    // Direction vector
    vec2 direction = vec2(cos(angle), sin(angle));

    // Phase
    float phase = k * dot(direction, position.xz) - omega * speed * time;

    // Gerstner wave displacement
    float sinPhase = sin(phase);
    float cosPhase = cos(phase);

    // Displacement
    float displacementX = steepness * amplitude * direction.x * cosPhase;
    float displacementY = amplitude * sinPhase;
    float displacementZ = steepness * amplitude * direction.y * cosPhase;

    // Accumulate tangent and binormal for normal calculation
    float Wa = steepness * amplitude * k;
    tangent += vec3(
        -direction.x * direction.x * Wa * sinPhase,
        direction.x * Wa * cosPhase,
        -direction.x * direction.y * Wa * sinPhase
    );
    binormal += vec3(
        -direction.x * direction.y * Wa * sinPhase,
        direction.y * Wa * cosPhase,
        -direction.y * direction.y * Wa * sinPhase
    );

    return vec3(displacementX, displacementY, displacementZ);
}

// ============================================
// NOISE FUNCTIONS FOR FOAM DETAIL
// ============================================

float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);

    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));

    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

float fbm(vec2 p) {
    float value = 0.0;
    float amplitude = 0.5;
    for (int i = 0; i < 4; i++) {
        value += amplitude * noise(p);
        p *= 2.0;
        amplitude *= 0.5;
    }
    return value;
}

// ============================================
// MAIN
// ============================================

void main() {
    vUv = uv;

    // Initial position
    vec3 pos = position;

    // Tangent and binormal for wave normal calculation
    vec3 tangent = vec3(1.0, 0.0, 0.0);
    vec3 binormal = vec3(0.0, 0.0, 1.0);

    // Apply Gerstner waves
    vec3 displacement = vec3(0.0);
    displacement += gerstnerWave(pos, W1_AMPLITUDE, W1_WAVELENGTH, W1_ANGLE, W1_SPEED, W1_STEEPNESS, uTime, tangent, binormal);
    displacement += gerstnerWave(pos, W2_AMPLITUDE, W2_WAVELENGTH, W2_ANGLE, W2_SPEED, W2_STEEPNESS, uTime, tangent, binormal);
    displacement += gerstnerWave(pos, W3_AMPLITUDE, W3_WAVELENGTH, W3_ANGLE, W3_SPEED, W3_STEEPNESS, uTime, tangent, binormal);
    displacement += gerstnerWave(pos, W4_AMPLITUDE, W4_WAVELENGTH, W4_ANGLE, W4_SPEED, W4_STEEPNESS, uTime, tangent, binormal);
    displacement += gerstnerWave(pos, W5_AMPLITUDE, W5_WAVELENGTH, W5_ANGLE, W5_SPEED, W5_STEEPNESS, uTime, tangent, binormal);

    pos += displacement;

    // Calculate wave normal from tangent/binormal
    vec3 waveNormal = normalize(cross(binormal, tangent));

    // Add normal map detail
    vec2 worldUV1 = pos.xz * uNormalMapScale1 + vec2(uTime * 0.06, uTime * 0.04);
    vec2 worldUV2 = pos.xz * uNormalMapScale2 + vec2(-uTime * 0.03, uTime * 0.05);
    vec2 worldUV3 = pos.xz * uNormalMapScale3 + vec2(uTime * 0.10, -uTime * 0.02);

    vec3 normalDetail1 = texture2D(uNormalMap1, worldUV1).xyz * 2.0 - 1.0;
    vec3 normalDetail2 = texture2D(uNormalMap2, worldUV2).xyz * 2.0 - 1.0;
    vec3 normalDetail3 = texture2D(uNormalMap3, worldUV3).xyz * 2.0 - 1.0;

    vec3 normalDetail = normalize(normalDetail1 * 0.5 + normalDetail2 * 0.3 + normalDetail3 * 0.2);
    waveNormal = normalize(waveNormal + normalDetail * uNormalMapStrength);

    // World position
    vec4 worldPosition = modelMatrix * vec4(pos, 1.0);
    vWorldPosition = worldPosition.xyz;

    // View direction
    vViewDirection = normalize(uCameraPosition - worldPosition.xyz);

    // Distance to camera
    vDistanceToCamera = length(uCameraPosition - worldPosition.xyz);

    // Wave height for foam
    vWaveHeight = displacement.y;

    // Foam factor based on wave height and noise
    float foamNoise = fbm(pos.xz * 0.1 + uTime * 0.5);
    vFoamFactor = smoothstep(0.3, 1.0, displacement.y + foamNoise * 0.3) * uFoamStrength;

    // Normal
    vNormal = normalize(normalMatrix * waveNormal);

    // Final position
    gl_Position = projectionMatrix * viewMatrix * worldPosition;
}
`
}

/**
 * Fragment shader with realistic ocean rendering
 */
function getFragmentShader() {
  return /* glsl */`
precision highp float;

uniform float uTime;
uniform vec3 uCameraPosition;
uniform vec3 uSunDirection;
uniform vec3 uSunColor;
uniform float uSunIntensity;
uniform vec3 uDeepColor;
uniform vec3 uShallowColor;
uniform vec3 uFoamColor;
uniform float uFresnelPower;
uniform float uFresnelBias;
uniform float uFoamThreshold;
uniform float uFoamStrength;
uniform samplerCube uEnvMap;
uniform float uEnvMapIntensity;
uniform vec3 uSkyColor;
uniform vec3 uHorizonColor;

// Normal maps for detail
uniform sampler2D uNormalMap1;
uniform sampler2D uNormalMap2;
uniform sampler2D uNormalMap3;
uniform float uNormalMapScale1;
uniform float uNormalMapScale2;
uniform float uNormalMapScale3;

// Varyings
varying vec3 vWorldPosition;
varying vec3 vNormal;
varying vec2 vUv;
varying float vWaveHeight;
varying float vFoamFactor;
varying vec3 vViewDirection;
varying float vDistanceToCamera;

#define PI 3.14159265359

// ============================================
// NOISE FUNCTIONS
// ============================================

float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);

    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));

    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

// ============================================
// FRESNEL (Schlick's approximation)
// ============================================

float fresnel(vec3 viewDir, vec3 normal, float power, float bias) {
    float cosTheta = max(0.0, dot(viewDir, normal));
    return bias + (1.0 - bias) * pow(1.0 - cosTheta, power);
}

// ============================================
// FOAM PATTERN
// ============================================

float foamPattern(vec2 pos, float time) {
    float n1 = noise(pos * 8.0 + time * 0.3);
    float n2 = noise(pos * 16.0 - time * 0.5);
    float n3 = noise(pos * 32.0 + time * 0.7);

    float foam = n1 * 0.5 + n2 * 0.3 + n3 * 0.2;
    foam = smoothstep(0.4, 0.7, foam);

    return foam;
}

// ============================================
// MAIN
// ============================================

void main() {
    // Base normal (already perturbed by Gerstner waves + normal maps)
    vec3 normal = normalize(vNormal);

    // View direction
    vec3 viewDir = normalize(vViewDirection);

    // Sun direction (towards light)
    vec3 sunDir = normalize(uSunDirection);

    // ============================================
    // SCROLLING NORMAL MAP DETAIL
    // ============================================

    vec2 worldUV1 = vWorldPosition.xz * uNormalMapScale1 + vec2(uTime * 0.06, uTime * 0.04);
    vec2 worldUV2 = vWorldPosition.xz * uNormalMapScale2 + vec2(-uTime * 0.03, uTime * 0.05);
    vec2 worldUV3 = vWorldPosition.xz * uNormalMapScale3 + vec2(uTime * 0.10, -uTime * 0.02);

    vec3 normalDetail1 = texture2D(uNormalMap1, worldUV1).xyz * 2.0 - 1.0;
    vec3 normalDetail2 = texture2D(uNormalMap2, worldUV2).xyz * 2.0 - 1.0;
    vec3 normalDetail3 = texture2D(uNormalMap3, worldUV3).xyz * 2.0 - 1.0;

    vec3 normalDetail = normalize(normalDetail1 * 0.5 + normalDetail2 * 0.3 + normalDetail3 * 0.2);

    // Perturb the main normal with detail
    vec3 perturbedNormal = normalize(normal + normalDetail * 0.2);

    // ============================================
    // FRESNEL REFLECTION
    // ============================================

    float fresnelFactor = fresnel(viewDir, perturbedNormal, uFresnelPower, uFresnelBias);

    // ============================================
    // SKY REFLECTION (procedural)
    // ============================================

    vec3 reflectDir = reflect(-viewDir, perturbedNormal);

    // Sky gradient based on reflection direction
    float skyGradient = smoothstep(-0.1, 0.5, reflectDir.y);
    vec3 skyReflection = mix(uHorizonColor, uSkyColor, skyGradient);

    // Sun reflection in sky
    float sunReflection = pow(max(0.0, dot(reflectDir, sunDir)), 256.0);
    skyReflection += uSunColor * sunReflection * 2.0;

    // ============================================
    // ENVIRONMENT MAP (if available)
    // ============================================

    vec3 envReflection = vec3(0.0);
    #ifdef USE_ENVMAP
    if (uEnvMap != null) {
        envReflection = textureCube(uEnvMap, reflectDir).rgb;
        skyReflection = mix(skyReflection, envReflection, uEnvMapIntensity);
    }
    #endif

    // ============================================
    // WATER COLOR (depth-based)
    // ============================================

    // Base water color with depth variation
    float depthFactor = smoothstep(-2.0, 2.0, vWaveHeight);
    vec3 waterColor = mix(uDeepColor, uShallowColor, depthFactor * 0.5);

    // Add subtle variation based on distance
    float distFactor = smoothstep(0.0, 500.0, vDistanceToCamera);
    waterColor = mix(waterColor, uHorizonColor, distFactor * 0.2);

    // ============================================
    // FOAM AT WAVE CRESTS
    // ============================================

    // Foam based on wave height
    float foamThreshold = uFoamThreshold;
    float foam = 0.0;

    // Wave crest foam
    float crestFoam = smoothstep(foamThreshold - 0.2, foamThreshold + 0.3, vWaveHeight);
    foam += crestFoam;

    // Add foam pattern texture
    float foamTex = foamPattern(vWorldPosition.xz, uTime);
    foam *= foamTex * 0.5 + 0.5;

    // Extra foam from vFoamFactor (passed from vertex shader)
    foam = max(foam, vFoamFactor * 0.5);

    // Subtle foam trail on slopes
    float slopeFoam = smoothstep(0.3, 0.6, abs(dFdx(vWorldPosition.y)) + abs(dFdy(vWorldPosition.y)));
    foam += slopeFoam * 0.3;

    foam = clamp(foam, 0.0, 1.0);

    // ============================================
    // SPECULAR HIGHLIGHTS (Blinn-Phong)
    // ============================================

    vec3 halfVec = normalize(sunDir + viewDir);
    float nDotH = max(0.0, dot(perturbedNormal, halfVec));
    float nDotL = max(0.0, dot(perturbedNormal, sunDir));

    // Multiple specular layers for realistic sparkle
    float specSharp = pow(nDotH, 512.0);  // Tiny glints
    float specMedium = pow(nDotH, 128.0);  // Medium sparkles
    float specBroad = pow(nDotH, 32.0);    // Broad shimmer

    vec3 specular = uSunColor * uSunIntensity * (
        specSharp * 3.0 +
        specMedium * 1.0 +
        specBroad * 0.3
    ) * nDotL;

    // Sun path on water (elongated reflection)
    float sunPath = pow(max(0.0, dot(reflectDir, sunDir)), 8.0);
    specular += uSunColor * uSunIntensity * sunPath * fresnelFactor * 0.5;

    // ============================================
    // SUBSURFACE SCATTERING APPROXIMATION
    // ============================================

    // Light coming through wave peaks (fake SSS)
    float sss = pow(max(0.0, dot(viewDir, -sunDir)), 4.0) * max(0.0, vWaveHeight);
    vec3 sssColor = vec3(0.0, 0.4, 0.3) * sss * 0.5;

    // ============================================
    // FINAL COMPOSITION
    // ============================================

    // Mix water color with sky reflection based on fresnel
    vec3 color = mix(waterColor, skyReflection, fresnelFactor);

    // Add specular highlights
    color += specular;

    // Add subsurface scattering
    color += sssColor;

    // Add foam
    color = mix(color, uFoamColor, foam);

    // ============================================
    // ATMOSPHERIC FOG
    // ============================================

    float fogDensity = 0.0003;
    float fog = 1.0 - exp(-vDistanceToCamera * fogDensity);
    fog = clamp(fog, 0.0, 0.85);

    // Fog color matches horizon
    vec3 fogColor = uHorizonColor;
    color = mix(color, fogColor, fog);

    // ============================================
    // FINAL OUTPUT
    // ============================================

    // Slight transparency at grazing angles and distance
    float alpha = mix(0.92, 0.98, fresnelFactor);
    alpha = mix(alpha, 0.85, fog);

    gl_FragColor = vec4(color, alpha);
}
`
}

// Export
export {
  loadTextures,
  create,
  getVertexShader,
  getFragmentShader,
}
