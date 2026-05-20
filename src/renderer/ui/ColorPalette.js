/**
 * ColorPalette.js — Light Glassmorphism, đồng bộ với Toolbar
 *
 * Design:
 * - Cùng glass style: rgba(255,255,255,0.72), blur(20px)
 * - Swatch 30px, rounded pill
 * - Active: border trắng + scale(1.2) + shadow
 * - Phím C toggle, phím 1-9 quick select
 *
 * Events emitted:
 *   'palette:colorchange' → detail: { color: "#RRGGBB" }
 *
 * Public API:
 *   ColorPalette.init(container)
 *   ColorPalette.getActiveColor() → string
 *   ColorPalette.setActiveColor(hex)
 *   ColorPalette.toggle()
 *   ColorPalette.show() / hide()
 */

import { DEFAULT_PALETTE } from '../assets/AssetRegistry.js'

let container  = null
let panelEl    = null
let activeColor = DEFAULT_PALETTE[0]
let isVisible  = true

const ColorPalette = {
  init(containerEl) {
    container = containerEl
    _buildDOM()
    _setupKeyboard()
    console.log('[ColorPalette] Initialized — Light Glassmorphism')
  },

  getActiveColor: () => activeColor,

  setActiveColor(hex) {
    activeColor = hex
    _updateSelection()
    window.dispatchEvent(new CustomEvent('palette:colorchange', { detail: { color: hex } }))
  },

  toggle() {
    isVisible = !isVisible
    if (panelEl) {
      panelEl.style.opacity   = isVisible ? '1' : '0'
      panelEl.style.transform = isVisible
        ? 'translateX(-50%) translateY(0)'
        : 'translateX(-50%) translateY(12px)'
      panelEl.style.pointerEvents = isVisible ? 'auto' : 'none'
    }
  },

  show() {
    isVisible = true
    if (panelEl) {
      panelEl.style.opacity   = '1'
      panelEl.style.transform = 'translateX(-50%) translateY(0)'
      panelEl.style.pointerEvents = 'auto'
    }
  },

  hide() {
    isVisible = false
    if (panelEl) {
      panelEl.style.opacity   = '0'
      panelEl.style.transform = 'translateX(-50%) translateY(12px)'
      panelEl.style.pointerEvents = 'none'
    }
  },
}

function _buildDOM() {
  // Inject CSS
  if (!document.getElementById('palette-style')) {
    const style = document.createElement('style')
    style.id = 'palette-style'
    style.textContent = `
      #color-palette {
        position: fixed;
        bottom: 24px;
        left: 50%;
        transform: translateX(-50%) translateY(0);
        display: flex;
        align-items: center;
        gap: 7px;
        padding: 10px 18px;
        background: rgba(255, 255, 255, 0.72);
        backdrop-filter: blur(20px);
        -webkit-backdrop-filter: blur(20px);
        border: 1px solid rgba(255, 255, 255, 0.55);
        border-radius: 20px;
        box-shadow:
          0 10px 40px rgba(0,0,0,0.06),
          0 1px 8px rgba(0,0,0,0.04),
          inset 0 1px 0 rgba(255,255,255,0.9);
        z-index: 100;
        transition: opacity 0.25s ease, transform 0.25s cubic-bezier(0.4, 0, 0.2, 1);
        user-select: none;
      }

      #color-palette .pal-label {
        font-size: 10px;
        font-weight: 700;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        color: rgba(45,55,72,0.4);
        font-family: system-ui, -apple-system, sans-serif;
        padding-right: 10px;
        border-right: 1px solid rgba(0,0,0,0.08);
        margin-right: 2px;
        white-space: nowrap;
      }

      #color-palette .pal-swatch {
        width: 28px;
        height: 28px;
        border-radius: 50%;
        border: 2.5px solid transparent;
        cursor: pointer;
        outline: none;
        flex-shrink: 0;
        transition: transform 0.15s cubic-bezier(0.4, 0, 0.2, 1),
                    box-shadow 0.15s ease,
                    border-color 0.15s ease;
        /* Shadow nhẹ theo màu swatch */
        box-shadow: 0 2px 8px rgba(0,0,0,0.12);
      }

      #color-palette .pal-swatch:hover {
        transform: scale(1.18) translateY(-2px);
        box-shadow: 0 4px 16px rgba(0,0,0,0.18);
      }

      #color-palette .pal-swatch.active {
        border-color: rgba(255,255,255,0.9);
        transform: scale(1.22) translateY(-2px);
        box-shadow:
          0 0 0 2px rgba(45,55,72,0.25),
          0 6px 20px rgba(0,0,0,0.2);
      }

      /* Phím tắt badge nhỏ bên dưới swatch 1-9 */
      #color-palette .pal-swatch-wrap {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 4px;
      }

      #color-palette .pal-key {
        font-size: 9px;
        color: rgba(45,55,72,0.3);
        font-family: system-ui, -apple-system, sans-serif;
        font-weight: 600;
        line-height: 1;
        height: 10px;
        transition: color 0.15s;
      }

      #color-palette .pal-swatch-wrap:hover .pal-key {
        color: rgba(45,55,72,0.55);
      }
    `
    document.head.appendChild(style)
  }

  panelEl = document.createElement('div')
  panelEl.id = 'color-palette'

  // Label
  const label = document.createElement('span')
  label.className = 'pal-label'
  label.textContent = 'Color'
  panelEl.appendChild(label)

  // Swatches
  DEFAULT_PALETTE.forEach((hex, i) => {
    const wrap = document.createElement('div')
    wrap.className = 'pal-swatch-wrap'

    const swatch = document.createElement('button')
    swatch.id        = `swatch-${i}`
    swatch.className = 'pal-swatch'
    swatch.title     = hex
    swatch.dataset.color = hex
    swatch.style.background = hex
    swatch.setAttribute('aria-label', `Color ${hex}`)

    swatch.addEventListener('click', () => ColorPalette.setActiveColor(hex))

    // Key badge (1-9 cho 9 màu đầu)
    const keyBadge = document.createElement('span')
    keyBadge.className = 'pal-key'
    keyBadge.textContent = i < 9 ? String(i + 1) : ''

    wrap.appendChild(swatch)
    wrap.appendChild(keyBadge)
    panelEl.appendChild(wrap)
  })

  container.appendChild(panelEl)
  _updateSelection()
}

function _updateSelection() {
  if (!panelEl) return
  panelEl.querySelectorAll('.pal-swatch').forEach(swatch => {
    if (swatch.dataset.color === activeColor) {
      swatch.classList.add('active')
    } else {
      swatch.classList.remove('active')
    }
  })
}

function _setupKeyboard() {
  window.addEventListener('ui:keydown', (e) => {
    const { key } = e.detail

    // Phím C: toggle palette
    if (key === 'c' || key === 'C') {
      ColorPalette.toggle()
    }

    // Phím 1-9: chọn màu nhanh
    const num = parseInt(key, 10)
    if (!isNaN(num) && num >= 1 && num <= 9 && num <= DEFAULT_PALETTE.length) {
      ColorPalette.setActiveColor(DEFAULT_PALETTE[num - 1])
    }
  })

  // Toolbar toggle palette button
  window.addEventListener('toolbar:togglepalette', () => ColorPalette.toggle())
}

export { ColorPalette }
