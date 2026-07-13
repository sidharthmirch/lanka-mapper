import { describe, expect, it } from 'vitest'
import {
  calculateMapSafeInsets,
  resolveMapViewportPlacement,
  type MapSafeViewport,
} from './mapViewport'

describe('map viewport placement', () => {
  const desktop: MapSafeViewport = {
    width: 1200,
    height: 760,
    mode: 'desktop',
    rankingsVisible: true,
    legendVisible: true,
    selectionVisible: false,
    timelineVisible: true,
    railVisible: false,
  }

  it('biases Auto to the right of a visible left rankings panel', () => {
    expect(resolveMapViewportPlacement('auto', desktop)).toBe('right')
    const insets = calculateMapSafeInsets('auto', desktop)
    expect(insets.left).toBeGreaterThan(insets.right)
    expect(insets.bottom).toBeGreaterThan(100)
  })

  it('recenters Auto when rankings are hidden', () => {
    const viewport = { ...desktop, rankingsVisible: false }
    expect(resolveMapViewportPlacement('auto', viewport)).toBe('center')
    const insets = calculateMapSafeInsets('auto', viewport)
    expect(insets.left).toBe(insets.right)
  })

  it('keeps explicit placements stable regardless of rankings visibility', () => {
    const hidden = { ...desktop, rankingsVisible: false }
    expect(resolveMapViewportPlacement('left', desktop)).toBe('left')
    expect(resolveMapViewportPlacement('left', hidden)).toBe('left')
    expect(calculateMapSafeInsets('left', desktop).right).toBeGreaterThan(
      calculateMapSafeInsets('left', desktop).left,
    )
    expect(calculateMapSafeInsets('right', hidden).left).toBeGreaterThan(
      calculateMapSafeInsets('right', hidden).right,
    )
  })

  it('reserves the actual right-side selection footprint', () => {
    const withSelection = calculateMapSafeInsets('right', { ...desktop, selectionVisible: true })
    const withoutSelection = calculateMapSafeInsets('right', desktop)
    expect(withSelection.right).toBeGreaterThan(withoutSelection.right)
  })
})
