const registrations = new Map()

let sceneRef = null
let cameraRef = null
let elapsed = 0
let enabled = true

const AmbientLifeSystem = {
  init({ scene, camera, renderLoop } = {}) {
    sceneRef = scene ?? null
    cameraRef = camera ?? null
    if (renderLoop?.onTick) {
      renderLoop.onTick((delta) => AmbientLifeSystem.update(delta))
    }
    console.log('[AmbientLifeSystem] Initialized')
  },

  registerObject(object, type = 'auto', metadata = {}) {
    if (!object) return

    object.traverse?.((child) => {
      const aliveType = child.userData?.aliveType
      if (!aliveType && type === 'auto') return
      registrations.set(child.uuid, {
        object: child,
        type: aliveType ?? type,
        metadata,
        baseRotationY: child.rotation?.y ?? 0,
        baseRotationZ: child.rotation?.z ?? 0,
        baseScaleY: child.scale?.y ?? 1,
      })
    })

    if (type !== 'auto') {
      registrations.set(object.uuid, {
        object,
        type,
        metadata,
        baseRotationY: object.rotation?.y ?? 0,
        baseRotationZ: object.rotation?.z ?? 0,
        baseScaleY: object.scale?.y ?? 1,
      })
    }
  },

  unregisterObject(object) {
    if (!object) return
    object.traverse?.((child) => registrations.delete(child.uuid))
    registrations.delete(object.uuid)
  },

  setEnabled(value) {
    enabled = Boolean(value)
  },

  update(delta = 0) {
    if (!enabled || registrations.size === 0) return
    elapsed += delta

    for (const entry of registrations.values()) {
      const object = entry.object
      if (!object?.parent && object !== sceneRef) {
        registrations.delete(object.uuid)
        continue
      }

      if (entry.type === 'plantSway') {
        object.rotation.z = entry.baseRotationZ + Math.sin(elapsed * 1.7 + object.id) * 0.025
      } else if (entry.type === 'windowLight') {
        if (object.material?.emissiveIntensity !== undefined) {
          object.material.emissiveIntensity = 0.08 + Math.sin(elapsed * 3.1 + object.id) * 0.025
        }
      } else if (entry.type === 'chimneySmoke') {
        object.scale.y = entry.baseScaleY + Math.sin(elapsed * 1.2 + object.id) * 0.035
      } else if (entry.type === 'foamPulse') {
        object.scale.y = entry.baseScaleY + Math.sin(elapsed * 2.4 + object.id) * 0.08
      }
    }
  },

  clear() {
    registrations.clear()
    elapsed = 0
  },
}

export { AmbientLifeSystem }
