import type { LatLngExpression, Layer } from 'leaflet'
import 'leaflet'

declare module 'leaflet' {
  interface HeatLayerOptions {
    minOpacity?: number
    maxZoom?: number
    max?: number
    radius?: number
    blur?: number
    gradient?: Record<number, string>
  }

  interface HeatLayer extends Layer {
    setLatLngs(latlngs: Array<[number, number, number?] | LatLngExpression>): this
    addLatLng(latlng: [number, number, number?] | LatLngExpression): this
    setOptions(options: HeatLayerOptions): this
    redraw(): this
  }

  function heatLayer(
    latlngs: Array<[number, number, number?] | LatLngExpression>,
    options?: HeatLayerOptions,
  ): HeatLayer
}
