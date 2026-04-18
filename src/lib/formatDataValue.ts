/**
 * Tooltip / UI formatting: locale-aware numbers, optional unit suffix,
 * and context-specific density (compact map vs comfortable sidebar/charts).
 */

/** Lowercase tokens treated as "no real unit" — do not append to numbers. */
const NON_DISPLAY_UNITS = new Set([
  '',
  'value',
  'values',
  'none',
  'null',
  'n/a',
  'na',
  'n.a.',
  'n.a',
  'unknown',
  'unspecified',
  'tbd',
  '-',
  '—',
  '--',
  'unit',
  'units',
])

/** Where the string is shown — affects K/M compression rules. */
export type FormatMetricDensity = 'compact' | 'comfortable'

/** Optional prefs (from app settings); omit for defaults. */
export type FormatMetricOptions = {
  /** When false, no digit grouping (e.g. thousands separator). Default true. */
  useGrouping?: boolean
  /**
   * Max significant digits for the numeric part; `0` or omit = existing auto behavior.
   * Applied before unit suffix; integers stay integer when exact.
   */
  maxSignificantDigits?: number
}

/** Stable locale so map/sidebar numbers match across browsers and CI. */
const VALUE_LOCALE = 'en-US'

function applySignificantDigits(value: number, maxSig: number): number {
  if (maxSig <= 0 || !Number.isFinite(value) || value === 0) return value
  return Number.parseFloat(value.toPrecision(maxSig))
}

function formatWithGrouping(
  value: number,
  useGrouping: boolean,
  fractionDigits?: { max: number; min?: number },
): string {
  if (!Number.isFinite(value)) return '—'
  const opts: Intl.NumberFormatOptions = {
    useGrouping,
    ...(fractionDigits
      ? { maximumFractionDigits: fractionDigits.max, minimumFractionDigits: fractionDigits.min ?? 0 }
      : {}),
  }
  return value.toLocaleString(VALUE_LOCALE, opts)
}

/**
 * Returns true when `unit` should be shown beside numeric values (tooltips, sidebar, charts).
 * Placeholders like "value", "None", or empty strings are rejected.
 */
export function isDisplayableUnit(unit: string | null | undefined): boolean {
  if (unit == null) return false
  const t = unit.trim()
  if (t.length === 0) return false
  return !NON_DISPLAY_UNITS.has(t.toLowerCase())
}

type UnitScaleKind = 'percent' | 'million' | 'billion' | 'generic'

/**
 * Single-pass magnitude-suffix detection. We match once per kind instead of
 * running 5+ overlapping regexes for "million"-flavored strings. `\bmn\.?\b`
 * already catches "Mn", "Mn.", "Rs. Mn", "Rs.Mn", "LKR Mn", "5 Mn" etc.
 * because `\b` is a word boundary, so there is no need for the extra
 * start-anchored / prefix variants that lived here before.
 */
const BILLION_RE = /\b(?:bn|billion)\.?\b/i
const MILLION_RE = /\b(?:mn|million)\.?\b/i

export function getUnitScaleKind(unit: string): UnitScaleKind {
  const t = unit.trim()
  const lower = t.toLowerCase()

  if (lower === '%' || lower === 'percent') return 'percent'
  if (BILLION_RE.test(t)) return 'billion'
  if (MILLION_RE.test(t)) return 'million'
  return 'generic'
}

function isEffectivelyInteger(value: number): boolean {
  return Math.abs(value - Math.round(value)) < 1e-9
}

/** Integers when whole; otherwise a modest number of fraction digits. */
function formatPreferredNumeric(
  value: number,
  useGrouping = true,
  maxSig = 0,
): string {
  if (!Number.isFinite(value)) return '—'
  let v = value
  if (maxSig > 0) {
    v = applySignificantDigits(value, maxSig)
  }
  if (isEffectivelyInteger(v)) {
    return formatWithGrouping(Math.round(v), useGrouping)
  }
  return formatWithGrouping(v, useGrouping, { max: maxSig > 0 ? Math.min(8, maxSig) : 4, min: 0 })
}

function formatPercentValue(value: number, useGrouping = true, maxSig = 0): string {
  if (!Number.isFinite(value)) return '—'
  let v = value
  if (maxSig > 0) {
    v = applySignificantDigits(value, maxSig)
  }
  if (isEffectivelyInteger(v)) {
    return `${formatWithGrouping(Math.round(v), useGrouping)}%`
  }
  return `${formatWithGrouping(v, useGrouping, { max: 2 })}%`
}

/**
 * Generic magnitudes: compact uses K/M; comfortable prefers grouped integers / decimals.
 */
function formatGenericMagnitude(
  value: number,
  density: FormatMetricDensity,
  useGrouping = true,
  maxSig = 0,
): string {
  if (!Number.isFinite(value)) return '—'

  if (density === 'comfortable') {
    return formatPreferredNumeric(value, useGrouping, maxSig)
  }

  let v = value
  if (maxSig > 0) {
    v = applySignificantDigits(value, maxSig)
  }

  if (v >= 1_000_000) {
    const q = v / 1_000_000
    if (isEffectivelyInteger(q)) {
      return `${formatWithGrouping(Math.round(q), useGrouping)}M`
    }
    return `${q.toFixed(1)}M`
  }
  if (v >= 1000) {
    const q = v / 1000
    if (isEffectivelyInteger(q)) {
      return `${formatWithGrouping(Math.round(q), useGrouping)}K`
    }
    return `${q.toFixed(1)}K`
  }
  return formatPreferredNumeric(v, useGrouping, maxSig)
}

/**
 * Format a numeric metric for display with optional unit.
 *
 * @param density - `compact` for map tooltips (comma-grouped millions, no stacked K/M);
 *   `comfortable` for sidebar and charts (integers when whole, else decimals).
 */
export function formatMetricValue(
  value: number,
  unit: string | null,
  density: FormatMetricDensity = 'comfortable',
  options?: FormatMetricOptions,
): string {
  if (!Number.isFinite(value)) return '—'

  const useGrouping = options?.useGrouping !== false
  const maxSig = options?.maxSignificantDigits && options.maxSignificantDigits > 0
    ? Math.min(12, Math.max(1, Math.floor(options.maxSignificantDigits)))
    : 0

  if (!isDisplayableUnit(unit)) {
    return formatGenericMagnitude(value, density, useGrouping, maxSig)
  }

  const u = unit!.trim()
  const scale = getUnitScaleKind(u)

  if (scale === 'percent') {
    return formatPercentValue(value, useGrouping, maxSig)
  }

  if (scale === 'million' || scale === 'billion') {
    const num = formatPreferredNumeric(value, useGrouping, maxSig)
    return `${num}\u00a0${u}`
  }

  const num = formatGenericMagnitude(value, density, useGrouping, maxSig)
  return `${num}\u00a0${u}`
}
