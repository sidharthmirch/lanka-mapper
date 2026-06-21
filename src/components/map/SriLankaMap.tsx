import { useEffect, useMemo, useRef, useState } from 'react'
import { CircleMarker, GeoJSON, MapContainer, TileLayer, ZoomControl, useMap } from 'react-leaflet'
import type { Feature, FeatureCollection, Geometry, MultiPolygon, Polygon } from 'geojson'
import L from 'leaflet'
import type { Layer, LeafletMouseEvent, PathOptions, StyleFunction } from 'leaflet'
import type { MutableRefObject } from 'react'
import { centerOfMass } from '@turf/turf'
import type { ColorScale, MapData } from '@/types'
import { applyGeoJsonStyle } from '@/lib/geoJsonStyleSync'
import { formatMetricValue } from '@/lib/formatDataValue'
import { DEFAULT_ACCENT_ID, getAccentPreset } from '@/lib/uiThemePresets'

interface SriLankaMapProps {
  data: MapData[]
  datasetLevel: 'district' | 'province' | 'national' | null
  selectedDistrict: string | null
  selectedProvince: string | null
  onDistrictSelect: (district: string) => void
  onProvinceSelect: (province: string) => void
  colorScale: ColorScale
  showTooltips: boolean
  showChoropleth: boolean
  showCentroids: boolean
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

interface DistrictProperties {
  name?: string
}

interface ProvinceProperties {
  name?: string
}

type DistrictFeature = Feature<Geometry, DistrictProperties>
type ProvinceFeature = Feature<Geometry, ProvinceProperties>

const SRI_LANKA_CENTER: [number, number] = [7.8731, 80.7718]
const DEFAULT_ZOOM = 8
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
function getCentroid(feature: Feature<Polygon | MultiPolygon, DistrictProperties>): [number, number] {
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
  provinceName: string
  /** Shown when district-level map, or centroid on provincial dataset. */
  districtName: string | null
  formattedValue: string | null
  x: number
  y: number
}

/** Reserved width/height for floating tooltip clamp vs map container. */
const TOOLTIP_MAX_W = 230
const TOOLTIP_MAX_H = 110

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

/** District row: district choropleth always; provincial only when centroids on and pointer is on a centroid marker. */
function showDistrictInTooltip(
  datasetLevel: SriLankaMapProps['datasetLevel'],
  showCentroids: boolean,
  state: HoverTooltipState,
): boolean {
  if (state.centroid) {
    if (datasetLevel === 'province') {
      return showCentroids
    }
    return datasetLevel === 'district'
  }
  return datasetLevel === 'district'
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

  useEffect(() => {
    const refresh = () => {
      map.invalidateSize({ animate: false })
    }
    refresh()
    let innerRaf = 0
    const outerRaf = requestAnimationFrame(() => {
      innerRaf = requestAnimationFrame(refresh)
    })
    const timeouts = [60, 180, 360, 520].map((ms) => window.setTimeout(refresh, ms))
    return () => {
      cancelAnimationFrame(outerRaf)
      cancelAnimationFrame(innerRaf)
      timeouts.forEach(clearTimeout)
    }
  }, [layoutEpoch, map])

  useEffect(() => {
    const container = map.getContainer()
    const el = container.parentElement
    if (!el) return
    const ro = new ResizeObserver(() => {
      map.invalidateSize({ animate: false })
    })
    ro.observe(el)
    return () => ro.disconnect()
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
  selectedDistrict,
  selectedProvince,
  onDistrictSelect,
  onProvinceSelect,
  colorScale,
  showTooltips,
  showChoropleth,
  showCentroids,
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
  const [districtGeojson, setDistrictGeojson] = useState<FeatureCollection<Geometry, DistrictProperties> | null>(null)
  const [provinceGeojson, setProvinceGeojson] = useState<FeatureCollection<Geometry, ProvinceProperties> | null>(null)
  const [hoverTooltip, setHoverTooltip] = useState<HoverTooltipState | null>(null)

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

  const isProvinceMap = datasetLevel === 'province'
  /** District outlines: all non-provincial choropleth modes, or provincial + centroids overlay. */
  const needDistrictBoundaries = !isProvinceMap || showCentroids

  useEffect(() => {
    if (!showTooltips) {
      centroidHoverRef.current = null
      setHoverTooltip(null)
    }
  }, [showTooltips])

  useEffect(() => {
    if (!isProvinceMap) {
      setProvinceGeojson(null)
      return
    }
    let cancelled = false
    void fetch(`${PUBLIC_BASE_PATH}/data/sri-lanka-provinces.geojson`)
      .then((res) => res.json() as Promise<FeatureCollection<Geometry, ProvinceProperties>>)
      .then((collection) => {
        if (!cancelled) setProvinceGeojson(collection)
      })
      .catch(() => {
        if (!cancelled) setProvinceGeojson(null)
      })
    return () => {
      cancelled = true
    }
  }, [isProvinceMap])

  useEffect(() => {
    if (!needDistrictBoundaries) {
      setDistrictGeojson(null)
      return
    }
    let cancelled = false
    void fetch(`${PUBLIC_BASE_PATH}/data/sri-lanka-districts.geojson`)
      .then((res) => res.json() as Promise<FeatureCollection<Geometry, DistrictProperties>>)
      .then((collection) => {
        if (!cancelled) setDistrictGeojson(collection)
      })
      .catch(() => {
        if (!cancelled) setDistrictGeojson(null)
      })
    return () => {
      cancelled = true
    }
  }, [needDistrictBoundaries])

  const districtDataMap = useMemo(() => {
    const map = new Map<string, number>()
    data.forEach((row) => {
      map.set(row.name.toLowerCase(), row.value)
    })
    return map
  }, [data])

  const provinceDataMap = useMemo(() => {
    const map = new Map<string, number>()
    if (!isProvinceMap) return map
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
  }, [data, isProvinceMap])

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

  const districtPoints = useMemo<DistrictPointDatum[]>(() => {
    if (!districtGeojson || !showCentroids) {
      return []
    }

    return districtGeojson.features.flatMap((feature) => {
      const { geometry } = feature

      if (!isPolygonGeometry(geometry)) {
        return []
      }

      const polygonFeature: Feature<Polygon | MultiPolygon, DistrictProperties> = {
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
  }, [colorScale, districtDataMap, districtGeojson, showCentroids])

  const districtPolygonStyle = useMemo(() => {
    const noDataFill = isDarkMode ? '#1b211d' : '#ece5d8'
    const noDataStroke = isDarkMode ? '#3a423a' : '#cfc5b2'
    const sepStroke = isDarkMode ? '#0f1311' : '#fdfbf6'
    return (feature: DistrictFeature | undefined): PathOptions => {
      if (!feature) {
        return { fillColor: noDataFill, fillOpacity: 0.5, color: noDataStroke, weight: 1 }
      }

      const districtName = feature.properties?.name ?? ''
      const value = districtDataMap.get(districtName.toLowerCase()) ?? 0
      const isSelected = selectedDistrict?.toLowerCase() === districtName.toLowerCase()

      if (!showChoropleth) {
        return {
          fillColor: 'transparent',
          fillOpacity: 0,
          color: isSelected ? accentColor : noDataStroke,
          weight: isSelected ? 2 : 1,
          opacity: isSelected ? 0.95 : 0.7,
        }
      }

      return {
        fillColor: value > 0 ? getColorForValue(value, rampScale) : noDataFill,
        fillOpacity: isSelected ? 0.92 : 0.82,
        color: isSelected ? accentColor : sepStroke,
        weight: isSelected ? 2.5 : 1,
      }
    }
  }, [accentColor, rampScale, districtDataMap, isDarkMode, selectedDistrict, showChoropleth])

  const provincePolygonStyle = useMemo(() => {
    const noDataFill = isDarkMode ? '#1b211d' : '#ece5d8'
    const noDataStroke = isDarkMode ? '#3a423a' : '#cfc5b2'
    const sepStroke = isDarkMode ? '#0f1311' : '#fdfbf6'
    return (feature: ProvinceFeature | undefined): PathOptions => {
      if (!feature) {
        return { fillColor: noDataFill, fillOpacity: 0.5, color: noDataStroke, weight: 1 }
      }

      const provinceName = feature.properties?.name ?? ''
      const value = provinceDataMap.get(provinceName.toLowerCase()) ?? 0
      const isSelected = selectedProvince?.toLowerCase() === provinceName.toLowerCase()

      if (!showChoropleth) {
        return {
          fillColor: 'transparent',
          fillOpacity: 0,
          color: isSelected ? accentColor : noDataStroke,
          weight: isSelected ? 2 : 1,
          opacity: isSelected ? 0.95 : 0.7,
        }
      }

      return {
        fillColor: value > 0 ? getColorForValue(value, rampScale) : noDataFill,
        fillOpacity: isSelected ? 0.92 : 0.82,
        color: isSelected ? accentColor : sepStroke,
        weight: isSelected ? 2.5 : 1,
      }
    }
  }, [accentColor, rampScale, provinceDataMap, isDarkMode, selectedProvince, showChoropleth])

  const clearTooltip = () => {
    centroidHoverRef.current = null
    setHoverTooltip(null)
  }

  const onEachDistrictFeature = (feature: DistrictFeature, layer: Layer) => {
    const districtName = feature.properties?.name ?? 'Unknown'
    const provinceName = DISTRICT_TO_PROVINCE[districtName] ?? 'Unknown Province'

    layer.on({
      click: (e: LeafletMouseEvent) => {
        L.DomEvent.stopPropagation(e)
        onDistrictSelect(districtName)
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
        const currentShowChoropleth = showChoroplethRef.current
        target.setStyle({
          weight: 2.5,
          color: currentAccent,
          ...accentHoverStyle(currentAccent, currentShowChoropleth),
        })
        target.bringToFront()

        if (showTooltipsRef.current && !centroidHoverRef.current) {
          const value = districtDataMapRef.current.get(districtName.toLowerCase()) ?? 0
          const mapSize = event.target._map?.getSize()
          const nextX = mapSize ? Math.min(event.containerPoint.x, Math.max(0, mapSize.x - TOOLTIP_MAX_W)) : event.containerPoint.x
          const nextY = mapSize ? Math.min(event.containerPoint.y, Math.max(0, mapSize.y - TOOLTIP_MAX_H)) : event.containerPoint.y
          setHoverTooltip({
            centroid: false,
            provinceName,
            districtName,
            formattedValue: formatTooltipValueRef.current(value),
            x: nextX,
            y: nextY,
          })
        }
      },
      mousemove: (event: LeafletMouseEvent) => {
        if (!showTooltipsRef.current) {
          return
        }

        setHoverTooltip((prev) => {
          if (!prev || prev.districtName !== districtName || prev.centroid) {
            return prev
          }

          return {
            ...prev,
            x: event.target._map?.getSize()
              ? Math.min(event.containerPoint.x, Math.max(0, event.target._map.getSize().x - TOOLTIP_MAX_W))
              : event.containerPoint.x,
            y: event.target._map?.getSize()
              ? Math.min(event.containerPoint.y, Math.max(0, event.target._map.getSize().y - TOOLTIP_MAX_H))
              : event.containerPoint.y,
          }
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
        setHoverTooltip((prev) => (prev && !prev.centroid && prev.districtName === districtName ? null : prev))
      },
    })
  }

  const onEachProvinceFeature = (feature: ProvinceFeature, layer: Layer) => {
    const provinceName = feature.properties?.name ?? 'Unknown'

    layer.on({
      click: (e: LeafletMouseEvent) => {
        L.DomEvent.stopPropagation(e)
        onProvinceSelect(provinceName)
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
        const currentShowChoropleth = showChoroplethRef.current
        target.setStyle({
          weight: 2.5,
          color: currentAccent,
          ...accentHoverStyle(currentAccent, currentShowChoropleth),
        })
        target.bringToFront()

        if (showTooltipsRef.current && !centroidHoverRef.current) {
          const value = provinceDataMapRef.current.get(provinceName.toLowerCase()) ?? 0
          const mapSize = event.target._map?.getSize()
          const nextX = mapSize ? Math.min(event.containerPoint.x, Math.max(0, mapSize.x - TOOLTIP_MAX_W)) : event.containerPoint.x
          const nextY = mapSize ? Math.min(event.containerPoint.y, Math.max(0, mapSize.y - TOOLTIP_MAX_H)) : event.containerPoint.y
          setHoverTooltip({
            centroid: false,
            provinceName,
            districtName: null,
            formattedValue: formatTooltipValueRef.current(value),
            x: nextX,
            y: nextY,
          })
        }
      },
      mousemove: (event: LeafletMouseEvent) => {
        if (!showTooltipsRef.current) {
          return
        }

        setHoverTooltip((prev) => {
          if (!prev || prev.provinceName !== provinceName || prev.centroid) {
            return prev
          }

          return {
            ...prev,
            x: event.target._map?.getSize()
              ? Math.min(event.containerPoint.x, Math.max(0, event.target._map.getSize().x - TOOLTIP_MAX_W))
              : event.containerPoint.x,
            y: event.target._map?.getSize()
              ? Math.min(event.containerPoint.y, Math.max(0, event.target._map.getSize().y - TOOLTIP_MAX_H))
              : event.containerPoint.y,
          }
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
        setHoverTooltip((prev) => (prev && !prev.centroid && prev.provinceName === provinceName && prev.districtName === null ? null : prev))
      },
    })
  }

  const activeChoroplethGeojson = isProvinceMap ? provinceGeojson : districtGeojson
  const activeStyle = isProvinceMap ? provincePolygonStyle : districtPolygonStyle
  const activeOnEach = isProvinceMap ? onEachProvinceFeature : onEachDistrictFeature

  /**
   * Only remount the GeoJSON layer when the layer *shape* changes (province
   * vs district, choropleth/tooltips on/off, base theme). Per-frame value
   * updates during playback flow through `setStyle()` in the effect below,
   * avoiding a full teardown + recreate (with all event handlers) every ~80ms.
   */
  const geoJsonKey = `${isProvinceMap ? 'prov' : 'dist'}-${showTooltips}-${showChoropleth}-${isDarkMode ? 'dark' : 'light'}`

  useEffect(() => {
    const layer = geoJsonRef.current
    if (!layer) return
    const styleFn = activeStyle as unknown as StyleFunction
    applyGeoJsonStyle(layer, styleFn)
  }, [activeStyle, data, colorScale, accentColor, selectedDistrict, selectedProvince])

  return (
    <div className="relative h-full w-full">
      <MapContainer
        center={SRI_LANKA_CENTER}
        zoom={DEFAULT_ZOOM}
        minZoom={6}
        maxZoom={14}
        zoomControl={false}
        style={{ height: '100%', width: '100%' }}
        className="rounded-lg"
      >
        <ZoomControl position="bottomright" />
        <MapLayoutInvalidate layoutEpoch={sidebarOpen} />
        {/* Quiet, low-chroma basemap so the warm choropleth is the hero, not the
            map chrome — consistent with the artifacts hub's map surfaces. */}
        <TileLayer
          key={isDarkMode ? 'carto-dark' : 'carto-light'}
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
          url={isDarkMode
            ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
            : 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png'}
          subdomains="abcd"
          maxZoom={20}
        />

        {activeChoroplethGeojson && (
          <GeoJSON
            key={geoJsonKey}
            data={activeChoroplethGeojson}
            style={activeStyle as (f: Feature<Geometry, Record<string, unknown>> | undefined) => PathOptions}
            onEachFeature={activeOnEach as (f: Feature<Geometry, Record<string, unknown>>, l: Layer) => void}
            ref={(ref) => { geoJsonRef.current = ref }}
          />
        )}

        <MapEdgeReset
          geoJsonRef={geoJsonRef}
          lastHoveredRef={lastHoveredRef}
          onClearTooltip={clearTooltip}
        />

        {showCentroids && districtPoints.map(({ centroid, districtName, normalized, value }) => {
          const provinceName = DISTRICT_TO_PROVINCE[districtName] ?? 'Unknown Province'
          const isSelected = isProvinceMap
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
                  if (isProvinceMap) {
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
          <div className="term-label">Province</div>
          <div className="mt-0.5 text-[13px] font-semibold break-words line-clamp-2">{hoverTooltip.provinceName}</div>
          {showDistrictInTooltip(datasetLevel, showCentroids, hoverTooltip) && hoverTooltip.districtName && (
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
        </div>
      )}
    </div>
  )
}
