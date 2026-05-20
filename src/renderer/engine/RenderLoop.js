/**
 * RenderLoop.js — requestAnimationFrame loop + Tween Engine
 *
 * Public API:
 *   RenderLoop.init(sceneManager, cameraController)
 *   RenderLoop.start()
 *   RenderLoop.stop()
 *   RenderLoop.onTick(callback)     ← đăng ký callback chạy mỗi frame
 *   RenderLoop.addTween(config)     → TweenHandle (Phase 5)
 *   RenderLoop.removeTween(handle)  (Phase 5)
 */

let sceneManager = null
let cameraController = null
let rafId = null
let lastTimestamp = 0
let isRunning = false

// Danh sách callbacks mỗi frame (game logic, water shader, etc.)
const tickCallbacks = []

// Tween engine (Phase 5) — placeholder trong Phase 0
const tweens = new Map()
let tweenNextId = 0

const RenderLoop = {
  /**
   * @param {object} sm - SceneManager
   * @param {object} cc - CameraController
   */
  init(sm, cc) {
    sceneManager = sm
    cameraController = cc
    console.log('[RenderLoop] Initialized')
  },

  start() {
    if (isRunning) return
    isRunning = true
    lastTimestamp = performance.now()
    rafId = requestAnimationFrame(tick)
    console.log('[RenderLoop] Started')
  },

  stop() {
    if (!isRunning) return
    isRunning = false
    if (rafId) {
      cancelAnimationFrame(rafId)
      rafId = null
    }
    console.log('[RenderLoop] Stopped')
  },

  /**
   * Đăng ký callback chạy mỗi frame.
   * @param {(delta: number) => void} callback - delta là seconds
   * @returns {Function} unsubscribe function
   */
  onTick(callback) {
    tickCallbacks.push(callback)
    return () => {
      const idx = tickCallbacks.indexOf(callback)
      if (idx !== -1) tickCallbacks.splice(idx, 1)
    }
  },

  /**
   * Thêm tween animation.
   * Phase 5 implementation — hiện là placeholder.
   *
   * @param {object} config - TweenConfig theo ARCHITECTURE.md 2.3
   * @returns {number} handle id
   */
  addTween(config) {
    const id = tweenNextId++
    tweens.set(id, {
      ...config,
      elapsed: 0,
      done: false,
    })
    return id
  },

  /**
   * Thêm chuỗi tween chạy liên tiếp.
   * @param {Array} steps - Mảng cấu hình Tween
   */
  addTweenSequence(steps) {
    if (!steps || steps.length === 0) return

    let currentStep = 0
    
    const playNext = () => {
      if (currentStep >= steps.length) return
      
      const stepConfig = steps[currentStep]
      currentStep++
      
      const originalOnComplete = stepConfig.onComplete
      stepConfig.onComplete = () => {
        if (originalOnComplete) originalOnComplete()
        playNext()
      }
      
      // Auto populate 'from' if missing based on object's current state
      if (!stepConfig.from && stepConfig.to) {
        stepConfig.from = {}
        for (const key of Object.keys(stepConfig.to)) {
           stepConfig.from[key] = getNestedProp(stepConfig.object, key)
        }
      }
      
      this.addTween(stepConfig)
    }
    
    playNext()
  },

  /** @param {number} handle */
  removeTween(handle) {
    tweens.delete(handle)
  },
}

// ===== Main Loop =====

function tick(timestamp) {
  if (!isRunning) return

  rafId = requestAnimationFrame(tick)

  const delta = Math.min((timestamp - lastTimestamp) / 1000, 0.1)  // seconds, cap 100ms
  lastTimestamp = timestamp

  // 1. Camera smooth damping
  cameraController.update(delta)

  // 2. Game tick callbacks (water shader, etc. — Phase 5)
  for (const cb of tickCallbacks) {
    try {
      cb(delta)
    } catch (err) {
      console.error('[RenderLoop] Tick callback error:', err)
    }
  }

  // 3. Process tweens (Phase 5)
  processTweens(delta)

  // 4. Render frame
  sceneManager.render()
}

/**
 * Xử lý tất cả tween animation đang chạy.
 */
function processTweens(delta) {
  if (tweens.size === 0) return

  tweens.forEach((tween, id) => {
    tween.elapsed += delta * 1000  // ms
    const t = Math.min(tween.elapsed / tween.duration, 1)

    const currentValues = {}
    // Apply tween values
    for (const [key, fromVal] of Object.entries(tween.from || {})) {
      const toVal = tween.to[key] ?? fromVal
      const value = lerp(fromVal, toVal, easingFn(t, tween.easing))
      setNestedProp(tween.object, key, value)
      currentValues[key] = value
    }

    if (tween.onStep) {
      tween.onStep(currentValues)
    }

    if (t >= 1) {
      tween.done = true
      if (tween.onComplete) tween.onComplete()
      tweens.delete(id)
    }
  })
}

// ===== Helpers =====

function lerp(a, b, t) {
  return a + (b - a) * t
}

function easingFn(t, name) {
  switch (name) {
    case 'easeOut':     return 1 - Math.pow(1 - t, 2)
    case 'easeOutBack': return 1 + 2.70158 * Math.pow(t - 1, 3) + 1.70158 * Math.pow(t - 1, 2)
    case 'easeInBack':  return 2.70158 * t * t * t - 1.70158 * t * t
    case 'power2Out':   return 1 - (1 - t) * (1 - t)
    case 'power2In':    return t * t
    case 'power2InOut': return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2
    case 'elasticOut': {
      if (t === 0) return 0
      if (t === 1) return 1
      const c4 = (2 * Math.PI) / 3
      return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1
    }
    default:            return t  // linear
  }
}

/** Get nested property từ string key như 'scale.x' */
function getNestedProp(obj, key) {
  const parts = key.split('.')
  let current = obj
  for (let i = 0; i < parts.length; i++) {
    current = current[parts[i]]
    if (current === undefined) return undefined
  }
  return current
}

/** Set nested property từ string key như 'scale.x' */
function setNestedProp(obj, key, value) {
  const parts = key.split('.')
  let current = obj
  for (let i = 0; i < parts.length - 1; i++) {
    current = current[parts[i]]
    if (!current) return
  }
  current[parts[parts.length - 1]] = value
}

export { RenderLoop }
