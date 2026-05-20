/**
 * Settings.js — Shader chunk definitions
 * Fixed version for modern Three.js ES modules
 * Based on Nugget8/Three.js-Ocean-Scene shaders/Settings.js (MIT License)
 */

import * as THREE from 'three'

export function injectShaderChunks() {
    if (THREE.ShaderChunk.nugget_global) return

    // Global constants
    THREE.ShaderChunk['nugget_global'] = `
        const float FOG_DISTANCE = 1000.0;
    `

    // Skybox chunk
    THREE.ShaderChunk['nugget_skybox'] = `
        const float DITHER_STRENGTH = 0.1;
        const vec3 DAY_SKY_COLOR = vec3(0.25, 0.4, 0.6);
        const vec3 DAY_HORIZON_COLOR = vec3(0.75, 0.9, 1.0);
        const vec3 EARLY_TWILIGHT_COLOR = vec3(1.0, 0.83, 0.5);
        const vec3 LATE_TWILIGHT_COLOR = vec3(1.0, 0.333, 0.167);
        const vec3 NIGHT_SKY_COLOR = vec3(0.06, 0.1, 0.15);
        const vec3 NIGHT_HORIZON_COLOR = vec3(0.07, 0.13, 0.18);
        const float SUN_SHARPNESS = 2000.0;
        const float SUN_SIZE = 5.0;
        const float STARS_SHARPNESS = 50.0;
        const float STARS_SIZE = 10.0;
        const vec3 UP = vec3(0.0, 1.0, 0.0);

        uniform sampler2D _DitherTexture;
        uniform vec2 _DitherTextureSize;
        uniform float _SunVisibility;
        uniform float _TwilightTime;
        uniform float _TwilightVisibility;
        uniform sampler2D _Stars;
        uniform float _GridSize;
        uniform float _GridSizeScaled;
        uniform float _SpecularVisibility;
        uniform vec3 _DirToLight;
        uniform vec3 _Light;
    `

    // Ocean chunk
    THREE.ShaderChunk['nugget_ocean'] = `
        const float NORMAL_MAP_SCALE = 0.1;
        const float NORMAL_MAP_STRENGTH = 0.2;
        const vec2 VELOCITY_1 = vec2(0.1, 0.0);
        const vec2 VELOCITY_2 = vec2(0.0, 0.1);
        const float SPECULAR_SHARPNESS = 100.0;
        const float SPECULAR_SIZE = 1.1;
        const float MAX_VIEW_DEPTH = 100.0;
        const float DENSITY = 0.35;
        const float MAX_VIEW_DEPTH_DENSITY = MAX_VIEW_DEPTH * DENSITY;
        const vec3 ABSORPTION = vec3(1.0) / vec3(10.0, 40.0, 100.0);
        const float CRITICAL_ANGLE = 0.64287; // asin(1.0/1.33)

        uniform float _Time;
        uniform sampler2D _NormalMap1;
        uniform sampler2D _NormalMap2;
    `

    console.log('[Nugget8] Shader chunks injected')
}
