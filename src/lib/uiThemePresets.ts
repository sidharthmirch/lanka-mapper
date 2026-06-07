/** Accent colors for MUI `primary` and CSS `--primary`. Warm-neutral hub palette. */
export const DEFAULT_ACCENT_ID = 'terracotta'
export const DEFAULT_GRADIENT_ID = 'terracotta'

export const ACCENT_PRESETS = [
  {
    id: 'terracotta',
    label: 'Terracotta',
    main: '#b45830',
    dark: '#8f4424',
    light: '#c97a52',
    /** Soft warm tint — for subtle selected/hover surfaces. */
    soft: '#ead9cb',
  },
  {
    id: 'green',
    label: 'Green',
    main: '#3b665a',
    dark: '#2c4d44',
    light: '#6a9286',
    soft: '#d8e3dd',
  },
  {
    id: 'gold',
    label: 'Gold',
    main: '#8f6b3d',
    dark: '#6f5230',
    light: '#b08a5b',
    soft: '#e8ddc9',
  },
  {
    id: 'slate',
    label: 'Slate',
    main: '#5b5448',
    dark: '#443e35',
    light: '#8a8174',
    soft: '#ddd6c9',
  },
] as const

export type AccentPresetId = (typeof ACCENT_PRESETS)[number]['id']

/** Choropleth / region shading ramps (6 stops, low → high). Warm-neutral hub palette. */
export const GRADIENT_PRESETS = [
  {
    id: 'terracotta',
    label: 'Terracotta',
    /** Low stop: warm cream (not white) so light map chrome stays easy on the eyes. */
    colors: ['#f1e4d7', '#e7c4a4', '#d79a6e', '#c2703f', '#a04a22', '#6f3216'],
  },
  {
    id: 'green',
    label: 'Green',
    colors: ['#e4ece2', '#bdd6c4', '#8cbb9d', '#579577', '#386b54', '#214234'],
  },
  {
    id: 'gold',
    label: 'Gold',
    colors: ['#f3ead8', '#e6cf9f', '#d2ab63', '#b5853b', '#8a6330', '#5c4220'],
  },
  {
    id: 'slate',
    label: 'Slate',
    colors: ['#ece7dc', '#d6cdbb', '#b6aa92', '#90876f', '#665e50', '#3d382f'],
  },
  {
    id: 'oxblood',
    label: 'Oxblood',
    colors: ['#f0e2da', '#dcae9a', '#c47a5f', '#a64a30', '#7e2c1a', '#4d180e'],
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
