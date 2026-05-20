import * as THREE from 'three'

const VERTEX_SHADER = /* glsl */ `
  uniform float time;
  varying vec3 vWorldNormal;
  varying vec3 vWorldPosition;
  varying float vElevation;

  void main() {
    vec3 pos = position;

    // Sóng biển phức hợp 3 tầng (sin/cos kết hợp)
    float elevation = sin(pos.x * 0.3 + time * 1.0) * 0.08
                    + cos(pos.y * 0.4 - time * 0.8) * 0.06
                    + sin((pos.x + pos.y) * 0.25 + time * 1.4) * 0.04;
    pos.z += elevation; // Plane rotation.x = -Math.PI / 2 nên pos.z là trục Y thế giới
    vElevation = elevation;

    vec4 worldPos = modelMatrix * vec4(pos, 1.0);
    vWorldPosition = worldPos.xyz;

    // Tính toán normal động dựa trên đạo hàm của hàm sóng
    float dx = 0.3 * 0.08 * cos(pos.x * 0.3 + time * 1.0) + 0.25 * 0.04 * cos((pos.x + pos.y) * 0.25 + time * 1.4);
    float dy = -0.4 * 0.06 * sin(pos.y * 0.4 - time * 0.8) + 0.25 * 0.04 * cos((pos.x + pos.y) * 0.25 + time * 1.4);
    vec3 waveNormal = normalize(vec3(-dx, -dy, 1.0));

    vWorldNormal = normalize(mat3(modelMatrix) * waveNormal);

    gl_Position = projectionMatrix * viewMatrix * worldPos;
  }
`

const FRAGMENT_SHADER = /* glsl */ `
  uniform vec3 cameraPosition;
  varying vec3 vWorldNormal;
  varying vec3 vWorldPosition;
  varying float vElevation;

  void main() {
    // Gradient màu ngọc bích từ nông dạt ra khơi xa
    vec3 shallowColor = vec3(0.47, 0.78, 0.82); // #78C7D1
    vec3 deepColor = vec3(0.18, 0.42, 0.62);    // #2E6B9E

    // Trộn màu nông sâu theo độ cao sóng
    float mixFactor = clamp((vElevation + 0.18) / 0.36, 0.0, 1.0);
    vec3 baseColor = mix(deepColor, shallowColor, mixFactor);

    // Fresnel phản chiếu bầu trời
    vec3 viewDir = normalize(cameraPosition - vWorldPosition);
    float NdotV = max(dot(vWorldNormal, viewDir), 0.0);
    float fresnel = pow(1.0 - NdotV, 3.0);
    vec3 skyColor = vec3(0.85, 0.95, 1.0);
    vec3 color = mix(baseColor, skyColor, fresnel * 0.35);

    // Ánh mặt trời lấp lánh (Specular highlight)
    vec3 lightDir = normalize(vec3(5.0, 10.0, 3.0));
    vec3 halfVec = normalize(viewDir + lightDir);
    float NdotH = max(dot(vWorldNormal, halfVec), 0.0);
    float specular = pow(NdotH, 128.0) * 0.8;

    // Thêm bọt sóng (foam) trắng ở đỉnh sóng nhô cao
    float foamFactor = smoothstep(0.06, 0.16, vElevation);
    vec3 foamColor = vec3(0.95, 0.98, 1.0);
    color = mix(color, foamColor, foamFactor * 0.55);

    // Trộn specular nắng chói chang
    color += vec3(1.0, 0.98, 0.9) * specular;

    gl_FragColor = vec4(color, 0.88);
  }
`

let mesh = null
let material = null
let elapsedTime = 0

const WaterPlane = {
  /**
   * @param {THREE.Scene} scene
   * @returns {THREE.Mesh} waterPlane mesh
   */
  init(scene) {
    // PlaneGeometry(80, 80, 64, 64) — Mở rộng quy mô mặt nước và tăng lưới phân đoạn để sóng mềm mịn
    const geometry = new THREE.PlaneGeometry(80, 80, 64, 64)

    material = new THREE.ShaderMaterial({
      vertexShader: VERTEX_SHADER,
      fragmentShader: FRAGMENT_SHADER,
      uniforms: {
        time: { value: 0 },
        cameraPosition: { value: new THREE.Vector3() },
      },
      transparent: true,
      side: THREE.DoubleSide,
    })

    mesh = new THREE.Mesh(geometry, material)
    mesh.name = 'waterPlane'
    mesh.rotation.x = -Math.PI / 2
    mesh.position.y = -0.01 // hơi thấp hơn 0 để không bị z-fight
    mesh.receiveShadow = true
    mesh.userData.buildable = true

    scene.add(mesh)
    console.log('[WaterPlane] High Fidelity Shader Initialized')
    return mesh
  },

  /** Gọi từ RenderLoop mỗi frame */
  updateTime(delta, camera) {
    elapsedTime += delta
    if (material) {
      material.uniforms.time.value = elapsedTime
      if (camera) {
        material.uniforms.cameraPosition.value.copy(camera.position)
      }
    }
  },

  getMesh: () => mesh,
}

export { WaterPlane }
