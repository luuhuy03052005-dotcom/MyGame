import * as THREE from 'three'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js'
import { FXAAShader } from 'three/addons/shaders/FXAAShader.js'
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js'

let composer = null
let renderPass = null
let bloomPass = null
let fxaaPass = null
let outputPass = null
let isEnabled = true

const PostProcessing = {
  init(renderer, scene, camera) {
    const width = renderer.domElement.clientWidth
    const height = renderer.domElement.clientHeight

    // 1. EffectComposer với standard render target
    const renderTarget = new THREE.WebGLRenderTarget(width, height, {
      type: THREE.HalfFloatType,
      samples: 0,
    })

    composer = new EffectComposer(renderer, renderTarget)

    // 2. Pass 1: RenderPass — vẽ scene gốc
    renderPass = new RenderPass(scene, camera)
    composer.addPass(renderPass)

    // 3. Pass 2: Bloom nhẹ
    bloomPass = new UnrealBloomPass(
      new THREE.Vector2(width, height),
      0.15,   // bloom strength nhẹ
      0.5,    // bloom radius
      0.90    // bloom threshold — chỉ highlight sáng mới bloom
    )
    composer.addPass(bloomPass)

    // 4. Pass 3: FXAA chống răng cưa
    fxaaPass = new ShaderPass(FXAAShader)
    const pixelRatio = renderer.getPixelRatio()
    fxaaPass.material.uniforms['resolution'].value.x = 1 / (width * pixelRatio)
    fxaaPass.material.uniforms['resolution'].value.y = 1 / (height * pixelRatio)
    composer.addPass(fxaaPass)

    // 5. Pass 4: OutputPass — xuất sRGB
    outputPass = new OutputPass()
    composer.addPass(outputPass)

    console.log('[PostProcessing] Simple Pipeline (Bloom + FXAA) Initialized')
  },

  resize(width, height) {
    if (!composer) return
    composer.setSize(width, height)
    if (bloomPass) bloomPass.setSize(width, height)
    if (fxaaPass) {
      const pixelRatio = composer.renderer.getPixelRatio()
      fxaaPass.material.uniforms['resolution'].value.x = 1 / (width * pixelRatio)
      fxaaPass.material.uniforms['resolution'].value.y = 1 / (height * pixelRatio)
    }
  },

  render() {
    if (composer) composer.render()
  },

  setEnabled(enabled) {
    isEnabled = enabled
  },

  isEnabled: () => isEnabled,
}

export { PostProcessing }
