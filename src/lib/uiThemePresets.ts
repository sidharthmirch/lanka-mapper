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
    /** Bold accent tuned for the dark terminal base (brighter than `main`). */
    darkMain: '#e07d54',
    /** Soft warm tint — for subtle selected/hover surfaces. */
    soft: '#ead9cb',
  },
  {
    id: 'green',
    label: 'Sage',
    main: '#3b665a',
    dark: '#2c4d44',
    light: '#6a9286',
    darkMain: '#74b394',
    soft: '#d8e3dd',
  },
  {
    id: 'gold',
    label: 'Amber',
    main: '#8f6b3d',
    dark: '#6f5230',
    light: '#b08a5b',
    darkMain: '#d6a14a',
    soft: '#e8ddc9',
  },
  {
    id: 'slate',
    label: 'Slate',
    main: '#5b5448',
    dark: '#443e35',
    light: '#8a8174',
    darkMain: '#aab1a2',
    soft: '#ddd6c9',
  },
] as const

export type AccentPresetId = (typeof ACCENT_PRESETS)[number]['id']

/**
 * Choropleth / region shading ramps (6 stops, low → high). Terminal convention:
 * low values sit deep/dim against the dark desk, high values glow — values read
 * as heat. Each ramp stays legible in the light variant (low = high contrast on
 * the cream surface).
 */
export const GRADIENT_PRESETS = [
  {
    id: 'terracotta',
    label: 'Terracotta',
    colors: ['#2c2016', '#6a3f23', '#9d5a30', '#c8783f', '#e0a35d', '#f4d196'],
  },
  {
    id: 'green',
    label: 'Sage',
    colors: ['#16241c', '#244e3a', '#356b4e', '#4f9472', '#74b394', '#a9d8bf'],
  },
  {
    id: 'gold',
    label: 'Amber',
    colors: ['#241c12', '#5a4420', '#8a6a2c', '#b5903b', '#d6b455', '#f0dc9e'],
  },
  {
    id: 'slate',
    label: 'Slate',
    colors: ['#1c1f1b', '#3a3f37', '#5a6056', '#828a7c', '#aab1a2', '#d4dace'],
  },
  {
    id: 'oxblood',
    label: 'Oxblood',
    colors: ['#2a1410', '#5c241a', '#8a3422', '#b85433', '#dd7e4f', '#f0b487'],
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

export function getAccentUiPalette(
  presetId: string,
  tone: AccentTone,
  isDark = false,
): { main: string; dark: string; light: string } {
  const p = getAccentPreset(presetId)
  if (tone === 'main') {
    // On the dark terminal base, the standard `main` shades read too low; use
    // the per-preset `darkMain` so the accent stays legible against #0f1311.
    if (isDark) {
      return { main: p.darkMain, dark: p.main, light: p.light }
    }
    return { main: p.main, dark: p.dark, light: p.light }
  }
  return {
    main: p.soft,
    dark: shadeHex(p.soft, 0.78),
    light: lightenTowardWhite(p.soft, 0.34),
  }
}
