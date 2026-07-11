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
  'number',
  'numbers',
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

/**
 * Prefer explicit units, but safely handle sources that omit a scale while
 * leaving an unmistakable rate/index clue in the measure title.
 */
export function isAdditiveMeasure(unit: string | null | undefined, measureLabel?: string): boolean {
  if (!isAdditiveUnit(unit)) return false
  return !/\b(rate|ratio|index|share|percentage|percent|per capita|average|mean)\b|%/i.test(measureLabel ?? '')
}

type UnitScaleKind = 'percent' | 'thousand' | 'million' | 'billion' | 'generic'

/**
 * Single-pass magnitude-suffix detection. We match once per kind instead of
 * running 5+ overlapping regexes for "million"-flavored strings. `\bmn\.?\b`
 * already catches "Mn", "Mn.", "Rs. Mn", "Rs.Mn", "LKR Mn", "5 Mn" etc.
 * because `\b` is a word boundary, so there is no need for the extra
 * start-anchored / prefix variants that lived here before.
 */
const BILLION_RE = /\b(?:bn|billions?)\.?\b/i
const MILLION_RE = /\b(?:mn|millions?)\.?\b/i
const THOUSAND_RE = /(?:['’`]\s*0{3}|\bthousand(?:s)?\.?\b)/i
const SCALE_TOKEN_RE = /(?:\b(?:bn|billions?|mn|millions?|thousand(?:s)?)\.?\b|['’`]\s*0{3})/gi

export function getUnitScaleKind(unit: string): UnitScaleKind {
  const t = unit.trim()
  const lower = t.toLowerCase()

  if (lower === '%' || lower === 'percent' || lower === 'percentage') return 'percent'
  if (BILLION_RE.test(t)) return 'billion'
  if (MILLION_RE.test(t)) return 'million'
  if (THOUSAND_RE.test(t)) return 'thousand'
  return 'generic'
}

/** Upstream `scale` strings that carry no real unit and should display bare. */
const PLACEHOLDER_UNIT_RE =
  /^(?:unit|units|number|numbers|none|null|value|values|n\.?\s*a\.?|tbd|unknown|unspecified|-|—|--)$/i

/** Messy upstream scale strings → our canonical display vocabulary (non-magnitude units). */
const KNOWN_UNIT_MAP: Record<string, string> = {
  'metric tonne': 'tonnes',
  'metric tonnes': 'tonnes',
  tonne: 'tonnes',
  tonnes: 'tonnes',
  ton: 'tonnes',
  kilometres: 'km',
  kilometers: 'km',
  km: 'km',
  'giga watt hours': 'GWh',
  gwh: 'GWh',
  'mega watt': 'MW',
  megawatt: 'MW',
  mw: 'MW',
  kwh: 'kWh',
  teus: 'TEUs',
  'ton kilometres': 'ton-km',
  'ton kilometers': 'ton-km',
  'sq. km.': 'sq km',
  'sq km': 'sq km',
  'sq.km.': 'sq km',
  'index value': 'index',
  'index points': 'index',
  'index point': 'index',
}

/**
 * Canonicalize the inconsistent upstream `scale` strings (e.g. nuuuwan/CBSL:
 * "Million", "Millions", "Mn.", "Rs. million", "' 000", "Thousands", "Unit",
 * "Number", "Percentage") into the small, consistent vocabulary the formatter
 * understands. Placeholders collapse to '' (rendered with no unit); magnitudes
 * fold into "Mn"/"Bn"/"'000" (currency-aware → "Rs. Mn"); recognized measures
 * map to short forms ("Metric Tonne" → "tonnes"). Unknown-but-real units pass
 * through whitespace-normalized so we never invent or drop information.
 */
export function normalizeUnitLabel(raw: string | null | undefined): string {
  if (raw == null) return ''
  const t = raw.trim().replace(/\s+/g, ' ')
  if (t === '' || PLACEHOLDER_UNIT_RE.test(t)) return ''
  const lower = t.toLowerCase()
  if (t === '%' || lower === 'percent' || lower === 'percentage') return '%'
  const currency = /(?:\b(?:us|usd)\b|us\$)/i.test(t) ? 'US$' : /\b(?:rs|lkr)\b/i.test(t) ? 'Rs.' : ''
  if (/\b(?:bn|billion)\b\.?/i.test(t)) return currency ? `${currency} Bn` : 'Bn'
  if (/\b(?:mn|millions?)\b\.?/i.test(t)) return currency ? `${currency} Mn` : 'Mn'
  if (/['’`]\s*0{3}|\bthousands?\b/i.test(t)) return "'000"
  return KNOWN_UNIT_MAP[lower] ?? t
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
    { threshold: 1_000_000_000_000, suffix: 'T' },
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

/** Currency tokens we render as a leading symbol (Rs 5.8B), never a trailing label. */
const CURRENCY_TOKEN_RE = /\b(?:rs|lkr|usd|eur|gbp)\b\.?|US\$|[$£€]/i

/**
 * Split a unit into its currency symbol (if any) and the remaining label.
 * "Rs. Mn" → { Rs, "Mn" }, "Rs./month" → { Rs, "/month" }, "rooms" → { null, "rooms" }.
 */
function detectCurrency(unit: string): { symbol: string | null; rest: string } {
  const match = unit.match(CURRENCY_TOKEN_RE)
  if (!match) return { symbol: null, rest: unit }
  const raw = match[0].replace(/\.$/, '')
  const symbol = raw.toLowerCase() === 'us$'
    ? 'US$'
    : /^[a-z]+$/i.test(raw) ? (raw.toLowerCase() === 'rs' ? 'Rs' : raw.toUpperCase()) : raw
  const rest = unit
    .replace(CURRENCY_TOKEN_RE, '')
    .replace(/\s+/g, ' ')
    .replace(/^[\s.]+|[\s.]+$/g, '')
    .trim()
  return { symbol, rest }
}

/** Strip magnitude tokens (Mn, '000 …) and tidy parens — used once a scale is folded into K/M/B. */
function stripScaleTokens(label: string): string {
  return label
    .replace(SCALE_TOKEN_RE, '')
    .replace(/[()]/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/[.,]+$/g, '')
    .trim()
}

/** Compose symbol prefix + number + trailing label with consistent spacing. */
function assembleUnit(symbol: string | null, num: string, suffix: string): string {
  let head = num
  if (symbol) {
    const glue = /^[$£€]$/.test(symbol) ? '' : NBSP
    head = `${symbol}${glue}${num}`
  }
  if (!suffix) return head
  // Per-period qualifiers (/month, /capita) attach with no space; real labels get one.
  return suffix.startsWith('/') ? `${head}${suffix}` : `${head}${NBSP}${suffix}`
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

  const { symbol, rest } = detectCurrency(u)

  // Magnitude-bearing units (Mn., Bn., '000 …): on dense map tooltips, normalize
  // to the base value and fold the scale into K/M/B (5800 "Rs. Mn" → "Rs 5.8B").
  // Everywhere else (tables, sidebar, charts) preserve the authored scale word
  // faithfully (80 "Rs. Mn" → "Rs 80 Mn"). A currency symbol always leads as a
  // prefix in BOTH densities so money reads consistently across the app.
  if (scale === 'thousand' || scale === 'million' || scale === 'billion') {
    if (density === 'compact') {
      const base = value * unitInputMultiplier(scale)
      const num = formatCompactNumber(base, useGrouping, maxSig || 3)
      return assembleUnit(symbol, num, stripScaleTokens(rest))
    }
    const num = formatPreferredNumeric(value, useGrouping, maxSig)
    return assembleUnit(symbol, num, rest)
  }

  const num = formatGenericMagnitude(value, density, useGrouping, maxSig)
  return assembleUnit(symbol, num, rest)
}
