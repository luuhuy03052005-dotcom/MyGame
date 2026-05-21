/**
 * Toolbar.js — Light Glassmorphism + Lucide Icons
 *
 * Design system theo user spec:
 * - Background: rgba(255, 255, 255, 0.65) — light glass, không dùng đen
 * - Backdrop blur: 16px
 * - Icon color: #4A5568 (slate gray dịu mắt)
 * - stroke-width: 1.75 (mảnh, thanh lịch)
 * - Hover: scale(1.05) translateY(-1px)
 * - Active: scale(0.95)
 * - Đổ bóng kiểu "sương mù" nhẹ
 *
 * Events emitted:
 *   'toolbar:save', 'toolbar:load', 'toolbar:undo', 'toolbar:redo',
 *   'toolbar:resetcamera', 'toolbar:newworld', 'toolbar:togglegrid',
 *   'toolbar:togglepalette'
 *
 * Public API:
 *   Toolbar.init(container)
 *   Toolbar.setUndoEnabled(bool)
 *   Toolbar.setRedoEnabled(bool)
 *   Toolbar.showToast(message, type)
 */

import {
  createIcons,
  Undo2, Redo2,
  Save, FolderOpen,
  Map,
  Camera,
  Grid3x3,
  Palette,
  Trash2,
  ImageDown,
} from 'lucide'

let container    = null
let undoBtn      = null
let redoBtn      = null
let toastTimeout = null

const Toolbar = {
  init(containerEl) {
    container = containerEl
    _buildDOM()
    _activateLucide()
    console.log('[Toolbar] Initialized — Light Glassmorphism + Lucide')
  },

  setUndoEnabled(enabled) {
    if (!undoBtn) return
    undoBtn.disabled = !enabled
    undoBtn.style.opacity = enabled ? '1' : '0.35'
    undoBtn.style.cursor  = enabled ? 'pointer' : 'not-allowed'
  },

  setRedoEnabled(enabled) {
    if (!redoBtn) return
    redoBtn.disabled = !enabled
    redoBtn.style.opacity = enabled ? '1' : '0.35'
    redoBtn.style.cursor  = enabled ? 'pointer' : 'not-allowed'
  },

  /**
   * Toast notification — ánh sáng, phù hợp với light theme
   * @param {string} message
   * @param {'info'|'success'|'error'} type
   */
  showToast(message, type = 'info') {
    let toast = document.getElementById('toolbar-toast')
    if (!toast) {
      toast = document.createElement('div')
      toast.id = 'toolbar-toast'
      document.body.appendChild(toast)
    }

    const configs = {
      info:    { bg: 'rgba(255,255,255,0.88)', color: '#2D3748', border: 'rgba(0,0,0,0.08)' },
      success: { bg: 'rgba(240,253,244,0.95)', color: '#166534', border: 'rgba(22,163,74,0.2)' },
      error:   { bg: 'rgba(255,241,242,0.95)', color: '#9F1239', border: 'rgba(244,63,94,0.2)' },
    }
    const cfg = configs[type] ?? configs.info

    toast.textContent = message
    Object.assign(toast.style, {
      position:       'fixed',
      top:            '76px',
      left:           '50%',
      transform:      'translateX(-50%)',
      padding:        '9px 22px',
      background:     cfg.bg,
      color:          cfg.color,
      border:         `1px solid ${cfg.border}`,
      borderRadius:   '24px',
      fontSize:       '13px',
      fontFamily:     'system-ui, -apple-system, sans-serif',
      fontWeight:     '500',
      letterSpacing:  '0.02em',
      backdropFilter: 'blur(16px)',
      WebkitBackdropFilter: 'blur(16px)',
      zIndex:         '200',
      pointerEvents:  'none',
      opacity:        '1',
      transition:     'opacity 0.35s ease',
      boxShadow:      '0 4px 24px rgba(0,0,0,0.08)',
      whiteSpace:     'nowrap',
    })

    clearTimeout(toastTimeout)
    toastTimeout = setTimeout(() => { toast.style.opacity = '0' }, 2500)
  },
}

// ===== DOM Builder =====

function _buildDOM() {
  // Inject CSS vào <head> — 1 lần duy nhất
  if (!document.getElementById('toolbar-style')) {
    const style = document.createElement('style')
    style.id = 'toolbar-style'
    style.textContent = `
      /* ── Toolbar ── */
      #toolbar {
        position: fixed;
        top: 20px;
        left: 50%;
        transform: translateX(-50%);
        background: rgba(255, 255, 255, 0.72);
        backdrop-filter: blur(20px);
        -webkit-backdrop-filter: blur(20px);
        border: 1px solid rgba(255, 255, 255, 0.55);
        border-radius: 20px;
        padding: 7px 16px;
        box-shadow:
          0 10px 40px rgba(0,0,0,0.06),
          0 1px 8px rgba(0,0,0,0.04),
          inset 0 1px 0 rgba(255,255,255,0.9);
        display: flex;
        align-items: center;
        gap: 6px;
        user-select: none;
        z-index: 100;
        font-family: system-ui, -apple-system, sans-serif;
      }

      /* Brand */
      #toolbar .tb-brand {
        font-size: 12px;
        font-weight: 700;
        letter-spacing: 1.8px;
        color: #2D3748;
        text-transform: uppercase;
        padding-right: 14px;
        margin-right: 4px;
        border-right: 1px solid rgba(0,0,0,0.08);
        height: 20px;
        display: flex;
        align-items: center;
      }

      /* Nút bấm */
      #toolbar .tb-btn {
        background: transparent;
        border: none;
        outline: none;
        cursor: pointer;
        width: 36px;
        height: 36px;
        border-radius: 10px;
        display: flex;
        align-items: center;
        justify-content: center;
        color: #4A5568;
        transition: all 0.18s cubic-bezier(0.4, 0, 0.2, 1);
        padding: 0;
        flex-shrink: 0;
      }

      #toolbar .tb-btn:hover:not(:disabled) {
        background: rgba(0,0,0,0.055);
        color: #1A202C;
        transform: scale(1.06) translateY(-1px);
      }

      #toolbar .tb-btn:active:not(:disabled) {
        transform: scale(0.94);
        background: rgba(0,0,0,0.09);
      }

      #toolbar .tb-btn:disabled {
        pointer-events: none;
      }

      /* Lucide SVG */
      #toolbar .tb-btn svg {
        display: block;
        pointer-events: none;
      }

      /* Divider */
      #toolbar .tb-divider {
        width: 1px;
        height: 18px;
        background: rgba(0,0,0,0.08);
        margin: 0 3px;
        flex-shrink: 0;
      }

      /* ── Controls hint ── */
      #controls-hint {
        position: fixed;
        bottom: 88px;
        right: 20px;
        font-size: 11px;
        line-height: 1.75;
        color: rgba(45,55,72,0.45);
        font-family: system-ui, -apple-system, sans-serif;
        text-align: right;
        pointer-events: none;
        user-select: none;
        background: rgba(255,255,255,0.55);
        backdrop-filter: blur(10px);
        -webkit-backdrop-filter: blur(10px);
        border: 1px solid rgba(255,255,255,0.5);
        border-radius: 12px;
        padding: 10px 14px;
        box-shadow: 0 4px 16px rgba(0,0,0,0.05);
      }

      #controls-hint strong {
        color: rgba(45,55,72,0.65);
        font-weight: 600;
        display: block;
        font-size: 10px;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        margin-bottom: 4px;
      }
    `
    document.head.appendChild(style)
  }

  // Toolbar element
  const toolbar = document.createElement('div')
  toolbar.id = 'toolbar'

  // Brand title
  const brand = document.createElement('span')
  brand.className = 'tb-brand'
  brand.textContent = 'Coastlet'
  toolbar.appendChild(brand)

  // Button definitions
  const buttons = [
    { id: 'tb-undo',       icon: 'undo-2',      title: 'Undo (Ctrl+Z)',        event: 'toolbar:undo',        ref: 'undo' },
    { id: 'tb-redo',       icon: 'redo-2',      title: 'Redo (Ctrl+Y)',        event: 'toolbar:redo',        ref: 'redo' },
    { sep: true },
    { id: 'tb-grid',       icon: 'grid-3x3',    title: 'Toggle Grid',          event: 'toolbar:togglegrid' },
    { id: 'tb-palette',   icon: 'palette',     title: 'Toggle Palette (C)',   event: 'toolbar:togglepalette' },
    { sep: true },
    { id: 'tb-new',        icon: 'map',         title: 'New World',            event: 'toolbar:newworld' },
    { id: 'tb-load',       icon: 'folder-open', title: 'Open  (Ctrl+O)',       event: 'toolbar:load' },
    { id: 'tb-save',       icon: 'save',        title: 'Save  (Ctrl+S)',       event: 'toolbar:save' },
    { sep: true },
    { id: 'tb-screenshot', icon: 'image-down',  title: 'Screenshot (F12)',     event: 'toolbar:screenshot' },
    { id: 'tb-camera',     icon: 'camera',      title: 'Reset Camera (F)',     event: 'toolbar:resetcamera' },
  ]

  buttons.forEach(({ id, icon, title, event, sep, ref }) => {
    if (sep) {
      const div = document.createElement('div')
      div.className = 'tb-divider'
      toolbar.appendChild(div)
      return
    }

    const btn = document.createElement('button')
    btn.id = id
    btn.className = 'tb-btn'
    btn.title = title

    // Placeholder cho Lucide — sẽ được replace bởi createIcons()
    const iconEl = document.createElement('i')
    iconEl.setAttribute('data-lucide', icon)
    btn.appendChild(iconEl)

    btn.addEventListener('click', () => window.dispatchEvent(new CustomEvent(event)))

    if (ref === 'undo') undoBtn = btn
    if (ref === 'redo') redoBtn = btn

    toolbar.appendChild(btn)
  })

  container.appendChild(toolbar)

  // Controls hint panel
  const hint = document.createElement('div')
  hint.id = 'controls-hint'
  hint.innerHTML = `
    <strong>Controls</strong>
    Left click &nbsp;— Build<br>
    Right click — Delete<br>
    Right drag &nbsp;— Orbit<br>
    Scroll &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;— Zoom<br>
    F &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;— Reset camera<br>
    Q &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;— Materials<br>
    C &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;— Palette<br>
    Ctrl+Z/Y &nbsp;— Undo/Redo
  `
  container.appendChild(hint)

  // Initial state
  Toolbar.setUndoEnabled(false)
  Toolbar.setRedoEnabled(false)
}

/**
 * Kích hoạt Lucide icons sau khi DOM đã build.
 * Cần gọi sau khi toolbar được append vào document.
 */
function _activateLucide() {
  createIcons({
    icons: { Undo2, Redo2, Save, FolderOpen, Map, Camera, Grid3x3, Palette, Trash2, ImageDown },
    attrs: {
      'stroke-width': 1.75,
      'width': 19,
      'height': 19,
    },
  })
}

export { Toolbar }
