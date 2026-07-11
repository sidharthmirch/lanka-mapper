import { describe, expect, it } from 'vitest'
import {
  formatMetricValue,
  getUnitScaleKind,
  isAdditiveUnit,
  isAdditiveMeasure,
  isDisplayableUnit,
  normalizeUnitLabel,
} from './formatDataValue'

const NBSP = '\u00a0'

describe('getUnitScaleKind', () => {
  it('detects millions-scale units', () => {
    expect(getUnitScaleKind('Rs. Mn')).toBe('million')
    expect(getUnitScaleKind('Mn.')).toBe('million')
    expect(getUnitScaleKind('million LKR')).toBe('million')
    // Plural form ("Millions") is emitted raw by some upstream sources.
    expect(getUnitScaleKind('Millions')).toBe('million')
    expect(formatMetricValue(5800, 'Millions', 'compact')).toBe('5.8B')
  })

  it('detects thousands-scale units', () => {
    expect(getUnitScaleKind("'000")).toBe('thousand')
    expect(getUnitScaleKind("’000")).toBe('thousand')
    expect(getUnitScaleKind("Population ('000)")).toBe('thousand')
    expect(getUnitScaleKind('thousand persons')).toBe('thousand')
  })

  it('detects billions-scale units', () => {
    expect(getUnitScaleKind('Rs. Bn')).toBe('billion')
    expect(getUnitScaleKind('billion')).toBe('billion')
  })

  it('detects percent', () => {
    expect(getUnitScaleKind('%')).toBe('percent')
    expect(getUnitScaleKind('percent')).toBe('percent')
  })
})

describe('formatMetricValue', () => {
  it('compact map tooltips normalize magnitude units to base notation', () => {
    expect(formatMetricValue(5800, 'Mn.', 'compact')).toBe('5.8B')
    expect(formatMetricValue(5800, 'Rs. Mn', 'compact')).toBe(`Rs${NBSP}5.8B`)
    expect(formatMetricValue(1.25, 'Rs. Bn', 'compact')).toBe(`Rs${NBSP}1.3B`)
    expect(formatMetricValue(1190.9, "'000", 'compact')).toBe('1.2M')
    expect(formatMetricValue(491.1222, "Population ('000)", 'compact')).toBe(`491K${NBSP}Population`)
    expect(formatMetricValue(42, 'thousand persons', 'compact')).toBe(`42K${NBSP}persons`)
  })

  it('comfortable tables/sidebar preserve the authored scale faithfully', () => {
    expect(formatMetricValue(5800, 'Mn.', 'comfortable')).toBe(`5,800${NBSP}Mn.`)
    expect(formatMetricValue(12, 'billion people', 'comfortable')).toBe(`12${NBSP}billion people`)
    expect(formatMetricValue(1190.9, "’000", 'comfortable')).toBe(`1,190.9${NBSP}’000`)
    expect(formatMetricValue(42, 'thousand persons', 'comfortable')).toBe(`42${NBSP}thousand persons`)
  })

  it('renders currency as a leading symbol consistently across densities', () => {
    // Scaled currency: scale word kept faithfully in tables, folded into K/M/B on the map.
    expect(formatMetricValue(80, 'Rs. Mn', 'comfortable')).toBe(`Rs${NBSP}80${NBSP}Mn`)
    expect(formatMetricValue(1.25, 'Rs. Bn', 'comfortable')).toBe(`Rs${NBSP}1.25${NBSP}Bn`)
    expect(formatMetricValue(5800, 'Rs. Mn', 'compact')).toBe(`Rs${NBSP}5.8B`)
    // Trillions: GDP totals (Rs. Mn) reach 1e12+ and should read as T, not thousands of B.
    expect(formatMetricValue(2905160, 'Rs. Mn', 'compact')).toBe(`Rs${NBSP}2.9T`)
    // Unscaled currency.
    expect(formatMetricValue(5200000, 'Rs', 'comfortable')).toBe(`Rs${NBSP}5,200,000`)
    expect(formatMetricValue(5200000, 'Rs', 'compact')).toBe(`Rs${NBSP}5.2M`)
    // Per-period currency: the /qualifier attaches with no space.
    expect(formatMetricValue(63030, 'Rs./month', 'comfortable')).toBe(`Rs${NBSP}63,030/month`)
    expect(formatMetricValue(63030, 'Rs./month', 'compact')).toBe(`Rs${NBSP}63K/month`)
    expect(formatMetricValue(80, 'US$ Mn', 'comfortable')).toBe(`US$${NBSP}80${NBSP}Mn`)
    expect(formatMetricValue(5800, 'US$ Mn', 'compact')).toBe(`US$${NBSP}5.8B`)
  })

  it('still uses K/M for generic units in compact mode', () => {
    expect(formatMetricValue(5800, 'rooms', 'compact')).toBe(`5.8K${NBSP}rooms`)
    expect(formatMetricValue(5800, 'rooms', 'comfortable')).toBe(`5,800${NBSP}rooms`)
  })

  it('formats non-display units without suffix', () => {
    expect(formatMetricValue(5800, 'value', 'compact')).toBe('5.8K')
    expect(formatMetricValue(5800, null, 'comfortable')).toBe('5,800')
    // Upstream placeholder scales ("Number"/"Numbers"/"Unit") render bare, not "4,957 Number".
    expect(formatMetricValue(4957, 'Number', 'comfortable')).toBe('4,957')
    expect(formatMetricValue(4957, 'Numbers', 'comfortable')).toBe('4,957')
  })

  it('formats percentages without double scaling', () => {
    expect(formatMetricValue(78.5, '%', 'comfortable')).toBe('78.5%')
    expect(formatMetricValue(80, '%', 'compact')).toBe('80%')
  })

  it('handles non-finite values', () => {
    expect(formatMetricValue(Number.NaN, 'rooms', 'comfortable')).toBe('—')
  })
})

describe('isDisplayableUnit', () => {
  it('rejects placeholders', () => {
    expect(isDisplayableUnit('value')).toBe(false)
    expect(isDisplayableUnit('')).toBe(false)
  })

  it('accepts real units', () => {
    expect(isDisplayableUnit('Rs. Mn')).toBe(true)
    expect(isDisplayableUnit('rooms')).toBe(true)
  })
})

describe('normalizeUnitLabel', () => {
  it('collapses placeholder scales to no unit', () => {
    for (const raw of ['', ' ', 'Unit', 'Units', 'Number', 'Numbers', 'NULL', 'n.a.', null, undefined]) {
      expect(normalizeUnitLabel(raw)).toBe('')
    }
  })

  it('canonicalizes magnitudes, currency-aware', () => {
    expect(normalizeUnitLabel('Million')).toBe('Mn')
    expect(normalizeUnitLabel('Millions')).toBe('Mn')
    expect(normalizeUnitLabel('Mn.')).toBe('Mn')
    expect(normalizeUnitLabel('Rs. million')).toBe('Rs. Mn')
    expect(normalizeUnitLabel('US Million')).toBe('US$ Mn')
    expect(normalizeUnitLabel('US$ Million')).toBe('US$ Mn')
    expect(normalizeUnitLabel('Billion')).toBe('Bn')
    expect(normalizeUnitLabel('bn')).toBe('Bn')
    expect(normalizeUnitLabel("' 000")).toBe("'000")
    expect(normalizeUnitLabel('Thousands')).toBe("'000")
  })

  it('canonicalizes percent and known measures', () => {
    expect(normalizeUnitLabel('Percentage')).toBe('%')
    expect(normalizeUnitLabel('%')).toBe('%')
    expect(normalizeUnitLabel('Metric Tonne')).toBe('tonnes')
    expect(normalizeUnitLabel('Kilometres')).toBe('km')
    expect(normalizeUnitLabel('Index Value')).toBe('index')
  })

  it('passes unknown-but-real units through, whitespace-normalized', () => {
    expect(normalizeUnitLabel('kWh')).toBe('kWh')
    expect(normalizeUnitLabel('TEUs')).toBe('TEUs')
  })
})

describe('isAdditiveUnit', () => {
  it('treats counts and currency as additive', () => {
    expect(isAdditiveUnit('rooms')).toBe(true)
    expect(isAdditiveUnit('persons')).toBe(true)
    expect(isAdditiveUnit('Rs. Mn')).toBe(true)
    expect(isAdditiveUnit('vehicles')).toBe(true)
  })

  it('treats unitless / placeholder values as additive', () => {
    expect(isAdditiveUnit(null)).toBe(true)
    expect(isAdditiveUnit('')).toBe(true)
    expect(isAdditiveUnit('value')).toBe(true)
  })

  it('treats rates, shares, ratios, indices and per-capita as non-additive', () => {
    expect(isAdditiveUnit('%')).toBe(false)
    expect(isAdditiveUnit('percent')).toBe(false)
    expect(isAdditiveUnit('unemployment rate')).toBe(false)
    expect(isAdditiveUnit('per capita')).toBe(false)
    expect(isAdditiveUnit('persons per sq km')).toBe(false)
    expect(isAdditiveUnit('price index')).toBe(false)
    expect(isAdditiveUnit('sex ratio')).toBe(false)
    expect(isAdditiveUnit('°C')).toBe(false)
  })
})

describe('isAdditiveMeasure', () => {
  it('does not sum an explicitly rate-like measure when its source omits a unit', () => {
    expect(isAdditiveMeasure('', 'Unemployment Rate by District')).toBe(false)
    expect(isAdditiveMeasure(null, 'Consumer Price Index')).toBe(false)
    expect(isAdditiveMeasure('', 'Population by District')).toBe(true)
  })
})
