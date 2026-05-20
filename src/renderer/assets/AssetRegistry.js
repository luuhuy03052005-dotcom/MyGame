/**
 * AssetRegistry.js — Map từ assetType → filename GLB
 *
 * Theo DATA_MODELS.md mục 8.
 * Trong Phase 0-4: AssetManager sẽ dùng placeholder primitives thay vì GLB thật.
 */

export const ASSET_REGISTRY = {
  foundation_solid:  'foundation_solid.glb',
  foundation_arch:   'foundation_arch.glb',
  wall_flat:         'wall_flat.glb',
  wall_window:       'wall_window.glb',
  wall_corner:       'wall_corner.glb',
  roof_peak:         'roof_peak.glb',
  roof_gable:        'roof_gable.glb',
  roof_hip_corner:   'roof_hip_corner.glb',
  roof_t_junction:   'roof_t_junction.glb',
  roof_flat:         'roof_flat.glb',
  bridge_span:       'bridge_span.glb',
  wall_mid:         'wall_mid.glb',
  foundation_wall:  'foundation_wall.glb',
  _fallback:         '_fallback_cube.glb',  // LUÔN phải resolve được
}

// Tất cả keys hợp lệ
export const VALID_ASSET_TYPES = Object.keys(ASSET_REGISTRY)

// Palette màu mặc định 16 màu pastel — theo DATA_MODELS.md mục 9
export const DEFAULT_PALETTE = [
  '#F5DEB3',   // Wheat
  '#DEB887',   // Burlywood
  '#CD853F',   // Peru
  '#8B4513',   // SaddleBrown
  '#D2B48C',   // Tan
  '#BC8F5F',   // RosyBrown
  '#E8A87C',   // Apricot
  '#F4A460',   // SandyBrown
  '#FFDEAD',   // NavajoWhite
  '#FAEBD7',   // AntiqueWhite
  '#FFE4C4',   // Bisque
  '#FAD7A0',   // Peach
  '#A8D8EA',   // Light blue
  '#7FB3D3',   // Steel blue
  '#5D8AA8',   // Air Force blue
  '#A3C4BC',   // Teal nhạt
]
