import type { PathOptions, StyleFunction } from 'leaflet'

type GeoJsonStyle = PathOptions | StyleFunction

interface StyleSyncLayer {
  options: {
    style?: GeoJsonStyle
  }
  setStyle: (style: GeoJsonStyle) => unknown
}

/**
 * Leaflet `resetStyle()` reads from `layer.options.style`.
 * Keep that pointer synchronized with the latest computed style function.
 */
export function applyGeoJsonStyle(layer: StyleSyncLayer, styleFn: StyleFunction): void {
  layer.options.style = styleFn
  layer.setStyle(styleFn)
}
