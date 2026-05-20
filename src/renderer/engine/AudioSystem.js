/**
 * AudioSystem.js — Web Audio API Sound Synthesizer
 *
 * Tổng hợp âm thanh trực tiếp (Audio Synthesis) bằng code để đạt được
 * trải nghiệm "chữa lành" tối giản, thuần khiết và không cần load file tĩnh
 * (tránh rủi ro mất asset hoặc CSP blocks trong bundled Electron).
 *
 * Public API:
 *   AudioSystem.init(settings)
 *   AudioSystem.playBuild()
 *   AudioSystem.playDelete()
 *   AudioSystem.setSoundEnabled(enabled)
 *   AudioSystem.setMasterVolume(volume)
 */

let audioCtx = null
let masterGainNode = null
let soundEnabled = true
let masterVolume = 0.6

const AudioSystem = {
  /**
   * Khởi tạo AudioContext khi có tương tác người dùng đầu tiên.
   * @param {object} settings
   */
  init(settings = {}) {
    if (settings.sound !== undefined) soundEnabled = settings.sound
    if (settings.masterVolume !== undefined) masterVolume = settings.masterVolume

    console.log('[AudioSystem] Initialized. Sound enabled:', soundEnabled, 'Volume:', masterVolume)
  },

  /**
   * Khởi tạo context lười (lazy initialization) khi người dùng thao tác.
   * Lý do: các trình duyệt hiện đại chặn phát âm thanh tự động trước khi click.
   */
  _ensureContext() {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)()
      masterGainNode = audioCtx.createGain()
      masterGainNode.gain.setValueAtTime(masterVolume, audioCtx.currentTime)
      masterGainNode.connect(audioCtx.destination)
    }
    // Resume context nếu đang bị suspended (chrome auto-suspends)
    if (audioCtx.state === 'suspended') {
      audioCtx.resume()
    }
  },

  /**
   * Phát âm thanh tiếng "Plop" trong trẻo khi xây nhà
   * Sóng sine quét tần số nhanh từ 180Hz → 620Hz trong 120ms.
   */
  playBuild() {
    if (!soundEnabled) return
    try {
      this._ensureContext()

      const now = audioCtx.currentTime
      const osc = audioCtx.createOscillator()
      const gainNode = audioCtx.createGain()

      // Dùng sóng sine thuần khiết
      osc.type = 'sine'

      // Quét tần số (Frequency Sweep) tạo tiếng Plop giòn giã
      osc.frequency.setValueAtTime(180, now)
      osc.frequency.exponentialRampToValueAtTime(620, now + 0.12)

      // Envelope âm lượng mượt mà (Attack cực ngắn, Decay/Release)
      gainNode.gain.setValueAtTime(0.001, now)
      gainNode.gain.linearRampToValueAtTime(0.4, now + 0.01) // Attack 10ms
      gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.12) // Decay 110ms

      // Kết nối và chạy
      osc.connect(gainNode)
      gainNode.connect(masterGainNode)

      osc.start(now)
      osc.stop(now + 0.13)
    } catch (e) {
      console.warn('[AudioSystem] Build sound sweep failed:', e)
    }
  },

  /**
   * Phát âm thanh tiếng "Poof/Bụp" trầm ấm khi xóa nhà
   * Sóng triangle quét từ 220Hz xuống 60Hz trong 140ms.
   */
  playDelete() {
    if (!soundEnabled) return
    try {
      this._ensureContext()

      const now = audioCtx.currentTime
      const osc = audioCtx.createOscillator()
      const gainNode = audioCtx.createGain()

      // Dùng triangle wave trầm ấm hơn
      osc.type = 'triangle'

      // Tần số quét từ cao xuống thấp
      osc.frequency.setValueAtTime(220, now)
      osc.frequency.exponentialRampToValueAtTime(60, now + 0.14)

      // Envelope âm lượng
      gainNode.gain.setValueAtTime(0.001, now)
      gainNode.gain.linearRampToValueAtTime(0.5, now + 0.015) // Attack 15ms
      gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.14) // Decay 125ms

      osc.connect(gainNode)
      gainNode.connect(masterGainNode)

      osc.start(now)
      osc.stop(now + 0.15)
    } catch (e) {
      console.warn('[AudioSystem] Delete sound sweep failed:', e)
    }
  },

  /** Bật/tắt âm lượng */
  setSoundEnabled(enabled) {
    soundEnabled = enabled
  },

  isSoundEnabled: () => soundEnabled,

  /** Điều chỉnh âm lượng master */
  setMasterVolume(volume) {
    masterVolume = Math.max(0, Math.min(1, volume))
    if (masterGainNode && audioCtx) {
      masterGainNode.gain.setValueAtTime(masterVolume, audioCtx.currentTime)
    }
  },
}

export { AudioSystem }
