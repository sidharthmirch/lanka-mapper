import { describe, expect, it } from 'vitest'
import { orderSeriesByMagnitude } from './seriesOrder'

describe('orderSeriesByMagnitude', () => {
  it('orders by the latest-year value, largest first', () => {
    const data = {
      Small: { 2020: 5, 2021: 8 },
      Big: { 2020: 100, 2021: 200 },
      Mid: { 2020: 50, 2021: 60 },
    }
    expect(orderSeriesByMagnitude(data, Object.keys(data))).toEqual(['Big', 'Mid', 'Small'])
  })

  it('falls back to each series own latest value when the global latest year is missing', () => {
    const data = {
      A: { 2019: 10 }, // no 2021 value
      B: { 2021: 5 },
    }
    // global latest = 2021; A has no 2021 → falls back to its 2019 value (10) > B (5)
    expect(orderSeriesByMagnitude(data, ['A', 'B'])).toEqual(['A', 'B'])
  })

  it('breaks ties by name for deterministic order', () => {
    const data = { Bravo: { 2021: 10 }, Alpha: { 2021: 10 } }
    expect(orderSeriesByMagnitude(data, ['Bravo', 'Alpha'])).toEqual(['Alpha', 'Bravo'])
  })

  it('returns a new array and does not mutate the input', () => {
    const names = ['A', 'B']
    const data = { A: { 2021: 1 }, B: { 2021: 2 } }
    const out = orderSeriesByMagnitude(data, names)
    expect(out).toEqual(['B', 'A'])
    expect(names).toEqual(['A', 'B'])
  })
})
