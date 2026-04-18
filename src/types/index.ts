/** Geographic coordinate pair used by map state and bounds. */
export type LatLngTuple = [lat: number, lng: number]

/** Leaflet-style map bounds represented by south-west and north-east corners. */
export type MapBounds = [southWest: LatLngTuple, northEast: LatLngTuple]

/**
 * Minimal geometry model for district boundaries used in Sri Lanka map layers.
 */
export interface DistrictGeometry {
  type: 'Polygon' | 'MultiPolygon'
  coordinates: LatLngTuple[][] | LatLngTuple[][][]
}

/**
 * GeoJSON feature for a Sri Lanka district boundary with district-specific properties.
 */
export interface DistrictFeature {
  type: 'Feature'
  geometry: DistrictGeometry
  properties: {
    electoralDistrict: string
    electoralDistrictCode: string
    [key: string]: unknown
  }
}

export interface DatasetManifestEntry {
  id: string
  name: string
  description: string
  source: 'ldflk' | 'nuuuwan'
  secondarySource?: string
  unit: string
  level: 'district' | 'province' | 'national'
  path: string
  yearPaths?: Record<number, string>
  years: number[]
  metrics: string[]
  defaultMetric: string
  yearMetrics?: Record<number, string[]>
  yearDefaultMetric?: Record<number, string>
  tags?: string[]
  hasGeo: boolean
  hasTime: boolean
  citation?: string
  citationUrl?: string
  /** Sub-series / entity labels (e.g. nuuuwan sub_category) for catalog search */
  searchHints?: string[]
}

export interface TabularData {
  columns: string[]
  rows: unknown[][]
}

export interface MapData {
  name: string
  district: string
  value: number
  originalName?: string
  originalValue?: unknown
}

export interface DistrictData extends MapData {
  province?: string
  originalDistrict?: string
}

export interface ProvinceData {
  name: string
  district?: string
  province: string
  value: number
  originalName?: string
  originalProvince?: string
  originalValue?: unknown
}

export type AppTab = 'map' | 'plots' | 'table' | 'sources'
export type ThemeMode = 'light' | 'dark' | 'system'

export interface ColorScale {
  min: number
  max: number
  colors: string[]
}

