/**
 * nugget-demo.js — Isolated Nugget8 Ocean Scene Proof-of-Life
 * ===========================================================
 * Recreation of Three.js-Ocean-Scene by Nugget8 in Vite/Electron.
 * NOT connected to the game — this is a standalone demo.
 *
 * Startup order mirrors original Scene.js Start():
 * 1. Settings.Start() — inject ShaderChunk
 * 2. Time.Start() — start clock
 * 3. SkyboxMaterial.Start() — init skybox material + procedural textures
 * 4. Skybox.Start() — create skybox mesh
 * 5. OceanMaterial.Start() — init ocean materials + procedural normal maps
 * 6. Ocean.Start() — create ocean surface + volume
 * 7. scene.add(skybox) + scene.add(oceanSurface)
 * 8. applySkyboxUniforms() — connect skybox uniforms to all materials
 * 9. animate() loop
 */

import * as THREE from 'three'

// ===== INTERCEPT CONSOLE TO DISPLAY IN-APP =====
(function () {
  const panel = document.getElementById('console-panel')
  if (!panel) return

  function append(level, args) {
    const line = document.createElement('div')
    line.className = level
    const text = Array.from(args)
      .map(a => typeof a === 'object' ? JSON.stringify(a) : String(a))
      .join(' ')
    line.textContent = `[${new Date().toLocaleTimeString()}] ${text}`
    panel.appendChild(line)
    panel.scrollTop = panel.scrollHeight
    while (panel.children.length > 50) panel.removeChild(panel.firstChild)
  }

  const _log = console.log.bind(console)
  const _warn = console.warn.bind(console)
  const _error = console.error.bind(console)

  console.log = (...a) => { _log(...a); append('info', a) }
  console.warn = (...a) => { _warn(...a); append('warn', a) }
  console.error = (...a) => { _error(...a); append('error', a) }

  window.addEventListener('error', (e) => append('error', [e.message + ' (line ' + e.lineno + ')']))
})()

console.log('[NuggetDemo] Starting Nugget8 Ocean Scene Proof-of-Life...')

// ===== VENDOR IMPORTS =====
import { Start as SettingsStart } from '../vendor/nugget8-ocean-scene/shaders/Settings.js'
import { Start as TimeStart, Update as TimeUpdate, timeUniform, deltaTime } from '../vendor/nugget8-ocean-scene/scripts/Time.js'
import { Start as SkyboxMaterialStart, material as skyboxMaterial, SetSkyboxUniforms } from '../vendor/nugget8-ocean-scene/materials/SkyboxMaterial.js'
import { Start as SkyboxStart, Update as SkyboxUpdate, skybox, dirToLight, rotationMatrix, setCamera as setSkyboxCamera } from '../vendor/nugget8-ocean-scene/scene/Skybox.js'
import { Start as OceanMaterialsStart, surface as oceanSurface, volume as oceanVolume, applySkyboxUniforms, setCameraForward as setOceanCameraForward } from '../vendor/nugget8-ocean-scene/materials/OceanMaterial.js'
import { Start as OceanStart, Update as OceanUpdate, surface as oceanSurfaceMesh, setCamera as setOceanCamera } from '../vendor/nugget8-ocean-scene/scene/Ocean.js'

// ===== RENDERER (mirrors Scene.js) =====
const renderer = new THREE.WebGLRenderer({ antialias: false })
renderer.setPixelRatio(window.devicePixelRatio)
renderer.setSize(window.innerWidth, window.innerHeight)
renderer.autoClearColor = false
document.body.appendChild(renderer.domElement)

const scene = new THREE.Scene()

const camera = new THREE.PerspectiveCamera()
camera.fov = 70
camera.aspect = window.innerWidth / window.innerHeight
camera.near = 0.3
camera.far = 4000
camera.updateProjectionMatrix()
camera.position.set(0, 1, 0)

const cameraRight = new THREE.Vector3()
const cameraUp = new THREE.Vector3()
const cameraForward = new THREE.Vector3()

function UpdateCameraRotation() {
  cameraRight.set(1, 0, 0).applyQuaternion(camera.quaternion)
  cameraUp.set(0, 1, 0).applyQuaternion(camera.quaternion)
  cameraForward.set(0, 0, -1).applyQuaternion(camera.quaternion)
}
UpdateCameraRotation()

// ===== RESIZE =====
window.addEventListener('resize', () => {
  const w = window.innerWidth
  const h = window.innerHeight
  renderer.setSize(w, h)
  camera.aspect = w / h
  camera.updateProjectionMatrix()
})

// ===== MENU SYSTEM =====
const overlay = document.getElementById('overlay')
const menuBtn = document.getElementById('menu-btn')
const resumeBtn = document.getElementById('resume-btn')

menuBtn.addEventListener('click', () => {
  overlay.classList.remove('hidden')
  document.exitPointerLock?.()
})
resumeBtn.addEventListener('click', () => overlay.classList.add('hidden'))

document.addEventListener('keydown', (e) => {
  if (e.code === 'Escape') {
    overlay.classList.remove('hidden')
    document.exitPointerLock?.()
  }
})

// ===== INPUT / CAMERA CONTROL =====
const keysPressed = new Set()
let pointerLocked = false
let yaw = 0
let pitch = 0
const lookSensitivity = 0.002
const moveVector = new THREE.Vector3()
const targetMoveVector = new THREE.Vector3()

document.addEventListener('keydown', (e) => keysPressed.add(e.code))
document.addEventListener('keyup', (e) => keysPressed.delete(e.code))

renderer.domElement.addEventListener('click', () => {
  if (overlay.classList.contains('hidden')) {
    renderer.domElement.requestPointerLock()
  }
})

document.addEventListener('pointerlockchange', () => {
  pointerLocked = !!document.pointerLockElement
  if (pointerLocked) overlay.classList.add('hidden')
})

document.addEventListener('mousemove', (e) => {
  if (!pointerLocked) return
  yaw -= e.movementX * lookSensitivity
  pitch = Math.max(-Math.PI / 2 + 0.01, Math.min(Math.PI / 2 - 0.01, pitch - e.movementY * lookSensitivity))
})

const baseMoveSpeed = 10
const smoothSpeed = 15

function UpdateControl(dt) {
  targetMoveVector.set(0, 0, 0)
  if (keysPressed.has('KeyA')) targetMoveVector.x -= 1
  if (keysPressed.has('KeyD')) targetMoveVector.x += 1
  if (keysPressed.has('KeyQ')) targetMoveVector.y -= 1
  if (keysPressed.has('KeyE')) targetMoveVector.y += 1
  if (keysPressed.has('KeyS')) targetMoveVector.z -= 1
  if (keysPressed.has('KeyW')) targetMoveVector.z += 1

  moveVector.x += (targetMoveVector.x - moveVector.x) * Math.min(smoothSpeed * dt, 1)
  moveVector.y += (targetMoveVector.y - moveVector.y) * Math.min(smoothSpeed * dt, 1)
  moveVector.z += (targetMoveVector.z - moveVector.z) * Math.min(smoothSpeed * dt, 1)

  const len = moveVector.length()
  if (len > 1) moveVector.divideScalar(len)

  const speed = keysPressed.has('ShiftLeft') ? baseMoveSpeed * 5 : baseMoveSpeed
  camera.position.addScaledVector(cameraRight, moveVector.x * speed * dt)
  camera.position.y += moveVector.y * speed * dt
  camera.position.addScaledVector(cameraForward, moveVector.z * speed * dt)

  const qx = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, -1, 0), yaw)
  const qy = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), pitch)
  camera.quaternion.copy(qx.clone().multiply(qy))
  UpdateCameraRotation()
}

// ===== DEBUG INFO =====
const debugInfo = document.getElementById('debug-info')
let fps = 0, frameCount = 0, lastFpsTime = performance.now()

// ===== STARTUP — mirrors Scene.js + Skybox.js order =====
SettingsStart()
TimeStart()
SkyboxMaterialStart()
SkyboxStart()
skybox.material = skyboxMaterial
setSkyboxCamera(camera)

OceanMaterialsStart()
OceanStart()

// Set camera references
setOceanCamera(camera)

// Add to scene (mirrors Scene.js)
scene.add(skybox)
scene.add(oceanSurfaceMesh)

console.log('[NuggetDemo] Skybox added:', !!skybox.parent)
console.log('[NuggetDemo] Skybox material:', !!skybox.material)
console.log('[NuggetDemo] Skybox material.side:', skybox.material?.side)
console.log('[NuggetDemo] Skybox _SkyRotationMatrix:', skybox.material?.uniforms?._SkyRotationMatrix?.value ? 'SET' : 'NULL')
console.log('[NuggetDemo] Skybox _DirToLight:', skybox.material?.uniforms?._DirToLight?.value ? 'SET' : 'NULL')
console.log('[NuggetDemo] Ocean surface added:', !!oceanSurfaceMesh.parent)
console.log('[NuggetDemo] Ocean surface position:', oceanSurfaceMesh.position.x, 0, oceanSurfaceMesh.position.z)
console.log('[NuggetDemo] Camera position:', camera.position.x, camera.position.y, camera.position.z)
console.log('[NuggetDemo] Ocean surface uniforms _NormalMap1:', oceanSurface.uniforms?._NormalMap1?.value?.image?.width)
console.log('[NuggetDemo] Ocean surface uniforms _Time:', oceanSurface.uniforms?._Time?.value)

// Apply skybox uniforms (MUST be after setSkyboxRefs)
SetSkyboxUniforms(skybox.material, rotationMatrix, dirToLight) // Apply to skybox material
applySkyboxUniforms(rotationMatrix, dirToLight) // Apply to ocean materials

console.log('[NuggetDemo] Skybox uniforms _SkyRotationMatrix:', !!skybox.material.uniforms?._SkyRotationMatrix)
console.log('[NuggetDemo] Skybox uniforms _DitherTexture:', !!skybox.material.uniforms?._DitherTexture)
console.log('[NuggetDemo] Skybox uniforms _DirToLight:', !!skybox.material.uniforms?._DirToLight)

// ===== RENDER LOOP =====
let lastTime = performance.now()

function animate() {
  requestAnimationFrame(animate)

  const now = performance.now()
  const dt = Math.min((now - lastTime) / 1000, 0.1)
  lastTime = now

  TimeUpdate()
  UpdateControl(dt)
  SkyboxUpdate()
  OceanUpdate()

  // Update cameraForward for ocean material spot lighting
  setOceanCameraForward(cameraForward)

  renderer.render(scene, camera)

  // Debug logs (first 5 frames)
  if (frameCount < 5) {
    console.log(`[NuggetDemo] Frame ${frameCount}: time=${timeUniform.value.toFixed(2)}, light=(${dirToLight.x.toFixed(2)},${dirToLight.y.toFixed(2)},${dirToLight.z.toFixed(2)})`)
  }

  frameCount++
  if (now - lastFpsTime >= 1000) {
    fps = frameCount
    frameCount = 0
    lastFpsTime = now
    debugInfo.textContent = `FPS: ${fps} | Pos: (${camera.position.x.toFixed(0)}, ${camera.position.y.toFixed(1)}, ${camera.position.z.toFixed(0)}) | t: ${timeUniform.value.toFixed(1)}`
  }
}

animate()
console.log('[NuggetDemo] Render loop started ✅')
console.log('[NuggetDemo] Navigate with WASD/Q/E and mouse. Click to lock pointer.')
