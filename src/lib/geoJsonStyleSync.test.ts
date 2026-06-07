import { describe, expect, it, vi } from 'vitest'
import type { StyleFunction } from 'leaflet'
import { applyGeoJsonStyle } from './geoJsonStyleSync'

describe('applyGeoJsonStyle', () => {
  it('syncs options.style and applies style to layers', () => {
    const styleFn = vi.fn(() => ({ color: '#fff' })) as unknown as StyleFunction
    const setStyle = vi.fn()
    const layer = {
      options: {} as { style?: StyleFunction },
      setStyle,
    }

    applyGeoJsonStyle(layer, styleFn)

    expect(layer.options.style).toBe(styleFn)
    expect(setStyle).toHaveBeenCalledTimes(1)
    expect(setStyle).toHaveBeenCalledWith(styleFn)
  })

  it('replaces any stale style function', () => {
    const staleStyleFn = vi.fn(() => ({ color: '#00f' })) as unknown as StyleFunction
    const freshStyleFn = vi.fn(() => ({ color: '#0f0' })) as unknown as StyleFunction
    const layer = {
      options: { style: staleStyleFn },
      setStyle: vi.fn(),
    }

    applyGeoJsonStyle(layer, freshStyleFn)

    expect(layer.options.style).toBe(freshStyleFn)
    expect(layer.setStyle).toHaveBeenCalledWith(freshStyleFn)
  })
})
