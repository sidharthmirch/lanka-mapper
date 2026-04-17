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

/**
 * Metadata describing a dataset sourced from the LDFLK datasets repository.
 */
export interface DatasetMetadata {
  dataset_name: string
  extracted_date: string
  row_count: number
  [key: string]: unknown
}

export interface DatasetManifestEntry {
  id: string
  name: string
  description: string
  source: 'ldflk' | 'nuuuwan'
  secondarySource?: string
  unit: string
  level: 'district' | 'province'
  path: string
  yearPaths?: Record<number, string>
  years: number[]
  metrics: string[]
  defaultMetric: string
  yearMetrics?: Record<number, string[]>
  yearDefaultMetric?: Record<number, string>
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

export type VisualizationMode = 'choropleth' | 'heatmap'
export type AppTab = 'map' | 'timeseries' | 'table'
export type ThemeMode = 'light' | 'dark' | 'system'

export interface NuuuwanSeries {
  id: string
  label: string
  source: string
  unit?: string
  frequency?: string
  values: Record<number, number>
}

export interface ColorScale {
  min: number
  max: number
  colors: string[]
}

export type HeatmapPoint = [lat: number, lng: number, intensity: number]

export interface TooltipData {
  title: string
  values: {
    label: string
    value: string | number
  }[]
}

export interface MapState {
  center: LatLngTuple
  zoom: number
  selectedDistrict: string | null
}

export interface DataState {
  currentDataset: string | null
  year: number
  loading: boolean
  error: string | null
}

export interface UIState {
  sidebarOpen: boolean
  visualizationMode: VisualizationMode
}

export interface DatasetConfig {
  id: string
  name: string
  description: string
  years: number[]
  geographicLevel: 'district' | 'province' | 'place'
}

export interface MapConfig {
  center: LatLngTuple
  zoom: number
  minZoom: number
  maxZoom: number
}
