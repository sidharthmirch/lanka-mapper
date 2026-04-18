import { describe, it, expect } from 'vitest'
import { lerpValues, buildMapDataInterpolated, PROVINCE_TO_DISTRICTS } from './mapInterpolation'

describe('lerpValues', () => {
  it('returns a at t=0', () => {
    expect(lerpValues(10, 20, 0)).toBe(10)
  })

  it('returns b at t=1', () => {
    expect(lerpValues(10, 20, 1)).toBe(20)
  })

  it('returns midpoint at t=0.5', () => {
    expect(lerpValues(10, 20, 0.5)).toBe(15)
  })

  it('handles a=b (no change across years)', () => {
    expect(lerpValues(5, 5, 0.7)).toBe(5)
  })

  it('handles zero-crossing (b=0)', () => {
    expect(lerpValues(10, 0, 0.5)).toBe(5)
  })

  it('handles both zeros', () => {
    expect(lerpValues(0, 0, 0.5)).toBe(0)
  })
})

describe('buildMapDataInterpolated', () => {
  const series: Record<string, Record<number, number>> = {
    Colombo: { 2020: 100, 2021: 200 },
    Kandy: { 2020: 50, 2021: 50 },
    Galle: { 2020: 0, 2021: 80 },
  }

  it('returns empty for national level', () => {
    expect(buildMapDataInterpolated(series, 2020, 2021, 0.5, 'national')).toHaveLength(0)
  })

  it('returns empty for null level', () => {
    expect(buildMapDataInterpolated(series, 2020, 2021, 0.5, null)).toHaveLength(0)
  })

  describe('district level', () => {
    it('returns one row per district', () => {
      const result = buildMapDataInterpolated(series, 2020, 2021, 0.5, 'district')
      expect(result).toHaveLength(3)
    })

    it('interpolates values correctly at t=0.5', () => {
      const result = buildMapDataInterpolated(series, 2020, 2021, 0.5, 'district')
      const colombo = result.find((r) => r.name === 'Colombo')
      expect(colombo?.value).toBe(150)
    })

    it('does NOT drop regions with zero interpolated value (no flicker)', () => {
      const zeroSeries: Record<string, Record<number, number>> = {
        Colombo: { 2020: 0, 2021: 0 },
      }
      const result = buildMapDataInterpolated(zeroSeries, 2020, 2021, 0.5, 'district')
      expect(result).toHaveLength(1)
      expect(result[0].value).toBe(0)
    })

    it('preserves regions crossing zero (interpolation fix)', () => {
      const crossSeries: Record<string, Record<number, number>> = {
        Galle: { 2020: 0, 2021: 80 },
      }
      const atMid = buildMapDataInterpolated(crossSeries, 2020, 2021, 0.5, 'district')
      expect(atMid[0].value).toBe(40)
    })
  })

  describe('province level', () => {
    const provinceSeries: Record<string, Record<number, number>> = {
      'Western Province': { 2020: 100, 2021: 200 },
    }

    it('expands province to its districts', () => {
      const result = buildMapDataInterpolated(provinceSeries, 2020, 2021, 0, 'province')
      const expectedDistricts = PROVINCE_TO_DISTRICTS['Western Province']
      expect(result).toHaveLength(expectedDistricts.length)
      result.forEach((row) => {
        expect(expectedDistricts).toContain(row.district)
        expect(row.originalName).toBe('Western Province')
      })
    })

    it('includes provinces with zero interpolated value (no flicker)', () => {
      const zeroProvince: Record<string, Record<number, number>> = {
        'Western Province': { 2020: 0, 2021: 0 },
      }
      const result = buildMapDataInterpolated(zeroProvince, 2020, 2021, 0.5, 'province')
      expect(result).toHaveLength(PROVINCE_TO_DISTRICTS['Western Province'].length)
      result.forEach((row) => expect(row.value).toBe(0))
    })

    it('interpolates province values at midpoint', () => {
      const result = buildMapDataInterpolated(provinceSeries, 2020, 2021, 0.5, 'province')
      result.forEach((row) => expect(row.value).toBe(150))
    })

    it('unknown province produces no rows', () => {
      const unknownProvince: Record<string, Record<number, number>> = {
        'Unknown Province': { 2020: 10, 2021: 20 },
      }
      const result = buildMapDataInterpolated(unknownProvince, 2020, 2021, 0.5, 'province')
      expect(result).toHaveLength(0)
    })
  })
})
