/**
 * Skybox.js — Procedural skybox system
 * Fixed for modern Three.js ES modules
 * Based on Nugget8/Three.js-Ocean-Scene scene/Skybox.js (MIT License)
 */

import * as THREE from 'three'
import { injectShaderChunks } from './shaders/Settings.js'

export const skybox = new THREE.Mesh()
export const dirToLight = new THREE.Vector3()
export const rotationMatrix = new THREE.Matrix3()

const HALF_SIZE = 2000
const SPEED = 0.02
const initial = new THREE.Vector3(0, 1, 0)
const axis = new THREE.Vector3(0, 0, 1).applyAxisAngle(new THREE.Vector3(0, 1, 0), THREE.MathUtils.degToRad(-30))
let angle = -1

let skyMaterial = null

function setSkyRotationMatrix(a) {
    const cos = Math.cos(a)
    const cos1 = 1 - cos
    const sin = Math.sin(a)
    const u = axis
    const u2 = u.clone().multiply(u)
    rotationMatrix.set(
        cos + u2.x * cos1, u.x * u.y * cos1 - u.z * sin, u.x * u.z * cos1 + u.y * sin,
        u.y * u.x * cos1 + u.z * sin, cos + u2.y * cos1, u.y * u.z * cos1 - u.x * sin,
        u.z * u.x * cos1 - u.y * sin, u.z * u.y * cos1 + u.x * sin, cos + u2.z * cos1
    )
}

export function Start(scene) {
    injectShaderChunks()

    // Create skybox geometry (cube)
    const vertices = new Float32Array([
        -HALF_SIZE, -HALF_SIZE, -HALF_SIZE,
        HALF_SIZE, -HALF_SIZE, -HALF_SIZE,
        -HALF_SIZE, -HALF_SIZE, HALF_SIZE,
        HALF_SIZE, -HALF_SIZE, HALF_SIZE,
        -HALF_SIZE, HALF_SIZE, -HALF_SIZE,
        HALF_SIZE, HALF_SIZE, -HALF_SIZE,
        -HALF_SIZE, HALF_SIZE, HALF_SIZE,
        HALF_SIZE, HALF_SIZE, HALF_SIZE,
    ])

    const indices = [
        2, 3, 0, 3, 1, 0,
        0, 1, 4, 1, 5, 4,
        1, 3, 5, 3, 7, 5,
        3, 2, 7, 2, 6, 7,
        2, 0, 6, 0, 4, 6,
        4, 5, 6, 5, 7, 6
    ]

    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3))
    geometry.setAttribute('coord', new THREE.BufferAttribute(vertices.slice(), 3))
    geometry.setIndex(indices)

    // Sky shader material
    skyMaterial = new THREE.ShaderMaterial({
        vertexShader: getSkyboxVertexShader(),
        fragmentShader: getSkyboxFragmentShader(),
        uniforms: {
            _SkyRotationMatrix: { value: rotationMatrix },
            _SunVisibility: { value: 1.0 },
            _TwilightTime: { value: 0.0 },
            _TwilightVisibility: { value: 0.0 },
        },
        side: THREE.BackSide,
        depthWrite: false,
    })

    skybox.geometry = geometry
    skybox.material = skyMaterial
    skybox.name = 'skybox'
    skybox.frustumCulled = false
    skybox.userData.ignoreRaycast = true

    scene.add(skybox)

    setSkyRotationMatrix(angle)
    initial.applyMatrix3(rotationMatrix)
    dirToLight.set(-initial.x, initial.y, -initial.z)
    initial.set(0, 1, 0)

    console.log('[Nugget8] Skybox initialized')
}

export function Update(deltaTime) {
    if (!skybox) return

    angle += deltaTime * SPEED
    setSkyRotationMatrix(angle)
    initial.applyMatrix3(rotationMatrix)
    dirToLight.set(-initial.x, initial.y, -initial.z)
    initial.set(0, 1, 0)

    // Update sky material uniforms
    if (skyMaterial) {
        skyMaterial.uniforms._SkyRotationMatrix.value.copy(rotationMatrix)
    }

    // Skybox follows camera
    skybox.position.copy(THREE._tempCamera ? THREE._tempCamera.position : new THREE.Vector3())
}

function getSkyboxVertexShader() {
    return `
        uniform mat3 _SkyRotationMatrix;
        varying vec3 vWorldPos;
        varying vec3 vCoord;

        void main() {
            vWorldPos = position;
            vCoord = _SkyRotationMatrix * vWorldPos;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
    `
}

function getSkyboxFragmentShader() {
    return `
        precision highp float;

        uniform float _SunVisibility;
        uniform float _TwilightTime;
        uniform float _TwilightVisibility;

        varying vec3 vWorldPos;
        varying vec3 vCoord;

        const float PI = 3.14159265359;
        const float SUN_SHARPNESS = 2000.0;
        const float SUN_SIZE = 5.0;

        void main() {
            vec3 worldDir = normalize(vWorldPos);
            vec3 viewDir = normalize(vCoord);

            // Sky gradient
            float density = pow(1.0 - max(0.0, worldDir.y), 2.0);

            // Colors
            vec3 dayColor = mix(vec3(0.45, 0.65, 0.85), vec3(0.75, 0.88, 0.95), density);
            vec3 twilightColor = mix(vec3(1.0, 0.4, 0.2), vec3(1.0, 0.83, 0.5), _TwilightTime);
            vec3 horizonColor = vec3(0.85, 0.9, 0.95);

            // Sun
            float sunLight = max(0.0, dot(viewDir, vec3(0.0, 1.0, 0.0)));
            float sun = min(pow(sunLight, SUN_SHARPNESS) * SUN_SIZE, 1.0);

            // Mix sky colors
            vec3 sky = mix(dayColor, dayColor, _SunVisibility);
            sky = mix(sky, twilightColor, density * _TwilightVisibility * 0.5);

            // Horizon blend
            float horizonBlend = pow(1.0 - abs(worldDir.y), 4.0);
            sky = mix(sky, horizonColor, horizonBlend * 0.4);

            // Sun glow
            sky += vec3(1.0, 0.95, 0.8) * sun * 0.8;

            // Fog blend at horizon
            float fogBlend = pow(max(0.0, 1.0 - worldDir.y), 6.0);
            vec3 fogColor = vec3(0.8, 0.88, 0.92);
            sky = mix(sky, fogColor, fogBlend * 0.3);

            gl_FragColor = vec4(sky, 1.0);
        }
    `
}
