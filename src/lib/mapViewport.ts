export type MapViewportPlacement = 'auto' | 'left' | 'center' | 'right'
export type ResolvedMapViewportPlacement = Exclude<MapViewportPlacement, 'auto'>

/** Semantic layout facts used to preserve a usable map canvas around overlays. */
export interface MapSafeViewport {
  width: number
  height: number
  mode: 'mobile' | 'tablet' | 'desktop'
  rankingsVisible: boolean
  legendVisible: boolean
  selectionVisible: boolean
  timelineVisible: boolean
  railVisible: boolean
}

export interface MapSafeInsets {
  top: number
  right: number
  bottom: number
  left: number
}

const MAP_EDGE = 20

/**
 * Auto follows the occupied semantic space. Explicit placement never changes
 * as overlays appear or disappear, although every placement still keeps core
 * controls out of the fitted geography.
 */
export function resolveMapViewportPlacement(
  placement: MapViewportPlacement,
  viewport: Pick<MapSafeViewport, 'rankingsVisible' | 'mode'>,
): ResolvedMapViewportPlacement {
  if (placement !== 'auto') return placement
  return viewport.rankingsVisible && viewport.mode !== 'mobile' ? 'right' : 'center'
}

/** Convert semantic overlays + user framing into Leaflet's padded fit insets. */
export function calculateMapSafeInsets(
  placement: MapViewportPlacement,
  viewport: MapSafeViewport,
): MapSafeInsets {
  const resolved = resolveMapViewportPlacement(placement, viewport)
  const timeline = viewport.timelineVisible
    ? Math.min(viewport.mode === 'mobile' ? 220 : 154, Math.round(viewport.height * (viewport.mode === 'mobile' ? 0.36 : 0.24)))
    : 0
  const rail = viewport.railVisible ? 72 : 0
  const ranking = viewport.rankingsVisible && viewport.mode !== 'mobile'
    ? Math.min(336, Math.round(viewport.width * 0.28))
    : 0
  // Match the actual desktop panels: 232–256px scale legend and a selected
  // region readout that may reach 18rem. Use the larger occupied side.
  const legend = viewport.legendVisible && viewport.mode !== 'mobile'
    ? Math.min(256, Math.round(viewport.width * 0.3))
    : 0
  const selection = viewport.selectionVisible && viewport.mode !== 'mobile'
    ? Math.min(288, Math.round(viewport.width * 0.34))
    : 0
  // Explicit placement must dominate asymmetric safe insets (for example a
  // 288px selected-region readout on the right), rather than being cancelled
  // by the overlay it is intended to work beside.
  const placementOffset = Math.round(viewport.width * (viewport.mode === 'mobile' ? 0.18 : 0.32))

  let left = MAP_EDGE + ranking
  let right = MAP_EDGE + Math.max(rail, legend, selection)
  if (resolved === 'right') left += placementOffset
  if (resolved === 'left') right += placementOffset

  // Center is a true canvas-center request. Mirror any side safety reserve so
  // a legend or collapsed rail cannot quietly nudge it off centre.
  if (resolved === 'center') {
    const symmetric = Math.max(left, right)
    left = symmetric
    right = symmetric
  }

  // On narrow handsets overlays stack above the map, so a centered safe canvas
  // avoids pretending there is a stable horizontal side that does not exist.
  if (viewport.mode === 'mobile' && placement === 'auto') {
    const symmetric = Math.max(left, right)
    left = symmetric
    right = symmetric
  }

  return { top: MAP_EDGE, right, bottom: MAP_EDGE + timeline, left }
}
