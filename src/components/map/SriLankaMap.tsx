import { useEffect, useMemo, useRef, useState } from 'react'
import { CircleMarker, GeoJSON, MapContainer, ZoomControl, useMap } from 'react-leaflet'
import type { Feature, FeatureCollection, Geometry, MultiPolygon, Polygon } from 'geojson'
import L from 'leaflet'
import type { Layer, LeafletMouseEvent, PathOptions, StyleFunction } from 'leaflet'
import type { MutableRefObject } from 'react'
import { centerOfMass } from '@turf/turf'
import type { ColorScale, MapAdminLevel, MapData } from '@/types'
import { applyGeoJsonStyle } from '@/lib/geoJsonStyleSync'
import { formatMetricValue } from '@/lib/formatDataValue'
import { DEFAULT_ACCENT_ID, getAccentPreset } from '@/lib/uiThemePresets'
import { PROVINCE_TO_DISTRICTS } from '@/lib/mapInterpolation'
import MapDataLayers from './MapDataLayers'
import FilterCenterFocusIcon from '@mui/icons-material/FilterCenterFocus'

interface SriLankaMapProps {
  data: MapData[]
  datasetLevel: 'district' | 'province' | 'national' | null
  /** Boundary granularity to paint at — province / district / city (LG areas). */
  renderLevel: MapAdminLevel
  selectedDistrict: string | null
  selectedProvince: string | null
  onDistrictSelect: (district: string) => void
  onProvinceSelect: (province: string) => void
  colorScale: ColorScale
  showTooltips: boolean
  showChoropleth: boolean
  showCentroids: boolean
  /** Optional data overlays. */
  showRivers: boolean
  showPlants: boolean
  showGrid: boolean
  showBasins: boolean
  /** Warm dark theme variant for the basemap tiles and polygon strokes. */
  isDarkMode: boolean
  /** Dataset unit label (e.g. LKR, %) appended in tooltips. */
  unit: string | null
  /** Shell layout (sidebar) — toggling must trigger Leaflet size invalidation. */
  sidebarOpen: boolean
  /** Theme accent (Leaflet stroke/fill cannot use CSS variables reliably). */
  accentColor?: string
  /**
   * Map playback is driving `data` via per-frame interpolation. When true,
   * hover tooltips round the numeric value before formatting so the readout
   * counts in whole-integer steps instead of flickering fractional digits —
   * matches the roundWhileActive policy in legend + rankings.
   */
  mapPlaybackActive?: boolean
}

/** Generic boundary feature; the property set depends on the level. */
interface RegionProperties {
  name?: string
  /** City (LG) features carry their parent district + province for inheritance. */
  district?: string
  province?: string
}

type RegionFeature = Feature<Geometry, RegionProperties>

const SRI_LANKA_CENTER: [number, number] = [7.8731, 80.7718]
const DEFAULT_ZOOM = 8
/** Keep the map focused on the island instead of exposing the surrounding world. */
const SRI_LANKA_BOUNDS: L.LatLngBoundsExpression = [[5.75, 79.35], [10.1, 82.2]]
const SRI_LANKA_FIT_BOUNDS: L.LatLngBoundsExpression = [[5.88, 79.52], [9.98, 82.02]]
const PUBLIC_BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? ''

function getColorForValue(value: number, scale: ColorScale): string {
  const { min, max, colors } = scale
  if (max === min) return colors[0]

  // Clamp to [0, 1] so values outside the current scale (e.g. a stale scale
  // after a metric switch, or values below `min`) can't produce a negative
  // or out-of-range index into `colors`.
  const raw = (value - min) / (max - min)
  const normalized = Math.max(0, Math.min(1, raw))
  const index = Math.min(Math.floor(normalized * colors.length), colors.length - 1)
  return colors[index]
}

function getNormalizedValue(value: number, scale: ColorScale): number {
  const { min, max } = scale
  if (max === min) {
    return value > 0 ? 1 : 0
  }

  return Math.max(0, Math.min(1, (value - min) / (max - min)))
}

/** Hover shading uses theme accent; Leaflet needs hex + fillOpacity (not CSS vars). */
function accentHoverStyle(accentColor: string, showChoropleth: boolean): Pick<PathOptions, 'fillColor' | 'fillOpacity'> {
  if (showChoropleth) {
    return { fillColor: accentColor, fillOpacity: 0.48 }
  }
  return { fillColor: accentColor, fillOpacity: 0.2 }
}

function isPolygonGeometry(geometry: Geometry): geometry is Polygon | MultiPolygon {
  return geometry.type === 'Polygon' || geometry.type === 'MultiPolygon'
}

/**
 * Area-weighted centroid via turf.centerOfMass — handles MultiPolygon
 * correctly and is not biased by dense coastline vertices the way a
 * naive vertex-average is. Returns [lat, lng] (Leaflet order).
 */
function getCentroid(feature: Feature<Polygon | MultiPolygon, RegionProperties>): [number, number] {
  const point = centerOfMass(feature)
  const [lng, lat] = point.geometry.coordinates
  return [lat, lng]
}

interface DistrictPointDatum {
  districtName: string
  value: number
  normalized: number
  centroid: [number, number]
}

interface HoverTooltipState {
  /** Marker hover vs polygon. */
  centroid: boolean
  provinceName: string | null
  districtName: string | null
  cityName: string | null
  /** One level down: districts within a hovered province, or cities within a hovered district. */
  breakdown: { label: string; items: string[] } | null
  formattedValue: string | null
  x: number
  y: number
}

/** Reserved width/height for floating tooltip clamp vs map container. */
const TOOLTIP_MAX_W = 230
const TOOLTIP_MAX_H = 150

const DISTRICT_TO_PROVINCE: Record<string, string> = {
  Colombo: 'Western Province',
  Gampaha: 'Western Province',
  Kalutara: 'Western Province',
  Kandy: 'Central Province',
  Matale: 'Central Province',
  'Nuwara Eliya': 'Central Province',
  Galle: 'Southern Province',
  Matara: 'Southern Province',
  Hambantota: 'Southern Province',
  Jaffna: 'Northern Province',
  Kilinochchi: 'Northern Province',
  Mannar: 'Northern Province',
  Vavuniya: 'Northern Province',
  Mullaitivu: 'Northern Province',
  Batticaloa: 'Eastern Province',
  Ampara: 'Eastern Province',
  Trincomalee: 'Eastern Province',
  Kurunegala: 'North Western Province',
  Puttalam: 'North Western Province',
  Anuradhapura: 'North Central Province',
  Polonnaruwa: 'North Central Province',
  Badulla: 'Uva Province',
  Moneragala: 'Uva Province',
  Ratnapura: 'Sabaragamuwa Province',
  Kegalle: 'Sabaragamuwa Province',
}

/**
 * Handles the edge-province hover reset problem: when the mouse leaves the map container
 * entirely (e.g. over a coastal/edge district), the feature-level mouseout may never fire.
 * This component listens on the DOM container's `mouseleave` event and resets all styles.
 */
interface MapEdgeResetProps {
  geoJsonRef: MutableRefObject<L.GeoJSON | null>
  lastHoveredRef: MutableRefObject<L.Layer | null>
  onClearTooltip: () => void
}

/**
 * Leaflet measures its container once; when the app shell resizes (e.g. sidebar
 * expand/collapse), tiles can leave a blank strip until `invalidateSize()` runs.
 * ResizeObserver catches layout changes; timed invalidates cover Framer Motion springs.
 */
function MapLayoutInvalidate({ layoutEpoch }: { layoutEpoch: boolean }) {
  const map = useMap()
  const zoomingRef = useRef(false)

  useEffect(() => {
    const refresh = () => {
      if (!zoomingRef.current) map.invalidateSize({ animate: false, pan: false })
    }
    const frame = requestAnimationFrame(refresh)
    const settle = window.setTimeout(refresh, 360)
    return () => {
      cancelAnimationFrame(frame)
      clearTimeout(settle)
    }
  }, [layoutEpoch, map, zoomingRef])

  useEffect(() => {
    const container = map.getContainer()
    const el = container.parentElement
    if (!el) return
    let frame = 0
    const ro = new ResizeObserver(() => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        if (!zoomingRef.current) map.invalidateSize({ animate: false, pan: false })
      })
    })
    ro.observe(el)
    return () => {
      cancelAnimationFrame(frame)
      ro.disconnect()
    }
  }, [map, zoomingRef])

  useEffect(() => {
    const onZoomStart = () => { zoomingRef.current = true }
    const onZoomEnd = () => { zoomingRef.current = false }
    map.on('zoomstart', onZoomStart)
    map.on('zoomend', onZoomEnd)
    return () => {
      map.off('zoomstart', onZoomStart)
      map.off('zoomend', onZoomEnd)
    }
  }, [map])

  return null
}

/** Fit the island once after Leaflet has measured its final container. */
function SriLankaViewport() {
  const map = useMap()

  useEffect(() => {
    // Leave room for the persistent bottom timeline so it never covers the
    // southern coastline on a short or wide map panel.
    map.fitBounds(SRI_LANKA_FIT_BOUNDS, {
      animate: false,
      paddingTopLeft: [20, 20],
      paddingBottomRight: [20, 150],
    })
  }, [map])

  return null
}

function MapEdgeReset({ geoJsonRef, lastHoveredRef, onClearTooltip }: MapEdgeResetProps) {
  const map = useMap()

  useEffect(() => {
    const container = map.getContainer()

    const handleMouseLeave = () => {
      if (lastHoveredRef.current && geoJsonRef.current) {
        try {
          geoJsonRef.current.resetStyle(lastHoveredRef.current as L.Path)
        } catch {
          // layer may have been removed; safe to ignore
        }
        // eslint-disable-next-line no-param-reassign
        lastHoveredRef.current = null
      }
      onClearTooltip()
    }

    container.addEventListener('mouseleave', handleMouseLeave)
    return () => container.removeEventListener('mouseleave', handleMouseLeave)
  }, [map, geoJsonRef, lastHoveredRef, onClearTooltip])

  return null
}

export default function SriLankaMap({
  data,
  datasetLevel,
  renderLevel,
  selectedDistrict,
  selectedProvince,
  onDistrictSelect,
  onProvinceSelect,
  colorScale,
  showTooltips,
  showChoropleth,
  showCentroids,
  showRivers,
  showPlants,
  showGrid,
  showBasins,
  isDarkMode,
  unit,
  sidebarOpen,
  accentColor: accentColorProp,
  mapPlaybackActive = false,
}: SriLankaMapProps) {
  const accentColor = accentColorProp ?? getAccentPreset(DEFAULT_ACCENT_ID).main
  /**
   * Region-shading ramp is authored dim→luminous for the dark desk. In the
   * light register it's reversed (high = dark) so high values stay high-contrast
   * on cream. Normalization (min/max) is unaffected — only the color lookup flips.
   */
  const rampScale = useMemo(
    () => (isDarkMode ? colorScale : { ...colorScale, colors: [...colorScale.colors].reverse() }),
    [colorScale, isDarkMode],
  )
  /**
   * Tooltip formatter — matches the integer-during-play / exact-on-settle policy
   * used by MapColorLegend and RankingsChart. Reference is stable inside the
   * event handler closure via the prop read on each render; handlers are rebuilt
   * per render so the latest `mapPlaybackActive` is always in scope.
   */
  const formatTooltipValue = (value: number): string | null => {
    if (!(value > 0)) return null
    const v = mapPlaybackActive ? Math.round(value) : value
    return formatMetricValue(v, unit, 'compact')
  }
  // One persistent slot per boundary level. Loading into separate states (rather
  // than overwriting a single one on every level switch) is what keeps the layer
  // from briefly painting one level's geometry under another level's value lookup
  // — react-leaflet does not re-read the `data` prop after mount, so the active
  // slot must already hold the right geometry when the keyed layer remounts.
  const [provinceGeojson, setProvinceGeojson] = useState<FeatureCollection<Geometry, RegionProperties> | null>(null)
  const [districtGeojson, setDistrictGeojson] = useState<FeatureCollection<Geometry, RegionProperties> | null>(null)
  const [cityGeojson, setCityGeojson] = useState<FeatureCollection<Geometry, RegionProperties> | null>(null)
  const [hoverTooltip, setHoverTooltip] = useState<HoverTooltipState | null>(null)
  const [mapInstance, setMapInstance] = useState<L.Map | null>(null)

  const geoJsonRef = useRef<L.GeoJSON | null>(null)
  const lastHoveredRef = useRef<L.Layer | null>(null)
  /** When set, centroid marker owns the tooltip; polygon hover must not overwrite it. */
  const centroidHoverRef = useRef<string | null>(null)

  /**
   * The choropleth GeoJSON layer is intentionally NOT remounted on every
   * playback frame (key only changes on shape-affecting state — see
   * `geoJsonKey` below). That means `onEachFeature` captures its closure
   * exactly once per mount, so hover handlers must read fresh data /
   * color scale / accent through refs rather than captured variables.
   */
  const districtDataMapRef = useRef(new Map<string, number>())
  const provinceDataMapRef = useRef(new Map<string, number>())
  const accentColorRef = useRef(accentColor)
  const showTooltipsRef = useRef(showTooltips)
  const showChoroplethRef = useRef(showChoropleth)
  const formatTooltipValueRef = useRef<(value: number) => string | null>(() => null)

  const isProvinceData = datasetLevel === 'province'

  useEffect(() => {
    if (!showTooltips) {
      centroidHoverRef.current = null
      setHoverTooltip(null)
    }
  }, [showTooltips])

  // Each boundary geojson loads the first time it's needed and is then kept.
  // Province outlines: only when painting provinces.
  useEffect(() => {
    if (renderLevel !== 'province' || provinceGeojson) return
    let cancelled = false
    void fetch(`${PUBLIC_BASE_PATH}/data/sri-lanka-provinces.geojson`)
      .then((res) => res.json() as Promise<FeatureCollection<Geometry, RegionProperties>>)
      .then((collection) => { if (!cancelled) setProvinceGeojson(collection) })
      .catch(() => undefined)
    return () => { cancelled = true }
  }, [renderLevel, provinceGeojson])

  // District outlines: when painting districts or for the centroid markers.
  useEffect(() => {
    if (!(renderLevel === 'district' || showCentroids) || districtGeojson) return
    let cancelled = false
    void fetch(`${PUBLIC_BASE_PATH}/data/sri-lanka-districts.geojson`)
      .then((res) => res.json() as Promise<FeatureCollection<Geometry, RegionProperties>>)
      .then((collection) => { if (!cancelled) setDistrictGeojson(collection) })
      .catch(() => undefined)
    return () => { cancelled = true }
  }, [renderLevel, showCentroids, districtGeojson])

  // City outlines: painting cities, or the district→cities hover breakdown
  // (loaded once for any mappable level so district hover can list its towns).
  useEffect(() => {
    if (cityGeojson) return
    let cancelled = false
    void fetch(`${PUBLIC_BASE_PATH}/data/sri-lanka-cities.geojson`)
      .then((res) => res.json() as Promise<FeatureCollection<Geometry, RegionProperties>>)
      .then((collection) => { if (!cancelled) setCityGeojson(collection) })
      .catch(() => undefined)
    return () => { cancelled = true }
  }, [renderLevel, cityGeojson])

  const activeChoroplethGeojson = renderLevel === 'province'
    ? provinceGeojson
    : renderLevel === 'district'
      ? districtGeojson
      : cityGeojson
  /** District outlines back the centroid markers; cities back the breakdown. */
  const districtFeatureSource = districtGeojson
  const cityFeatureSource = cityGeojson

  const districtDataMap = useMemo(() => {
    const map = new Map<string, number>()
    data.forEach((row) => {
      map.set(row.name.toLowerCase(), row.value)
    })
    return map
  }, [data])

  const provinceDataMap = useMemo(() => {
    const map = new Map<string, number>()
    if (!isProvinceData) return map
    for (const row of data) {
      const provinceLabel =
        typeof row.originalName === 'string' && row.originalName
          ? row.originalName
          : DISTRICT_TO_PROVINCE[row.name]
      if (provinceLabel) {
        map.set(provinceLabel.toLowerCase(), row.value)
      }
    }
    return map
  }, [data, isProvinceData])

  /** district (lowercased) → constituent city names, for the district-hover breakdown. */
  const citiesByDistrict = useMemo(() => {
    const map = new Map<string, string[]>()
    if (!cityFeatureSource) return map
    for (const feature of cityFeatureSource.features) {
      const district = feature.properties?.district
      const name = feature.properties?.name
      if (!district || !name) continue
      const key = district.toLowerCase()
      const list = map.get(key)
      if (list) list.push(name)
      else map.set(key, [name])
    }
    map.forEach((list) => list.sort((a, b) => a.localeCompare(b)))
    return map
  }, [cityFeatureSource])

  // Keep refs in sync so GeoJSON event handlers (attached once per layer
  // mount via onEachFeature) always read current values without needing
  // the entire GeoJSON layer to remount.
  useEffect(() => {
    districtDataMapRef.current = districtDataMap
  }, [districtDataMap])
  useEffect(() => {
    provinceDataMapRef.current = provinceDataMap
  }, [provinceDataMap])
  useEffect(() => {
    accentColorRef.current = accentColor
  }, [accentColor])
  useEffect(() => {
    showTooltipsRef.current = showTooltips
  }, [showTooltips])
  useEffect(() => {
    showChoroplethRef.current = showChoropleth
  }, [showChoropleth])
  useEffect(() => {
    formatTooltipValueRef.current = formatTooltipValue
  })

  /** A feature's value: province lookup, or parent-district lookup for cities. */
  const valueForProps = (props: RegionProperties | undefined): number => {
    if (renderLevel === 'province') {
      return provinceDataMapRef.current.get((props?.name ?? '').toLowerCase()) ?? 0
    }
    if (renderLevel === 'city') {
      return districtDataMapRef.current.get((props?.district ?? '').toLowerCase()) ?? 0
    }
    return districtDataMapRef.current.get((props?.name ?? '').toLowerCase()) ?? 0
  }

  const districtPoints = useMemo<DistrictPointDatum[]>(() => {
    if (!districtFeatureSource || !showCentroids) {
      return []
    }

    return districtFeatureSource.features.flatMap((feature) => {
      const { geometry } = feature

      if (!isPolygonGeometry(geometry)) {
        return []
      }

      const polygonFeature: Feature<Polygon | MultiPolygon, RegionProperties> = {
        ...feature,
        geometry,
      }

      const districtName = feature.properties?.name ?? ''
      const value = districtDataMap.get(districtName.toLowerCase()) ?? 0

      if (value <= 0) {
        return []
      }

      return [{
        districtName,
        value,
        normalized: getNormalizedValue(value, colorScale),
        centroid: getCentroid(polygonFeature),
      }]
    })
  }, [colorScale, districtDataMap, districtFeatureSource, showCentroids])

  const polygonStyle = useMemo(() => {
    const noDataFill = isDarkMode ? '#1b211d' : '#ece5d8'
    const noDataStroke = isDarkMode ? '#3a423a' : '#cfc5b2'
    const sepStroke = isDarkMode ? '#0f1311' : '#fdfbf6'
    const valueFor = (props: RegionProperties): number => {
      if (renderLevel === 'province') return provinceDataMap.get((props.name ?? '').toLowerCase()) ?? 0
      if (renderLevel === 'city') return districtDataMap.get((props.district ?? '').toLowerCase()) ?? 0
      return districtDataMap.get((props.name ?? '').toLowerCase()) ?? 0
    }
    const isSelectedFor = (props: RegionProperties): boolean => {
      if (renderLevel === 'province') return selectedProvince?.toLowerCase() === (props.name ?? '').toLowerCase()
      if (renderLevel === 'city') return Boolean(selectedDistrict) && selectedDistrict?.toLowerCase() === (props.district ?? '').toLowerCase()
      return selectedDistrict?.toLowerCase() === (props.name ?? '').toLowerCase()
    }
    // Cities are small and numerous — a hairline keeps them legible without choking the fill.
    const baseWeight = renderLevel === 'city' ? 0.6 : 1
    return (feature: RegionFeature | undefined): PathOptions => {
      if (!feature) {
        return { fillColor: noDataFill, fillOpacity: 0.5, color: noDataStroke, weight: baseWeight }
      }
      const props = feature.properties ?? {}
      const value = valueFor(props)
      const isSelected = isSelectedFor(props)

      if (!showChoropleth) {
        return {
          fillColor: 'transparent',
          fillOpacity: 0,
          color: isSelected ? accentColor : noDataStroke,
          weight: isSelected ? 2 : baseWeight,
          opacity: isSelected ? 0.95 : 0.7,
        }
      }

      return {
        fillColor: value > 0 ? getColorForValue(value, rampScale) : noDataFill,
        fillOpacity: isSelected ? 0.92 : 0.82,
        color: isSelected ? accentColor : sepStroke,
        weight: isSelected ? 2.5 : baseWeight,
      }
    }
  }, [accentColor, rampScale, districtDataMap, provinceDataMap, renderLevel, isDarkMode, selectedDistrict, selectedProvince, showChoropleth])

  const clearTooltip = () => {
    centroidHoverRef.current = null
    setHoverTooltip(null)
  }

  /** Province / district / city labels for a feature at the active level. */
  const labelsForProps = (props: RegionProperties): { province: string | null; district: string | null; city: string | null } => {
    if (renderLevel === 'province') {
      return { province: props.name ?? null, district: null, city: null }
    }
    if (renderLevel === 'city') {
      return { province: props.province ?? null, district: props.district ?? null, city: props.name ?? null }
    }
    const district = props.name ?? null
    return { province: district ? DISTRICT_TO_PROVINCE[district] ?? null : null, district, city: null }
  }

  const clampPoint = (event: LeafletMouseEvent): { x: number; y: number } => {
    const mapSize = event.target._map?.getSize()
    return {
      x: mapSize ? Math.min(event.containerPoint.x, Math.max(0, mapSize.x - TOOLTIP_MAX_W)) : event.containerPoint.x,
      y: mapSize ? Math.min(event.containerPoint.y, Math.max(0, mapSize.y - TOOLTIP_MAX_H)) : event.containerPoint.y,
    }
  }

  const onEachRegionFeature = (feature: RegionFeature, layer: Layer) => {
    const props = feature.properties ?? {}
    const labels = labelsForProps(props)
    /** Stable identity for this feature, so mouseout only clears its own tooltip. */
    const featureKey = `${labels.province ?? ''}|${labels.district ?? ''}|${labels.city ?? ''}`

    const selectRegion = () => {
      if (renderLevel === 'province') {
        if (labels.province) onProvinceSelect(labels.province)
      } else if (labels.district) {
        onDistrictSelect(labels.district)
      }
    }

    layer.on({
      click: (e: LeafletMouseEvent) => {
        L.DomEvent.stopPropagation(e)
        selectRegion()
      },
      mouseover: (event: LeafletMouseEvent) => {
        const target = event.target as L.Path

        if (lastHoveredRef.current && lastHoveredRef.current !== target && geoJsonRef.current) {
          try {
            geoJsonRef.current.resetStyle(lastHoveredRef.current as L.Path)
          } catch {
            // safe to ignore if layer was removed
          }
        }
        lastHoveredRef.current = target

        const currentAccent = accentColorRef.current
        target.setStyle({
          weight: 2.5,
          color: currentAccent,
          ...accentHoverStyle(currentAccent, showChoroplethRef.current),
        })
        target.bringToFront()

        if (showTooltipsRef.current && !centroidHoverRef.current) {
          const value = valueForProps(props)
          const { x, y } = clampPoint(event)
          // One level down: a province lists its districts; a district lists its cities.
          let breakdown: { label: string; items: string[] } | null = null
          if (renderLevel === 'province' && labels.province) {
            const districts = PROVINCE_TO_DISTRICTS[labels.province] ?? []
            if (districts.length) breakdown = { label: 'Districts', items: districts }
          } else if (renderLevel === 'district' && labels.district) {
            const cities = citiesByDistrict.get(labels.district.toLowerCase()) ?? []
            if (cities.length) breakdown = { label: 'Cities', items: cities }
          }
          setHoverTooltip({
            centroid: false,
            provinceName: labels.province,
            districtName: labels.district,
            cityName: labels.city,
            breakdown,
            formattedValue: formatTooltipValueRef.current(value),
            x,
            y,
          })
        }
      },
      mousemove: (event: LeafletMouseEvent) => {
        if (!showTooltipsRef.current) return
        setHoverTooltip((prev) => {
          if (!prev || prev.centroid) return prev
          const prevKey = `${prev.provinceName ?? ''}|${prev.districtName ?? ''}|${prev.cityName ?? ''}`
          if (prevKey !== featureKey) return prev
          return { ...prev, ...clampPoint(event) }
        })
      },
      mouseout: (event: LeafletMouseEvent) => {
        const target = event.target as L.Path
        if (geoJsonRef.current) {
          geoJsonRef.current.resetStyle(target)
        }
        if (lastHoveredRef.current === target) {
          lastHoveredRef.current = null
        }
        setHoverTooltip((prev) => {
          if (!prev || prev.centroid) return prev
          const prevKey = `${prev.provinceName ?? ''}|${prev.districtName ?? ''}|${prev.cityName ?? ''}`
          return prevKey === featureKey ? null : prev
        })
      },
    })
  }

  /**
   * Only remount the GeoJSON layer when the layer *shape* changes (paint level,
   * choropleth/tooltips on/off, base theme). Per-frame value updates during
   * playback flow through `setStyle()` in the effect below, avoiding a full
   * teardown + recreate (with all event handlers) every ~80ms.
   */
  const geoJsonKey = `${renderLevel}-${showTooltips}-${showChoropleth}-${isDarkMode ? 'dark' : 'light'}`

  useEffect(() => {
    const layer = geoJsonRef.current
    if (!layer) return
    const styleFn = polygonStyle as unknown as StyleFunction
    applyGeoJsonStyle(layer, styleFn)
  }, [polygonStyle, data, colorScale, accentColor, selectedDistrict, selectedProvince])

  return (
    <div className="relative h-full w-full">
      <MapContainer
        center={SRI_LANKA_CENTER}
        zoom={DEFAULT_ZOOM}
        // A lower floor lets the full coastline remain visible in short or
        // portrait panels; maxBounds still prevents navigation beyond Sri Lanka.
        minZoom={6}
        maxZoom={14}
        maxBounds={SRI_LANKA_BOUNDS}
        maxBoundsViscosity={1}
        zoomControl={false}
        attributionControl={false}
        worldCopyJump={false}
        zoomAnimation={false}
        fadeAnimation={false}
        markerZoomAnimation={false}
        /* Canvas renderer: the whole choropleth paints to one canvas instead of
           ~25 SVG <path>s, so pan/zoom no longer repaints every polygon (the
           source of the jerky feel). Hover setStyle still works on canvas. */
        preferCanvas
        /* Half-step zoom + a less twitchy wheel make zooming feel continuous
           rather than snapping a full level per notch. */
        zoomSnap={0.5}
        zoomDelta={0.5}
        wheelPxPerZoomLevel={140}
        wheelDebounceTime={30}
        ref={setMapInstance}
        style={{ height: '100%', width: '100%' }}
        className="sri-lanka-map rounded-lg"
      >
        <ZoomControl position="bottomright" />
        <MapLayoutInvalidate layoutEpoch={sidebarOpen} />
        <SriLankaViewport />

        {activeChoroplethGeojson && (
          <GeoJSON
            key={geoJsonKey}
            data={activeChoroplethGeojson}
            style={polygonStyle as (f: Feature<Geometry, Record<string, unknown>> | undefined) => PathOptions}
            onEachFeature={onEachRegionFeature as (f: Feature<Geometry, Record<string, unknown>>, l: Layer) => void}
            ref={(ref) => { geoJsonRef.current = ref }}
          />
        )}

        <MapEdgeReset
          geoJsonRef={geoJsonRef}
          lastHoveredRef={lastHoveredRef}
          onClearTooltip={clearTooltip}
        />

        <MapDataLayers
          showRivers={showRivers}
          showPlants={showPlants}
          showGrid={showGrid}
          showBasins={showBasins}
          isDark={isDarkMode}
        />

        {showCentroids && districtPoints.map(({ centroid, districtName, normalized, value }) => {
          const provinceName = DISTRICT_TO_PROVINCE[districtName] ?? 'Unknown Province'
          const isSelected = isProvinceData
            ? selectedProvince?.toLowerCase() === provinceName.toLowerCase()
            : selectedDistrict?.toLowerCase() === districtName.toLowerCase()

          return (
            <CircleMarker
              key={`point-${districtName}`}
              center={centroid}
              /** Above overlayPane GeoJSON so province `bringToFront()` does not block centroid hit-testing. */
              pane="markerPane"
              radius={Math.max(6, Math.min(32, (normalized * 26) + 6))}
              pathOptions={{
                color: isSelected ? accentColor : '#fdfbf6',
                weight: isSelected ? 3 : 1.5,
                fillColor: getColorForValue(value, rampScale),
                fillOpacity: 0.85,
              }}
              eventHandlers={{
                click: () => {
                  if (isProvinceData) {
                    onProvinceSelect(provinceName)
                  } else {
                    onDistrictSelect(districtName)
                  }
                },
                mouseover: (e: LeafletMouseEvent) => {
                  centroidHoverRef.current = districtName
                  if (!showTooltips) {
                    return
                  }
                  const valueAtPoint = districtDataMap.get(districtName.toLowerCase()) ?? 0
                  const mapSize = e.target._map?.getSize()
                  const nextX = mapSize ? Math.min(e.containerPoint.x, Math.max(0, mapSize.x - TOOLTIP_MAX_W)) : e.containerPoint.x
                  const nextY = mapSize ? Math.min(e.containerPoint.y, Math.max(0, mapSize.y - TOOLTIP_MAX_H)) : e.containerPoint.y
                  setHoverTooltip({
                    centroid: true,
                    provinceName,
                    districtName,
                    cityName: null,
                    breakdown: null,
                    formattedValue: formatTooltipValue(valueAtPoint),
                    x: nextX,
                    y: nextY,
                  })
                },
                mousemove: (e: LeafletMouseEvent) => {
                  if (!showTooltips) {
                    return
                  }
                  setHoverTooltip((prev) => {
                    if (!prev || prev.districtName !== districtName || !prev.centroid) {
                      return prev
                    }
                    const mapSize = e.target._map?.getSize()
                    return {
                      ...prev,
                      x: mapSize ? Math.min(e.containerPoint.x, Math.max(0, mapSize.x - TOOLTIP_MAX_W)) : e.containerPoint.x,
                      y: mapSize ? Math.min(e.containerPoint.y, Math.max(0, mapSize.y - TOOLTIP_MAX_H)) : e.containerPoint.y,
                    }
                  })
                },
                mouseout: () => {
                  centroidHoverRef.current = null
                  setHoverTooltip((prev) => (prev?.districtName === districtName && prev.centroid ? null : prev))
                },
              }}
            />
          )
        })}
      </MapContainer>

      {mapInstance && (
        <button
          type="button"
          onClick={() => mapInstance.setView(SRI_LANKA_CENTER, DEFAULT_ZOOM, { animate: true })}
          aria-label="Recenter map on Sri Lanka"
          title="Recenter"
          className="absolute right-3 top-3 z-[800] flex h-9 w-9 items-center justify-center rounded-md border border-[var(--border-2)] bg-[var(--surface)] text-[var(--ink-2)] shadow-[var(--shadow-md)] transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)] lg:top-auto lg:bottom-20"
        >
          <FilterCenterFocusIcon sx={{ fontSize: 18 }} />
        </button>
      )}

      {showTooltips && hoverTooltip && (
        <div
          className="pointer-events-none absolute z-[1200] max-w-[min(320px,calc(100vw-32px))] overflow-hidden rounded-lg border px-3 py-2 shadow-md"
          style={{
            left: hoverTooltip.x + 14,
            top: hoverTooltip.y + 12,
            borderColor: 'var(--outline)',
            background: 'var(--surface)',
            color: 'var(--on-surface)',
            ...(hoverTooltip.centroid
              ? { boxShadow: 'var(--shadow-md)' }
              : {}),
          }}
        >
          {hoverTooltip.centroid && (
            <div className="term-label mb-1" style={{ color: 'var(--accent)' }}>
              Centroid
            </div>
          )}
          {hoverTooltip.cityName && (
            <>
              <div className="term-label">City</div>
              <div className="mt-0.5 text-[13px] font-semibold break-words line-clamp-2">{hoverTooltip.cityName}</div>
            </>
          )}
          {hoverTooltip.provinceName && (
            <>
              <div className={`term-label ${hoverTooltip.cityName ? 'mt-1.5' : ''}`}>Province</div>
              <div className="mt-0.5 text-[13px] font-semibold break-words line-clamp-2">{hoverTooltip.provinceName}</div>
            </>
          )}
          {hoverTooltip.districtName && (
            <>
              <div className="term-label mt-1.5">District</div>
              <div className="mt-0.5 text-[13px] font-semibold break-words line-clamp-2">{hoverTooltip.districtName}</div>
            </>
          )}
          {hoverTooltip.formattedValue ? (
            <>
              <div className="term-label mt-1.5">Value</div>
              <div className="mono mt-0.5 break-words text-[15px] font-bold text-[var(--accent)]">{hoverTooltip.formattedValue}</div>
            </>
          ) : (
            <div className="mt-1 text-[12px] italic text-[var(--ink-3)]">No data available</div>
          )}
          {hoverTooltip.breakdown && hoverTooltip.breakdown.items.length > 0 && (
            <>
              <div className="term-label mt-1.5">{hoverTooltip.breakdown.label} ({hoverTooltip.breakdown.items.length})</div>
              <div className="mt-0.5 text-[11px] leading-snug text-[var(--ink-2)] line-clamp-3">
                {hoverTooltip.breakdown.items.slice(0, 14).join(', ')}{hoverTooltip.breakdown.items.length > 14 ? '…' : ''}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
