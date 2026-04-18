/** Accent colors for MUI `primary` and CSS `--primary`. */
export const DEFAULT_ACCENT_ID = 'ocean'
export const DEFAULT_GRADIENT_ID = 'ocean'

export const ACCENT_PRESETS = [
  {
    id: 'ocean',
    label: 'Ocean',
    main: '#2f8fcd',
    dark: '#216a9b',
    light: '#79bde8',
    /** Soft neutral — easy on dark UI / map chrome. */
    soft: '#d5dfe8',
  },
  {
    id: 'forest',
    label: 'Forest',
    main: '#2d7a4e',
    dark: '#1e5634',
    light: '#5cb884',
    soft: '#d5e5dc',
  },
  {
    id: 'violet',
    label: 'Violet',
    main: '#6b4fc6',
    dark: '#4f36a3',
    light: '#9b87e8',
    soft: '#e2deef',
  },
  {
    id: 'ember',
    label: 'Ember',
    main: '#c45c26',
    dark: '#9a4418',
    light: '#e8925c',
    soft: '#ebe4df',
  },
  {
    id: 'slate',
    label: 'Slate',
    main: '#475569',
    dark: '#334155',
    light: '#94a3b8',
    soft: '#d8dce3',
  },
] as const

export type AccentPresetId = (typeof ACCENT_PRESETS)[number]['id']

/** Choropleth / region shading ramps (6 stops, low → high). */
export const GRADIENT_PRESETS = [
  {
    id: 'ocean',
    label: 'Ocean',
    /** Low stop: tinted gray (not near-white) so light UI / map stays easy on the eyes. */
    colors: ['#dfe8f4', '#c0d8f5', '#7cb3e8', '#3d8fd6', '#1f68ad', '#17457a'],
  },
  {
    id: 'forest',
    label: 'Forest',
    colors: ['#ddeee4', '#b8dcc4', '#6fb88a', '#3d8f5c', '#2d6a45', '#1a4029'],
  },
  {
    id: 'magma',
    label: 'Magma',
    colors: ['#f2e6d8', '#fdd49e', '#fc8d59', '#e34a33', '#b30000', '#490006'],
  },
  {
    id: 'purple',
    label: 'Purple',
    colors: ['#eae2f3', '#d4c4f0', '#a78bda', '#7b52c4', '#5a32a8', '#3a1f6e'],
  },
  {
    id: 'grayscale',
    label: 'Grayscale',
    colors: ['#eceff2', '#dee2e6', '#adb5bd', '#6c757d', '#495057', '#212529'],
  },
  {
    id: 'teal',
    label: 'Teal',
    colors: ['#dff3ef', '#b2ebe0', '#5fd4c4', '#2db5a8', '#1a7f76', '#0d4d47'],
  },
] as const

export type GradientPresetId = (typeof GRADIENT_PRESETS)[number]['id']

/** Stops in each ramp; exposed as `--gradient-0` … `--gradient-5` on `document.documentElement`. */
export const REGION_SHADING_GRADIENT_STOPS = 6

export function getGradientColors(presetId: string): string[] {
  const preset = GRADIENT_PRESETS.find((g) => g.id === presetId)
  return preset ? [...preset.colors] : [...GRADIENT_PRESETS[0].colors]
}

/** Syncs the active region-shading ramp to CSS vars for slider, rankings bars, etc. */
export function applyRegionShadingGradientCssVars(colors: string[]): void {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  for (let i = 0; i < REGION_SHADING_GRADIENT_STOPS; i++) {
    root.style.setProperty(`--gradient-${i}`, colors[i] ?? colors[colors.length - 1])
  }
}

/** Full horizontal ramp using active `--gradient-*` (map legend, sidebar preview). */
export const REGION_SHADING_GRADIENT_CSS =
  'linear-gradient(90deg, var(--gradient-0), var(--gradient-1), var(--gradient-2), var(--gradient-3), var(--gradient-4), var(--gradient-5))'

function clamp255(n: number): number {
  return Math.max(0, Math.min(255, Math.round(n)))
}

function parseHex(hex: string): { r: number; g: number; b: number } | null {
  const h = hex.replace('#', '')
  if (h.length !== 6 || !/^[0-9a-fA-F]{6}$/.test(h)) return null
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  }
}

function rgbToHex(rgb: { r: number; g: number; b: number }): string {
  return `#${[rgb.r, rgb.g, rgb.b].map((c) => clamp255(c).toString(16).padStart(2, '0')).join('')}`
}

function shadeHex(hex: string, factor: number): string {
  const p = parseHex(hex)
  if (!p) return hex
  return rgbToHex({ r: p.r * factor, g: p.g * factor, b: p.b * factor })
}

function lightenTowardWhite(hex: string, t: number): string {
  const p = parseHex(hex)
  if (!p) return hex
  const l = (c: number) => c + (255 - c) * t
  return rgbToHex({ r: l(p.r), g: l(p.g), b: l(p.b) })
}

export function getAccentPreset(presetId: string) {
  return ACCENT_PRESETS.find((a) => a.id === presetId) ?? ACCENT_PRESETS[0]
}

/** Bold UI accent vs soft grey-tinted accent (better on dark backgrounds). */
export type AccentTone = 'main' | 'soft'

export function getAccentUiPalette(presetId: string, tone: AccentTone): { main: string; dark: string; light: string } {
  const p = getAccentPreset(presetId)
  if (tone === 'main') {
    return { main: p.main, dark: p.dark, light: p.light }
  }
  return {
    main: p.soft,
    dark: shadeHex(p.soft, 0.78),
    light: lightenTowardWhite(p.soft, 0.34),
  }
}
