import * as THREE from 'three'

const MAX_PARTICLES = 80
const pool = []
const activeParticles = new Set()

const ParticleSystem = {
  init(scene) {
    // 1 common geometry
    const geometry = new THREE.CircleGeometry(0.08, 6)
    
    // Base material
    const baseMaterial = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 1,
      depthWrite: false, // Giúp các hạt không che khuất nhau
    })

    for (let i = 0; i < MAX_PARTICLES; i++) {
      const material = baseMaterial.clone()
      const mesh = new THREE.Mesh(geometry, material)
      mesh.visible = false
      mesh.userData = {
        velocity: new THREE.Vector3(),
        life: 0,
        maxLife: 0,
      }
      scene.add(mesh)
      pool.push(mesh)
    }
    console.log(`[ParticleSystem] Initialized pool with ${MAX_PARTICLES} particles`)
  },

  /**
   * Sinh hạt bụi (world coordinates)
   * @param {Object} params - { position: THREE.Vector3, color: string, count: number }
   */
  spawnDust({ position, color, count = 10 }) {
    if (pool.length === 0) return // chưa init

    const pColor = color ? new THREE.Color(color).lerp(new THREE.Color(0xffffff), 0.3) : new THREE.Color(0xffffff)

    let spawned = 0
    for (let i = 0; i < pool.length && spawned < count; i++) {
      const p = pool[i]
      if (!p.visible) {
        // Khởi tạo vị trí tản ra xung quanh chân tường một chút
        p.position.copy(position)
        p.position.x += (Math.random() - 0.5) * 0.5
        p.position.z += (Math.random() - 0.5) * 0.5
        p.position.y += Math.random() * 0.2

        p.material.color.copy(pColor)
        p.material.opacity = 0.8 + Math.random() * 0.2
        
        // Vận tốc ngẫu nhiên văng ra ngoài và hướng lên trên
        p.userData.velocity.set(
          (Math.random() - 0.5) * 1.5,
          Math.random() * 1.5 + 0.5,
          (Math.random() - 0.5) * 1.5
        )
        
        p.userData.maxLife = 0.3 + Math.random() * 0.25
        p.userData.life = p.userData.maxLife
        
        // Xoay ngẫu nhiên
        p.rotation.set(
          Math.random() * Math.PI,
          Math.random() * Math.PI,
          Math.random() * Math.PI
        )

        p.visible = true
        activeParticles.add(p)
        spawned++
      }
    }
  },

  update(delta) {
    const gravity = -5.0 // gia tốc trọng trường rơi xuống
    
    for (const p of activeParticles) {
      p.userData.life -= delta
      if (p.userData.life <= 0) {
        p.visible = false
        activeParticles.delete(p)
        continue
      }
      
      // Update vận tốc và vị trí
      p.userData.velocity.y += gravity * delta
      p.position.addScaledVector(p.userData.velocity, delta)
      
      // Làm mờ dần
      const ratio = p.userData.life / p.userData.maxLife
      p.material.opacity = ratio
      
      // Xoay nhẹ nhàng
      p.rotation.x += delta * 3
      p.rotation.y += delta * 3
    }
  }
}

export { ParticleSystem }
