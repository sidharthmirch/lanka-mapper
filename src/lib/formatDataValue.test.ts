import { describe, expect, it } from 'vitest'
import { formatMetricValue, getUnitScaleKind, isAdditiveUnit, isDisplayableUnit } from './formatDataValue'

const NBSP = '\u00a0'

describe('getUnitScaleKind', () => {
  it('detects millions-scale units', () => {
    expect(getUnitScaleKind('Rs. Mn')).toBe('million')
    expect(getUnitScaleKind('Mn.')).toBe('million')
    expect(getUnitScaleKind('million LKR')).toBe('million')
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
    expect(formatMetricValue(80, 'Rs. Mn', 'comfortable')).toBe(`80${NBSP}Rs. Mn`)
    expect(formatMetricValue(1.25, 'Rs. Bn', 'comfortable')).toBe(`1.25${NBSP}Rs. Bn`)
    expect(formatMetricValue(12, 'billion people', 'comfortable')).toBe(`12${NBSP}billion people`)
    expect(formatMetricValue(1190.9, "’000", 'comfortable')).toBe(`1,190.9${NBSP}’000`)
    expect(formatMetricValue(42, 'thousand persons', 'comfortable')).toBe(`42${NBSP}thousand persons`)
  })

  it('still uses K/M for generic units in compact mode', () => {
    expect(formatMetricValue(5800, 'rooms', 'compact')).toBe(`5.8K${NBSP}rooms`)
    expect(formatMetricValue(5800, 'rooms', 'comfortable')).toBe(`5,800${NBSP}rooms`)
  })

  it('formats non-display units without suffix', () => {
    expect(formatMetricValue(5800, 'value', 'compact')).toBe('5.8K')
    expect(formatMetricValue(5800, null, 'comfortable')).toBe('5,800')
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
