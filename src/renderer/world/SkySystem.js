/**
 * SkySystem.js - Beautiful procedural sky with atmospheric scattering
 */
import * as THREE from 'three'

let scene = null
let camera = null
let skyRoot = null
let skyMesh = null
let skyMat = null
let elapsed = 0

// Sun position: ~35 degrees elevation
const SUN_DIR = new THREE.Vector3(0.5, 0.6, 0.4).normalize()

const SkySystem = {
  init({ scene: sc, camera: cam }) {
    scene = sc
    camera = cam
    skyRoot = new THREE.Group()
    scene.add(skyRoot)
    _makeMesh()
  },

  update(dt) {
    if (!skyRoot) return
    elapsed += dt
    // Follow camera for infinite sky illusion
    skyRoot.position.set(camera.position.x, camera.position.y, camera.position.z)
    if (skyMat) {
      skyMat.uniforms.uTime.value = elapsed
    }
  },

  getLightDirection() { return SUN_DIR.clone() },

  dispose() {
    if (skyMesh) { scene.remove(skyMesh); skyMesh.geometry?.dispose(); skyMesh.material?.dispose() }
    skyRoot = null
  }
}

function _makeMesh() {
  const geo = new THREE.SphereGeometry(1500, 48, 48)
  geo.scale(-1, 1, 1)

  skyMat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uSunDir: { value: SUN_DIR },
    },
    vertexShader: `
varying vec3 vDir;
varying vec3 vWorldPos;
void main() {
  vDir = position;
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorldPos = wp.xyz;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
    `,
    fragmentShader: `
precision highp float;
uniform float uTime;
uniform vec3 uSunDir;
varying vec3 vDir;
varying vec3 vWorldPos;

#define PI 3.14159265359

// Rayleigh-inspired sky color model
vec3 getSkyColor(vec3 dir, vec3 sunDir) {
  vec3 d = normalize(dir);
  float y = d.y;

  // Sun-related geometry
  float cosGamma = max(-1.0, min(1.0, dot(d, sunDir)));

  // === SKY GRADIENT ===
  // Deep blue at zenith
  vec3 zenithBlue = vec3(0.20, 0.42, 0.78);
  // Mid sky blue
  vec3 midBlue = vec3(0.45, 0.68, 0.88);
  // Bright sky at horizon
  vec3 horizonBlue = vec3(0.72, 0.85, 0.96);
  // Warm horizon glow
  vec3 warmHorizon = vec3(0.92, 0.80, 0.65);

  // Smooth gradient
  float tZen = smoothstep(0.0, 0.25, y);
  float tMid = smoothstep(0.25, 0.85, y);
  vec3 skyCol = mix(horizonBlue, midBlue, tZen);
  skyCol = mix(skyCol, zenithBlue, tMid);

  // === SUN GLOW / CORONA ===
  // Wide warm glow
  float glow1 = pow(max(0.0, cosGamma), 6.0) * 0.5;
  // Medium glow
  float glow2 = pow(max(0.0, cosGamma), 20.0) * 1.5;
  // Sharp corona
  float glow3 = pow(max(0.0, cosGamma), 80.0) * 4.0;
  // Sun disk
  float sunDisk = smoothstep(0.9993, 0.9997, cosGamma);

  // Sun color: warm golden near horizon, bright white at zenith
  vec3 sunNearHorizon = vec3(1.0, 0.78, 0.45);
  vec3 sunAtSky = vec3(1.0, 0.96, 0.90);
  float sunPosFactor = smoothstep(0.0, 0.3, sunDir.y);
  vec3 sunGlowColor = mix(sunNearHorizon, sunAtSky, sunPosFactor);

  skyCol += sunGlowColor * glow1;
  skyCol += vec3(1.0, 0.95, 0.82) * glow2;
  skyCol += vec3(1.0, 1.0, 0.95) * glow3;
  skyCol += vec3(1.3, 1.2, 1.0) * sunDisk;

  // === ATMOSPHERIC SCATTERING near horizon ===
  // Red-orange tint near horizon from Rayleigh scattering
  float hzProximity = pow(1.0 - abs(y), 3.0);
  vec3 scattering = mix(vec3(0.85, 0.65, 0.40), warmHorizon, 0.5);
  skyCol = mix(skyCol, scattering, hzProximity * 0.25);

  // === BELOW HORIZON ===
  if (y < 0.0) {
    float belowT = smoothstep(0.0, -0.12, y);
    skyCol = mix(skyCol, vec3(0.12, 0.18, 0.28), belowT);
  }

  // === SUBTLE CLOUD WISPS near horizon ===
  float cloudNoise = sin(d.x * 12.0 + uTime * 0.008) * cos(d.z * 9.0 + uTime * 0.006);
  cloudNoise += sin(d.x * 7.0 - uTime * 0.004) * cos(d.z * 11.0);
  cloudNoise = cloudNoise * 0.5 + 0.5;
  float cloudMask = hzProximity * cloudNoise * 0.08;
  skyCol = mix(skyCol, vec3(0.96, 0.94, 0.91), cloudMask);

  return skyCol;
}

void main() {
  vec3 sky = getSkyColor(vDir, uSunDir);
  gl_FragColor = vec4(sky, 1.0);
}
    `,
    side: THREE.BackSide,
    depthWrite: false,
  })

  skyMesh = new THREE.Mesh(geo, skyMat)
  skyMesh.name = 'skybox'
  skyMesh.userData.ignoreRaycast = true
  skyMesh.renderOrder = -100
  skyRoot.add(skyMesh)
}

export { SkySystem }
