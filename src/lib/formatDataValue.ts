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
const NBSP = '\u00a0'

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

/** Rates, shares, ratios, indices, per-capita, temperatures — summing across regions is meaningless. */
const NON_ADDITIVE_RE = /%|percent|\bper\b|\brate\b|\bratio\b|\bindex\b|\baverage\b|\bmean\b|\bpp\b|°/i

/**
 * Whether summing this unit across regions is meaningful. Counts (rooms, persons,
 * vehicles) and currency are additive; percentages, rates, ratios, indices, and
 * per-capita figures are NOT — for those, a "total" is nonsense (e.g. summing
 * district percentages to 340%). Callers should lead with an average instead.
 * Unitless values default to additive.
 */
export function isAdditiveUnit(unit: string | null | undefined): boolean {
  if (!isDisplayableUnit(unit)) return true
  return !NON_ADDITIVE_RE.test(unit!.trim())
}

type UnitScaleKind = 'percent' | 'thousand' | 'million' | 'billion' | 'generic'

/**
 * Single-pass magnitude-suffix detection. We match once per kind instead of
 * running 5+ overlapping regexes for "million"-flavored strings. `\bmn\.?\b`
 * already catches "Mn", "Mn.", "Rs. Mn", "Rs.Mn", "LKR Mn", "5 Mn" etc.
 * because `\b` is a word boundary, so there is no need for the extra
 * start-anchored / prefix variants that lived here before.
 */
const BILLION_RE = /\b(?:bn|billion)\.?\b/i
const MILLION_RE = /\b(?:mn|million)\.?\b/i
const THOUSAND_RE = /(?:['’`]\s*0{3}|\bthousand(?:s)?\.?\b)/i
const SCALE_TOKEN_RE = /(?:\b(?:bn|billion|mn|million|thousand(?:s)?)\.?\b|['’`]\s*0{3})/gi

export function getUnitScaleKind(unit: string): UnitScaleKind {
  const t = unit.trim()
  const lower = t.toLowerCase()

  if (lower === '%' || lower === 'percent') return 'percent'
  if (BILLION_RE.test(t)) return 'billion'
  if (MILLION_RE.test(t)) return 'million'
  if (THOUSAND_RE.test(t)) return 'thousand'
  return 'generic'
}

function isEffectivelyInteger(value: number): boolean {
  return Math.abs(value - Math.round(value)) < 1e-9
}

function compactFractionDigits(value: number): number {
  const abs = Math.abs(value)
  if (abs >= 100) return 0
  return 1
}

function formatCompactNumber(value: number, useGrouping = true, maxSig = 0): string {
  if (!Number.isFinite(value)) return '—'
  let v = value
  if (maxSig > 0) {
    v = applySignificantDigits(value, maxSig)
  }

  const abs = Math.abs(v)
  const compactScales: Array<{ threshold: number; suffix: string }> = [
    { threshold: 1_000_000_000, suffix: 'B' },
    { threshold: 1_000_000, suffix: 'M' },
    { threshold: 1_000, suffix: 'K' },
  ]

  const scale = compactScales.find((entry) => abs >= entry.threshold)
  if (!scale) return formatPreferredNumeric(v, useGrouping, maxSig)

  const scaled = v / scale.threshold
  const formatted = formatWithGrouping(scaled, useGrouping, { max: compactFractionDigits(scaled) })
  return `${formatted}${scale.suffix}`
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

  return formatCompactNumber(v, useGrouping, maxSig)
}

function unitInputMultiplier(scale: UnitScaleKind): number {
  if (scale === 'billion') return 1_000_000_000
  if (scale === 'million') return 1_000_000
  if (scale === 'thousand') return 1_000
  return 1
}

function normalizeScaledUnitLabel(unit: string): string {
  const label = unit
    .replace(SCALE_TOKEN_RE, '')
    .replace(/[()]/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/[.,]+$/g, '')
    .trim()

  if (/^rs\.?$/i.test(label)) return 'Rs'
  if (/^lkr$/i.test(label)) return 'LKR'
  return label
}

function isCurrencyLabel(label: string): boolean {
  return /^(?:rs|lkr|usd|eur|gbp|\$|£|€)$/i.test(label)
}

function formatScaledUnitValue(
  value: number,
  unit: string,
  scale: UnitScaleKind,
  useGrouping = true,
  maxSig = 0,
): string {
  const baseValue = value * unitInputMultiplier(scale)
  const num = formatCompactNumber(baseValue, useGrouping, maxSig || 3)
  const label = normalizeScaledUnitLabel(unit)
  if (!label) return num
  if (isCurrencyLabel(label)) return `${label}${NBSP}${num}`
  return `${num}${NBSP}${label}`
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

  // Magnitude-bearing units (Mn., Bn., '000 …): on dense map tooltips, normalize
  // to the base value and compact it (5800 "Rs. Mn" → "Rs 5.8B"). Everywhere else
  // (tables, sidebar, charts) preserve the authored scale faithfully — grouped
  // digits plus the original unit, never a stacked K/M (5800 "Rs. Mn" → "5,800 Rs. Mn").
  if (scale === 'thousand' || scale === 'million' || scale === 'billion') {
    if (density === 'compact') {
      return formatScaledUnitValue(value, u, scale, useGrouping, maxSig)
    }
    const preserved = formatPreferredNumeric(value, useGrouping, maxSig)
    return `${preserved}${NBSP}${u}`
  }

  const num = formatGenericMagnitude(value, density, useGrouping, maxSig)
  return `${num}${NBSP}${u}`
}
