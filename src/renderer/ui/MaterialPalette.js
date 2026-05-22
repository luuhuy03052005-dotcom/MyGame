/**
 * MaterialPalette.js — Minecraft-like material hotbar.
 *
 * Events emitted:
 *   'palette:materialchange' -> detail: { material }
 */

import {
  ASSET_DEFINITIONS,
  BUILD_CATEGORIES,
  BUILD_MATERIALS,
  DEFAULT_MATERIAL,
} from '../assets/AssetRegistry.js'

let container = null
let panelEl = null
let activeMaterial = DEFAULT_MATERIAL
let activeCategory = 'auto'
let activeAssetId = 'auto'
let autoMode = true
let isVisible = false
let activeTextureVariation = 'variation-a.png'

const TEXTURE_VARIATIONS = [
  { id: 'colormap.png', label: 'Base' },
  { id: 'variation-a.png', label: 'A' },
  { id: 'variation-b.png', label: 'B' },
  { id: 'variation-c.png', label: 'C' },
]

const MaterialPalette = {
  init(containerEl) {
    container = containerEl
    _buildDOM()
    _setupKeyboard()
    console.log('[MaterialPalette] Initialized')
  },

  getActiveMaterial: () => activeMaterial,
  getActiveCategory: () => activeCategory,
  getActiveAssetId: () => activeAssetId,
  getActiveTextureVariation: () => activeTextureVariation,
  isAutoMode: () => autoMode,

  setActiveMaterial(materialId) {
    const exists = BUILD_MATERIALS.some(material => material.id === materialId)
    activeMaterial = exists ? materialId : DEFAULT_MATERIAL
    _syncActiveAsset()
    _updateSelection()
    window.dispatchEvent(new CustomEvent('palette:materialchange', {
      detail: { material: activeMaterial },
    }))
    window.dispatchEvent(new CustomEvent('palette:buildselectionchange', {
      detail: { material: activeMaterial, category: activeCategory, assetId: activeAssetId, autoMode },
    }))
  },

  setActiveCategory(categoryId) {
    const exists = BUILD_CATEGORIES.some(category => category.id === categoryId)
    activeCategory = exists ? categoryId : 'auto'
    autoMode = activeCategory === 'auto'
      || BUILD_CATEGORIES.find(category => category.id === activeCategory)?.placementMode === 'auto'
    _syncActiveAsset()
    _updateSelection()
    window.dispatchEvent(new CustomEvent('palette:buildselectionchange', {
      detail: { material: activeMaterial, category: activeCategory, assetId: activeAssetId, autoMode },
    }))
  },

  setActiveAsset(assetId) {
    const exists = _visibleAssets().some(asset => asset.id === assetId)
    activeAssetId = exists ? assetId : 'auto'
    _updateSelection()
    window.dispatchEvent(new CustomEvent('palette:buildselectionchange', {
      detail: { material: activeMaterial, category: activeCategory, assetId: activeAssetId, autoMode },
    }))
  },

  setTextureVariation(textureName) {
    const exists = TEXTURE_VARIATIONS.some(variation => variation.id === textureName)
    activeTextureVariation = exists ? textureName : 'variation-a.png'
    _updateSelection()
    window.dispatchEvent(new CustomEvent('kit:texturechange', {
      detail: { textureName: activeTextureVariation },
    }))
  },

  toggle() {
    isVisible = !isVisible
    if (!panelEl) return
    panelEl.classList.toggle('is-hidden', !isVisible)
    panelEl.style.opacity = isVisible ? '1' : '0'
    panelEl.style.transform = isVisible
      ? 'translateX(-50%) translateY(0)'
      : 'translateX(-50%) translateY(18px)'
    panelEl.style.pointerEvents = isVisible ? 'auto' : 'none'
  },
}

function _buildDOM() {
  if (!document.getElementById('material-palette-style')) {
    const style = document.createElement('style')
    style.id = 'material-palette-style'
    style.textContent = `
      #material-palette {
        position: fixed;
        bottom: 90px;
        left: 50%;
        transform: translateX(-50%) translateY(0);
        width: min(820px, calc(100vw - 56px));
        display: flex;
        flex-direction: column;
        align-items: stretch;
        gap: 8px;
        padding: 10px 14px;
        background: rgba(255, 255, 255, 0.72);
        backdrop-filter: blur(20px);
        -webkit-backdrop-filter: blur(20px);
        border: 1px solid rgba(255, 255, 255, 0.55);
        border-radius: 14px;
        box-shadow:
          0 10px 40px rgba(0,0,0,0.06),
          inset 0 1px 0 rgba(255,255,255,0.9);
        z-index: 101;
        transition: opacity 0.25s ease, transform 0.25s cubic-bezier(0.4, 0, 0.2, 1);
        user-select: none;
      }

      #material-palette.is-hidden {
        opacity: 0;
        transform: translateX(-50%) translateY(18px);
        pointer-events: none;
      }

      #material-palette .mat-row {
        display: flex;
        align-items: center;
        gap: 8px;
        max-width: 100%;
        overflow-x: auto;
        scrollbar-width: thin;
        padding-bottom: 2px;
      }

      #material-palette .mat-label {
        font-size: 10px;
        font-weight: 700;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        color: rgba(45,55,72,0.42);
        padding-right: 10px;
        border-right: 1px solid rgba(0,0,0,0.08);
        white-space: nowrap;
      }

      #material-palette .mat-slot {
        width: 62px;
        height: 44px;
        flex: 0 0 62px;
        border-radius: 8px;
        border: 2px solid rgba(255,255,255,0.35);
        background:
          linear-gradient(135deg, rgba(255,255,255,0.52), rgba(255,255,255,0.22)),
          var(--mat-swatch);
        box-shadow: inset 0 -10px 0 rgba(0,0,0,0.08), 0 2px 8px rgba(0,0,0,0.12);
        cursor: pointer;
        display: flex;
        flex-direction: column;
        justify-content: flex-end;
        align-items: center;
        padding: 5px 4px;
        transition: transform 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease;
      }

      #material-palette .cat-slot {
        height: 24px;
        min-width: 52px;
        padding: 0 8px;
        border: 1px solid rgba(255,255,255,0.45);
        border-radius: 7px;
        background: rgba(255,255,255,0.32);
        color: rgba(32,38,46,0.62);
        font-size: 9px;
        font-weight: 700;
        cursor: pointer;
      }

      #material-palette .var-slot {
        height: 24px;
        min-width: 54px;
        padding: 0 9px;
        border: 1px solid rgba(255,255,255,0.45);
        border-radius: 7px;
        background: rgba(255,255,255,0.28);
        color: rgba(32,38,46,0.62);
        font-size: 9px;
        font-weight: 800;
        cursor: pointer;
      }

      #material-palette .var-slot.active {
        color: rgba(32,38,46,0.84);
        background: rgba(255,255,255,0.76);
        box-shadow: 0 0 0 2px rgba(45,55,72,0.18);
      }

      #material-palette .kit-row {
        width: 100%;
        display: grid;
        grid-template-columns: auto 1fr;
        align-items: center;
        gap: 8px;
      }

      #material-palette .kit-items {
        display: flex;
        gap: 6px;
        overflow-x: auto;
        scrollbar-width: thin;
        padding: 1px 2px 4px;
      }

      #material-palette .kit-slot {
        width: 44px;
        height: 44px;
        flex: 0 0 44px;
        border: 1px solid rgba(255,255,255,0.55);
        border-radius: 7px;
        background: rgba(255,255,255,0.34);
        box-shadow: inset 0 -8px 0 rgba(0,0,0,0.05);
        cursor: pointer;
        padding: 2px;
        display: grid;
        place-items: center;
      }

      #material-palette .kit-slot img {
        max-width: 38px;
        max-height: 38px;
        object-fit: contain;
        pointer-events: none;
      }

      #material-palette .kit-slot.active {
        background: rgba(255,255,255,0.78);
        box-shadow: 0 0 0 2px rgba(45,55,72,0.24), inset 0 -8px 0 rgba(0,0,0,0.04);
      }

      #material-palette .cat-slot.active {
        color: rgba(32,38,46,0.84);
        background: rgba(255,255,255,0.72);
        box-shadow: 0 0 0 2px rgba(45,55,72,0.18);
      }

      #material-palette .mat-slot:hover {
        transform: translateY(-2px);
        box-shadow: inset 0 -10px 0 rgba(0,0,0,0.08), 0 6px 16px rgba(0,0,0,0.16);
      }

      #material-palette .mat-slot.active {
        border-color: rgba(255,255,255,0.95);
        transform: translateY(-2px);
        box-shadow:
          0 0 0 2px rgba(45,55,72,0.28),
          inset 0 -10px 0 rgba(0,0,0,0.08),
          0 8px 22px rgba(0,0,0,0.2);
      }

      #material-palette .mat-name {
        max-width: 50px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        font-size: 9px;
        line-height: 1;
        font-weight: 700;
        color: rgba(32, 38, 46, 0.7);
        text-shadow: 0 1px 0 rgba(255,255,255,0.5);
      }
    `
    document.head.appendChild(style)
  }

  panelEl = document.createElement('div')
  panelEl.id = 'material-palette'
  panelEl.className = 'is-hidden'

  const materialRow = document.createElement('div')
  materialRow.className = 'mat-row'

  const label = document.createElement('span')
  label.className = 'mat-label'
  label.textContent = 'Material'
  materialRow.appendChild(label)

  BUILD_MATERIALS.forEach((material, index) => {
    const slot = document.createElement('button')
    slot.className = 'mat-slot'
    slot.dataset.material = material.id
    slot.title = material.description
    slot.style.setProperty('--mat-swatch', material.swatch)
    slot.setAttribute('aria-label', material.label)

    const name = document.createElement('span')
    name.className = 'mat-name'
    name.textContent = material.label

    slot.appendChild(name)
    slot.addEventListener('click', () => MaterialPalette.setActiveMaterial(material.id))
    materialRow.appendChild(slot)

    if (index === 0) slot.classList.add('active')
  })

  const categoryRow = document.createElement('div')
  categoryRow.className = 'mat-row'

  const categoryLabel = document.createElement('span')
  categoryLabel.className = 'mat-label'
  categoryLabel.textContent = 'Build'
  categoryRow.appendChild(categoryLabel)

  BUILD_CATEGORIES.forEach(category => {
    const slot = document.createElement('button')
    slot.className = 'cat-slot'
    slot.dataset.category = category.id
    slot.title = _categoryTitle(category.id)
    slot.textContent = category.label
    slot.addEventListener('click', () => MaterialPalette.setActiveCategory(category.id))
    if (category.id === activeCategory) slot.classList.add('active')
    categoryRow.appendChild(slot)
  })

  panelEl.appendChild(materialRow)
  panelEl.appendChild(_createVariationRow())
  panelEl.appendChild(categoryRow)
  panelEl.appendChild(_createItemRow())
  container.appendChild(panelEl)
}

function _updateSelection() {
  if (!panelEl) return
  panelEl.querySelectorAll('.mat-slot').forEach(slot => {
    slot.classList.toggle('active', slot.dataset.material === activeMaterial)
  })
  panelEl.querySelectorAll('.cat-slot').forEach(slot => {
    slot.classList.toggle('active', slot.dataset.category === activeCategory)
  })
  panelEl.querySelectorAll('.var-slot').forEach(slot => {
    slot.classList.toggle('active', slot.dataset.textureVariation === activeTextureVariation)
  })
  const oldRow = panelEl.querySelector('.kit-row')
  if (oldRow) oldRow.replaceWith(_createItemRow())
}

function _createVariationRow() {
  const row = document.createElement('div')
  row.className = 'mat-row'

  const label = document.createElement('span')
  label.className = 'mat-label'
  label.textContent = 'Texture'
  row.appendChild(label)

  TEXTURE_VARIATIONS.forEach(variation => {
    const slot = document.createElement('button')
    slot.className = 'var-slot'
    slot.dataset.textureVariation = variation.id
    slot.title = variation.id
    slot.textContent = variation.label
    slot.addEventListener('click', () => MaterialPalette.setTextureVariation(variation.id))
    if (variation.id === activeTextureVariation) slot.classList.add('active')
    row.appendChild(slot)
  })

  return row
}

function _categoryTitle(categoryId) {
  const count = ASSET_DEFINITIONS.filter(asset => asset.category === categoryId).length
  if (categoryId === 'auto') return 'Townscaper-like automatic grammar'
  return `${count} registered ${categoryId} assets`
}

function _createItemRow() {
  const row = document.createElement('div')
  row.className = 'kit-row'

  const label = document.createElement('span')
  label.className = 'mat-label'
  label.textContent = 'Kit'
  row.appendChild(label)

  const items = document.createElement('div')
  items.className = 'kit-items'

  _visibleAssets().slice(0, 18).forEach(asset => {
    const slot = document.createElement('button')
    slot.className = 'kit-slot'
    slot.dataset.assetId = asset.id
    slot.title = `${asset.label} - ${asset.placementMode}`
    slot.setAttribute('aria-label', asset.label)

    const img = document.createElement('img')
    img.alt = asset.label
    img.src = _previewUrl(asset.previewPath)

    slot.appendChild(img)
    slot.addEventListener('click', () => MaterialPalette.setActiveAsset(asset.id))
    if (asset.id === activeAssetId) slot.classList.add('active')
    items.appendChild(slot)
  })

  row.appendChild(items)
  return row
}

function _visibleAssets() {
  let assets = ASSET_DEFINITIONS

  if (activeCategory !== 'auto') {
    assets = assets.filter(asset => asset.category === activeCategory)
  }

  const familyMatches = assets.filter(asset => asset.family === activeMaterial)

  return familyMatches.length > 0
    ? [...familyMatches, ...assets.filter(asset => asset.family !== activeMaterial)].slice(0, 24)
    : assets.slice(0, 24)
}

function _syncActiveAsset() {
  const visible = _visibleAssets()
  if (!visible.some(asset => asset.id === activeAssetId)) {
    activeAssetId = visible[0]?.id ?? 'auto'
  }
}

function _previewUrl(previewPath) {
  return new URL(`../assets/models/kenney-town-kit/${previewPath}`, import.meta.url).href
}

function _setupKeyboard() {
  window.addEventListener('ui:keydown', (e) => {
    const { key } = e.detail
    if (key === 'q' || key === 'Q') {
      MaterialPalette.toggle()
      return
    }

    if (key === 'Escape' && isVisible) {
      MaterialPalette.toggle()
      return
    }

    if (!isVisible) return

    const quickKeys = ['1', '2', '3', '4']
    const index = quickKeys.indexOf(String(key).toLowerCase())
    if (index >= 0 && index < BUILD_MATERIALS.length) {
      MaterialPalette.setActiveMaterial(BUILD_MATERIALS[index].id)
    }
  })
}

export { MaterialPalette }
