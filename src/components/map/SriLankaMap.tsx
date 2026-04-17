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
        radius: 25,
        blur: 15,
        maxZoom: 12,
        max: 1.0,
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
}: SriLankaMapProps) {
  const [geojson, setGeojson] = useState<FeatureCollection<Geometry, DistrictProperties> | null>(null)

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

      if (visualizationMode === 'heatmap') {
        return {
          fillColor: 'transparent',
          fillOpacity: 0.02,
          color: isSelected ? '#1976d2' : '#e0e0e0',
          opacity: isSelected ? 1 : 0.4,
          weight: isSelected ? 2 : 1,
          dashArray: isSelected ? '' : '4 4',
        }
      }

      if (visualizationMode === 'points') {
        return {
          fillColor: value > 0 ? getColorForValue(value, colorScale) : '#f5f5f5',
          fillOpacity: isSelected ? 0.15 : 0.05,
          color: isSelected ? '#1976d2' : '#e0e0e0',
          weight: isSelected ? 2 : 1,
        }
      }

      return {
        fillColor: value > 0 ? getColorForValue(value, colorScale) : '#f5f5f5',
        fillOpacity: isSelected ? 0.95 : 0.8,
        color: isSelected ? '#1976d2' : '#ffffff',
        weight: isSelected ? 2.5 : 1,
      }
    }
  }, [colorScale, dataMap, selectedDistrict, visualizationMode])

  const onEachFeature = (feature: DistrictFeature, layer: Layer) => {
    const districtName = feature.properties?.name ?? 'Unknown'

    layer.on({
      click: () => onDistrictSelect(districtName),
      mouseover: (event: LeafletMouseEvent) => {
        const target = event.target
        target.setStyle({ weight: 2, fillOpacity: visualizationMode === 'heatmap' ? 0.08 : 0.9 })
        target.bringToFront()
      },
      mouseout: (event: LeafletMouseEvent) => {
        const target = event.target
        target.setStyle(style(feature))
        target.closeTooltip()
      },
    })

    if (showTooltips) {
      const value = dataMap.get(districtName.toLowerCase()) ?? 0
      const formattedValue = value > 0 ? formatValue(value) : null
      const tooltipContent = `
  <div class="p-3 min-w-[140px]">
    <div class="font-bold text-gray-900 text-sm mb-1.5 tracking-tight">${districtName}</div>
    ${formattedValue ? `<div class="text-xs text-gray-500 font-medium uppercase tracking-wider">Value</div><div class="text-lg font-bold text-primary leading-none mt-0.5">${formattedValue}</div>` : '<div class="text-xs text-gray-400 italic mt-1">No data available</div>'}
  </div>
`

      layer.bindTooltip(tooltipContent, { sticky: false, opacity: 1, className: 'custom-leaflet-tooltip' })
    }
  }

  return (
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
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      <HeatmapLayer points={heatmapPoints} enabled={visualizationMode === 'heatmap'} />

      {geojson && (
        <GeoJSON
          key={`map-${visualizationMode}-${data.length}-${data[0]?.value ?? 0}-${colorScale.max}`}
          data={geojson}
          style={style}
          onEachFeature={onEachFeature}
        />
      )}

      {visualizationMode === 'points' && districtPoints.map(({ centroid, districtName, normalized, value }) => {
        const isSelected = selectedDistrict?.toLowerCase() === districtName.toLowerCase()

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
                <div className="mb-1.5 text-sm font-bold text-gray-900 tracking-tight">{districtName}</div>
                <div className="text-xs font-medium text-gray-500 uppercase tracking-wider">Value</div>
                <div className="mt-0.5 text-lg font-bold leading-none text-primary">{formatValue(value)}</div>
              </div>
            </Tooltip>
          </CircleMarker>
        )
      })}
    </MapContainer>
  )
}
