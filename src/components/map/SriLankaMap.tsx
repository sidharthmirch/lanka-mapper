import { useEffect, useMemo, useState } from 'react'
import { CircleMarker, GeoJSON, MapContainer, TileLayer, Tooltip, useMap } from 'react-leaflet'
import type { Feature, FeatureCollection, Geometry, MultiPolygon, Polygon } from 'geojson'
import L from 'leaflet'
import type { Layer, LeafletMouseEvent, PathOptions } from 'leaflet'
import type { ColorScale, MapData, VisualizationMode } from '@/types'

interface SriLankaMapProps {
  data: MapData[]
  selectedDistrict: string | null
  onDistrictSelect: (district: string) => void
  colorScale: ColorScale
  showTooltips: boolean
  visualizationMode: VisualizationMode
  showChoropleth: boolean
  showCentroids: boolean
  isDarkMode: boolean
}

interface DistrictProperties {
  name?: string
}

type DistrictFeature = Feature<Geometry, DistrictProperties>

const SRI_LANKA_CENTER: [number, number] = [7.8731, 80.7718]
const DEFAULT_ZOOM = 8

function formatValue(val: number): string {
  if (val >= 1000000) return `${(val / 1000000).toFixed(1)}M`
  if (val >= 1000) return `${(val / 1000).toFixed(1)}K`
  return val.toLocaleString()
}

function getColorForValue(value: number, scale: ColorScale): string {
  const { min, max, colors } = scale
  if (max === min) return colors[0]

  const normalized = (value - min) / (max - min)
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

function isPolygonGeometry(geometry: Geometry): geometry is Polygon | MultiPolygon {
  return geometry.type === 'Polygon' || geometry.type === 'MultiPolygon'
}

function getCentroid(feature: Feature<Polygon | MultiPolygon, DistrictProperties>): [number, number] {
  const coords = feature.geometry.type === 'Polygon'
    ? feature.geometry.coordinates[0]
    : feature.geometry.coordinates[0][0]

  const sum = coords.reduce<[number, number]>(
    (acc: [number, number], coordinate: number[]) => [acc[0] + coordinate[0], acc[1] + coordinate[1]],
    [0, 0],
  )

  return [sum[1] / coords.length, sum[0] / coords.length]
}

interface DistrictPointDatum {
  districtName: string
  value: number
  normalized: number
  centroid: [number, number]
}

interface HeatmapLayerProps {
  points: Array<[number, number, number]>
  enabled: boolean
}

interface HoverTooltipState {
  provinceName: string
  districtName: string
  formattedValue: string | null
  x: number
  y: number
}

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

function HeatmapLayer({ points, enabled }: HeatmapLayerProps) {
  const map = useMap()

  useEffect(() => {
    if (!enabled || points.length === 0) {
      return undefined
    }

    let heatLayer: L.HeatLayer | null = null
    let cancelled = false

    void import('leaflet.heat').then(() => {
      if (cancelled) {
        return
      }

      heatLayer = L.heatLayer(points, {
        radius: 18,
        blur: 12,
        maxZoom: 12,
        max: 1.0,
        minOpacity: 0.35,
        gradient: {
          0.15: '#1f0020',
          0.35: '#4b0055',
          0.55: '#9b001f',
          0.75: '#ff4f00',
          0.9: '#ffae00',
          1.0: '#ffe84a',
        },
      })

      heatLayer.addTo(map)
    })

    return () => {
      cancelled = true
      if (heatLayer) {
        map.removeLayer(heatLayer)
      }
    }
  }, [enabled, map, points])

  return null
}

export default function SriLankaMap({
  data,
  selectedDistrict,
  onDistrictSelect,
  colorScale,
  showTooltips,
  visualizationMode,
  showChoropleth,
  showCentroids,
  isDarkMode,
}: SriLankaMapProps) {
  const [geojson, setGeojson] = useState<FeatureCollection<Geometry, DistrictProperties> | null>(null)
  const [hoverTooltip, setHoverTooltip] = useState<HoverTooltipState | null>(null)

  useEffect(() => {
    if (!showTooltips) {
      setHoverTooltip(null)
    }
  }, [showTooltips])

  useEffect(() => {
    let cancelled = false

    void fetch('/data/sri-lanka-districts.geojson')
      .then((res) => res.json() as Promise<FeatureCollection<Geometry, DistrictProperties>>)
      .then((collection) => {
        if (!cancelled) {
          setGeojson(collection)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setGeojson(null)
        }
      })

    return () => {
      cancelled = true
    }
  }, [])

  const dataMap = useMemo(() => {
    const map = new Map<string, number>()
    data.forEach((district) => {
      map.set(district.name.toLowerCase(), district.value)
    })
    return map
  }, [data])

  const districtPoints = useMemo<DistrictPointDatum[]>(() => {
    if (!geojson) {
      return []
    }

    return geojson.features.flatMap((feature) => {
      const { geometry } = feature

      if (!isPolygonGeometry(geometry)) {
        return []
      }

      const polygonFeature: Feature<Polygon | MultiPolygon, DistrictProperties> = {
        ...feature,
        geometry,
      }

      const districtName = feature.properties?.name ?? ''
      const value = dataMap.get(districtName.toLowerCase()) ?? 0

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
  }, [colorScale, dataMap, geojson])

  const heatmapPoints = useMemo<Array<[number, number, number]>>(
    () => districtPoints.map(({ centroid, normalized }) => [centroid[0], centroid[1], normalized]),
    [districtPoints],
  )

  const style = useMemo(() => {
    return (feature: DistrictFeature | undefined): PathOptions => {
      if (!feature) {
        return { fillColor: '#e0e0e0', fillOpacity: 0.5, color: '#9e9e9e', weight: 1 }
      }

      const districtName = feature.properties?.name ?? ''
      const value = dataMap.get(districtName.toLowerCase()) ?? 0
      const isSelected = selectedDistrict?.toLowerCase() === districtName.toLowerCase()

      if (!showChoropleth) {
        return {
          fillColor: 'transparent',
          fillOpacity: 0,
          color: isSelected ? '#1976d2' : (isDarkMode ? '#596273' : '#c8d4e3'),
          weight: isSelected ? 2 : 1,
          opacity: isSelected ? 0.95 : 0.7,
        }
      }

      if (visualizationMode === 'heatmap') {
        return {
          fillColor: 'transparent',
          fillOpacity: isSelected ? 0.06 : 0.02,
          color: isSelected ? '#1976d2' : (isDarkMode ? '#596273' : '#c8d4e3'),
          weight: isSelected ? 2 : 1,
          opacity: isSelected ? 0.95 : 0.7,
        }
      }

      return {
        fillColor: value > 0 ? getColorForValue(value, colorScale) : '#f5f5f5',
        fillOpacity: isSelected ? 0.92 : (isDarkMode ? 0.74 : 0.82),
        color: isSelected ? '#1976d2' : (isDarkMode ? '#505a67' : '#ffffff'),
        weight: isSelected ? 2.5 : 1,
      }
    }
  }, [colorScale, dataMap, isDarkMode, selectedDistrict, showChoropleth, visualizationMode])

  const onEachFeature = (feature: DistrictFeature, layer: Layer) => {
    const districtName = feature.properties?.name ?? 'Unknown'
    const provinceName = DISTRICT_TO_PROVINCE[districtName] ?? 'Unknown Province'

    layer.on({
      click: () => onDistrictSelect(districtName),
      mouseover: (event: LeafletMouseEvent) => {
        const target = event.target
        const isHeatmapNoFill = visualizationMode === 'heatmap' || !showChoropleth
        target.setStyle({
          weight: 2.5,
          color: '#1976d2',
          fillColor: isHeatmapNoFill ? 'transparent' : undefined,
          fillOpacity: isHeatmapNoFill ? 0 : 0.92,
        })
        target.bringToFront()

        if (showTooltips) {
          const value = dataMap.get(districtName.toLowerCase()) ?? 0
          const mapSize = event.target._map?.getSize()
          const nextX = mapSize ? Math.min(event.containerPoint.x, Math.max(0, mapSize.x - 190)) : event.containerPoint.x
          const nextY = mapSize ? Math.min(event.containerPoint.y, Math.max(0, mapSize.y - 90)) : event.containerPoint.y
          setHoverTooltip({
            provinceName,
            districtName,
            formattedValue: value > 0 ? formatValue(value) : null,
            x: nextX,
            y: nextY,
          })
        }
      },
      mousemove: (event: LeafletMouseEvent) => {
        if (!showTooltips) {
          return
        }

        setHoverTooltip((prev) => {
          if (!prev || prev.districtName !== districtName) {
            return prev
          }

          return {
            ...prev,
            x: event.target._map?.getSize()
              ? Math.min(event.containerPoint.x, Math.max(0, event.target._map.getSize().x - 190))
              : event.containerPoint.x,
            y: event.target._map?.getSize()
              ? Math.min(event.containerPoint.y, Math.max(0, event.target._map.getSize().y - 90))
              : event.containerPoint.y,
          }
        })
      },
      mouseout: (event: LeafletMouseEvent) => {
        const target = event.target
        target.setStyle(style(feature))
        setHoverTooltip((prev) => (prev?.districtName === districtName ? null : prev))
      },
    })
  }

  return (
    <div className="relative h-full w-full">
      <MapContainer
        center={SRI_LANKA_CENTER}
        zoom={DEFAULT_ZOOM}
        minZoom={6}
        maxZoom={14}
        style={{ height: '100%', width: '100%' }}
        className="rounded-lg"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url={isDarkMode
            ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
            : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'}
        />

        {geojson && (
          <GeoJSON
            key={`map-${data.length}-${data[0]?.value ?? 0}-${colorScale.max}-${showTooltips}-${showChoropleth}-${visualizationMode}-${isDarkMode ? 'dark' : 'light'}`}
            data={geojson}
            style={style}
            onEachFeature={onEachFeature}
          />
        )}

        <HeatmapLayer points={heatmapPoints} enabled={visualizationMode === 'heatmap'} />

        {showCentroids && districtPoints.map(({ centroid, districtName, normalized, value }) => {
          const isSelected = selectedDistrict?.toLowerCase() === districtName.toLowerCase()
          const provinceName = DISTRICT_TO_PROVINCE[districtName] ?? 'Unknown Province'

          return (
            <CircleMarker
              key={`point-${districtName}`}
              center={centroid}
              radius={Math.max(6, Math.min(32, (normalized * 26) + 6))}
              pathOptions={{
                color: isSelected ? '#1976d2' : '#ffffff',
                weight: isSelected ? 3 : 1.5,
                fillColor: getColorForValue(value, colorScale),
                fillOpacity: 0.85,
              }}
              eventHandlers={{
                click: () => onDistrictSelect(districtName),
              }}
            >
              <Tooltip sticky={false} opacity={1} className="custom-leaflet-tooltip">
                <div className="min-w-[140px] p-2">
                  <div className="text-[10px] font-medium uppercase tracking-wider text-gray-500">Province</div>
                  <div className="text-xs font-semibold text-gray-700">{provinceName}</div>
                  <div className="mt-1 text-[10px] font-medium uppercase tracking-wider text-gray-500">District</div>
                  <div className="mb-1.5 text-sm font-bold text-gray-900 tracking-tight">{districtName}</div>
                  <div className="text-xs font-medium text-gray-500 uppercase tracking-wider">Value</div>
                  <div className="mt-0.5 text-lg font-bold leading-none text-primary">{formatValue(value)}</div>
                </div>
              </Tooltip>
            </CircleMarker>
          )
        })}
      </MapContainer>

      {showTooltips && hoverTooltip && (
        <div
          className="pointer-events-none absolute z-[1200] rounded-xl border px-3 py-2 shadow-lg backdrop-blur"
          style={{
            left: hoverTooltip.x + 14,
            top: hoverTooltip.y + 12,
            borderColor: 'var(--outline)',
            background: 'color-mix(in srgb, var(--surface) 92%, transparent)',
            color: 'var(--on-surface)',
          }}
        >
          <div className="text-[10px] font-medium uppercase tracking-wider text-gray-500">Province</div>
          <div className="text-xs font-semibold">{hoverTooltip.provinceName}</div>
          <div className="mt-1 text-[10px] font-medium uppercase tracking-wider text-gray-500">District</div>
          <div className="text-sm font-semibold">{hoverTooltip.districtName}</div>
          {hoverTooltip.formattedValue ? (
            <>
              <div className="text-[10px] font-medium uppercase tracking-wider text-gray-500">Value</div>
              <div className="text-base font-bold text-blue-600">{hoverTooltip.formattedValue}</div>
            </>
          ) : (
            <div className="text-xs italic text-gray-400">No data available</div>
          )}
        </div>
      )}
    </div>
  )
}
