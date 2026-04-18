import { describe, expect, it } from 'vitest'
import { formatMetricValue, getUnitScaleKind, isDisplayableUnit } from './formatDataValue'

const NBSP = '\u00a0'

describe('getUnitScaleKind', () => {
  it('detects millions-scale units', () => {
    expect(getUnitScaleKind('Rs. Mn')).toBe('million')
    expect(getUnitScaleKind('Mn.')).toBe('million')
    expect(getUnitScaleKind('million LKR')).toBe('million')
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
  it('does not stack K on millions-valued units (5800 Mn → 5,800 Mn)', () => {
    expect(formatMetricValue(5800, 'Mn.', 'compact')).toBe(`5,800${NBSP}Mn.`)
    expect(formatMetricValue(5800, 'Mn.', 'comfortable')).toBe(`5,800${NBSP}Mn.`)
    expect(formatMetricValue(5800, 'Rs. Mn', 'compact')).toBe(`5,800${NBSP}Rs. Mn`)
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
