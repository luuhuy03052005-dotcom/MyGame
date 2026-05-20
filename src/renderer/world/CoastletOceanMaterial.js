/**
 * CoastletOceanMaterial.js — Ocean Surface Shader Material
 *
 * Dựa trên: libraries/Three.js-Ocean-Scene/materials/OceanMaterial.js + shaders/OceanShaders.js
 *
 * Features:
 * - 2 scrolling normal maps cho wave effect
 * - Fresnel reflection/refraction
 * - Specular highlights
 * - Horizon fog blend
 *
 * Public API:
 *   CoastletOceanMaterial.createSurface()
 *   CoastletOceanMaterial.createVolume()
 *   CoastletOceanMaterial.setUniforms(surfaceMaterial, volumeMaterial, lightDir, time, normalMap1, normalMap2)
 */

import * as THREE from 'three'

// Normal map uniforms (shared)
let normalMap1 = null
let normalMap2 = null

const CoastletOceanMaterial = {
  /**
   * Create surface shader material
   * @returns {THREE.ShaderMaterial}
   */
  createSurface() {
    return new THREE.ShaderMaterial({
      vertexShader: _getSurfaceVertexShader(),
      fragmentShader: _getSurfaceFragmentShader(),
      uniforms: {
        _Time: { value: 0 },
        _NormalMap1: { value: null },
        _NormalMap2: { value: null },
        _DirToLight: { value: new THREE.Vector3(0, 1, 0) },
        _Light: { value: new THREE.Color(1, 1, 1) },
      },
      transparent: true,
      side: THREE.DoubleSide,
    })
  },

  /**
   * Create volume shader material (underwater fog)
   * @returns {THREE.ShaderMaterial}
   */
  createVolume() {
    return new THREE.ShaderMaterial({
      vertexShader: _getVolumeVertexShader(),
      fragmentShader: _getVolumeFragmentShader(),
      uniforms: {
        _DirToLight: { value: new THREE.Vector3(0, 1, 0) },
        _Light: { value: new THREE.Color(1, 1, 1) },
      },
      transparent: true,
      side: THREE.DoubleSide,
    })
  },

  /**
   * Load normal map textures
   * @returns {Promise<{normalMap1: THREE.Texture, normalMap2: THREE.Texture}>}
   */
  loadTextures() {
    return new Promise((resolve) => {
      const loader = new THREE.TextureLoader()
      let loaded = 0
      const total = 2

      const onLoad = () => {
        loaded++
        if (loaded >= total) {
          resolve({ normalMap1, normalMap2 })
        }
      }

      normalMap1 = loader.load('./assets/textures/water/waterNormal1.png', () => {
        normalMap1.wrapS = THREE.RepeatWrapping
        normalMap1.wrapT = THREE.RepeatWrapping
        onLoad()
      })

      normalMap2 = loader.load('./assets/textures/water/waterNormal2.png', () => {
        normalMap2.wrapS = THREE.RepeatWrapping
        normalMap2.wrapT = THREE.RepeatWrapping
        onLoad()
      })
    })
  },

  /**
   * Apply uniforms to materials
   */
  applyUniforms(surfaceMaterial, volumeMaterial, lightDir, time) {
    if (surfaceMaterial) {
      surfaceMaterial.uniforms._NormalMap1.value = normalMap1
      surfaceMaterial.uniforms._NormalMap2.value = normalMap2
      surfaceMaterial.uniforms._DirToLight.value.copy(lightDir)
      surfaceMaterial.uniforms._Time.value = time
    }
    if (volumeMaterial) {
      volumeMaterial.uniforms._DirToLight.value.copy(lightDir)
    }
  },
}

/**
 * Surface vertex shader - passes UV and world position
 */
function _getSurfaceVertexShader() {
  return /* glsl */`
    varying vec2 _worldPos;
    varying vec2 _uv;
    varying vec3 _viewDir;
    varying vec3 _normal;

    uniform vec3 cameraPosition;

    void main() {
      vec4 worldPos = modelMatrix * vec4(position, 1.0);
      _worldPos = worldPos.xz;
      _uv = _worldPos * 0.1;  // NORMAL_MAP_SCALE

      _viewDir = normalize(cameraPosition - worldPos.xyz);
      _normal = normalize(normalMatrix * normal);

      gl_Position = projectionMatrix * viewMatrix * worldPos;
    }
  `
}

/**
 * Surface fragment shader - ocean with normal maps, fresnel, specular
 */
function _getSurfaceFragmentShader() {
  return /* glsl */`
    precision highp float;

    uniform float _Time;
    uniform sampler2D _NormalMap1;
    uniform sampler2D _NormalMap2;
    uniform vec3 _DirToLight;
    uniform vec3 _Light;

    varying vec2 _worldPos;
    varying vec2 _uv;
    varying vec3 _viewDir;
    varying vec3 _normal;

    // Wave parameters (from Nugget8)
    const float NORMAL_MAP_STRENGTH = 0.2;
    const vec2 VELOCITY_1 = vec2(0.1, 0.0);
    const vec2 VELOCITY_2 = vec2(0.0, 0.1);
    const float SPECULAR_SHARPNESS = 100.0;

    // Colors
    const vec3 OCEAN_COLOR = vec3(0.2, 0.45, 0.55);  // Deep ocean blue-green
    const vec3 SHALLOW_COLOR = vec3(0.4, 0.7, 0.75);  // Shallow turquoise
    const vec3 SKY_REFLECTION = vec3(0.75, 0.88, 0.95);  // Horizon sky color
    const vec3 FOG_COLOR = vec3(0.85, 0.9, 0.95);

    void main() {
      // Sample animated normal maps
      vec2 uv1 = _uv + VELOCITY_1 * _Time;
      vec2 uv2 = _uv + VELOCITY_2 * _Time;

      vec3 normal1 = texture2D(_NormalMap1, uv1).xyz * 2.0 - 1.0;
      vec3 normal2 = texture2D(_NormalMap2, uv2).xyz * 2.0 - 1.0;

      // Combine normals
      vec3 waveNormal = normalize(normal1 + normal2);
      waveNormal *= NORMAL_MAP_STRENGTH;
      waveNormal += vec3(0.0, 0.0, 1.0);  // Base up
      waveNormal = normalize(waveNormal);

      // Transform normal to world space
      waveNormal = normalize(mat3(modelMatrix) * waveNormal);

      // Fresnel
      float fresnel = pow(1.0 - max(0.0, dot(_viewDir, waveNormal)), 3.0);
      fresnel = mix(0.04, 1.0, fresnel);  // F0 = 0.02 for water

      // Reflection (sky color)
      vec3 reflectDir = reflect(-_viewDir, waveNormal);
      vec3 reflection = mix(SKY_REFLECTION, vec3(1.0), reflectDir.y * 0.5 + 0.5);

      // Refraction (ocean color)
      vec3 refraction = mix(SHALLOW_COLOR, OCEAN_COLOR, 0.6);

      // Specular (sun reflection)
      vec3 halfDir = normalize(_DirToLight + _viewDir);
      float specular = pow(max(0.0, dot(waveNormal, halfDir)), SPECULAR_SHARPNESS);
      specular *= fresnel * 0.5;

      // Combine
      vec3 color = mix(refraction, reflection, fresnel);
      color += vec3(1.0, 0.98, 0.9) * specular;

      // Distance fog
      float dist = length(_viewDir);
      float fog = clamp(dist / 500.0, 0.0, 0.5);
      color = mix(color, FOG_COLOR, fog);

      // Alpha (more opaque at grazing angles)
      float alpha = mix(0.85, 0.98, fresnel);

      gl_FragColor = vec4(color, alpha);
    }
  `
}

/**
 * Volume vertex shader - for underwater box
 */
function _getVolumeVertexShader() {
  return /* glsl */`
    varying vec3 _worldPos;
    varying vec3 _viewDir;

    uniform vec3 cameraPosition;

    void main() {
      vec4 worldPos = modelMatrix * vec4(position, 1.0);
      _worldPos = worldPos.xyz;
      _viewDir = normalize(cameraPosition - worldPos.xyz);

      gl_Position = projectionMatrix * viewMatrix * worldPos;
    }
  `
}

/**
 * Volume fragment shader - underwater color absorption
 */
function _getVolumeFragmentShader() {
  return /* glsl */`
    precision highp float;

    uniform vec3 _DirToLight;
    uniform vec3 _Light;

    varying vec3 _worldPos;
    varying vec3 _viewDir;

    // Absorption coefficients (red absorbs faster)
    const vec3 ABSORPTION = vec3(0.4, 0.15, 0.08);
    const float DENSITY = 0.02;

    void main() {
      // Calculate view depth through water
      float depth = -_worldPos.y;
      vec3 absorption = exp(-ABSORPTION * depth * DENSITY);

      // Light from above
      float light = max(0.3, dot(_viewDir, vec3(0.0, 1.0, 0.0)));

      // Deep water color
      vec3 waterColor = vec3(0.05, 0.15, 0.25) * absorption * light;

      // Surface caustic hints
      float caustic = sin(_worldPos.x * 0.5 + _worldPos.z * 0.3) * 0.5 + 0.5;
      caustic = pow(caustic, 3.0) * 0.1;
      waterColor += vec3(caustic);

      float alpha = clamp(depth * 0.005, 0.0, 0.8);

      gl_FragColor = vec4(waterColor, alpha);
    }
  `
}

export { CoastletOceanMaterial }
