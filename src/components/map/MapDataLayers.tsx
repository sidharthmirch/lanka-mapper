'use client'

import { memo, useEffect, useState } from 'react'
import { CircleMarker, GeoJSON, Tooltip } from 'react-leaflet'
import type { Feature, FeatureCollection, Geometry, LineString, MultiPolygon, Point, Polygon } from 'geojson'
import type { Layer, Path, PathOptions } from 'leaflet'

const PUBLIC_BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? ''

type RiverProps = { ord?: number }
type GridProps = { kv?: number | null }
type BasinProps = { name?: string; areaKm2?: number; named?: boolean }
type PlantProps = {
  name?: string
  segment?: 'hydro' | 'solar' | 'wind' | string
  firm?: string
  capMw?: number | null
  river?: string | null
  /** True for agent-geocoded CEB plants placed at town/locality level (not surveyed). */
  approx?: boolean
  confidence?: string | null
  source?: string | null
}

interface MapDataLayersProps {
  showRivers: boolean
  showPlants: boolean
  showGrid: boolean
  showBasins: boolean
  isDark: boolean
}

/** Escape basin names before injecting into the Leaflet tooltip's HTML. */
function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] ?? c
  ))
}

/** Plant marker colors by segment — bright so dots pop over the choropleth. */
const PLANT_COLORS: Record<string, string> = {
  hydro: '#4ea3d1',
  solar: '#f2c14e',
  wind: '#6fcf97',
  biomass: '#c98a5e',
  dendro: '#a88b4a',
  coal: '#8a8f98',
  oil: '#b06a8f',
  other: '#9aa18d',
}

function useGeoLayer<T>(url: string, enabled: boolean): FeatureCollection<Geometry, T> | null {
  const [data, setData] = useState<FeatureCollection<Geometry, T> | null>(null)
  useEffect(() => {
    if (!enabled || data) return
    let cancelled = false
    void fetch(url)
      .then((r) => r.json() as Promise<FeatureCollection<Geometry, T>>)
      .then((d) => {
        if (!cancelled) setData(d)
      })
      .catch(() => {
        if (!cancelled) setData(null)
      })
    return () => {
      cancelled = true
    }
  }, [url, enabled, data])
  return data
}

/**
 * Optional map data layers, each lazily fetched the first time it's switched on:
 * rivers (HydroRIVERS), the CEB transmission grid (OSM power=line), and CSE-listed
 * power plants by segment. Lines are non-interactive so they never steal hover from
 * the choropleth; plants are clickable points with a capacity tooltip.
 */
const MapDataLayers = memo(function MapDataLayers({ showRivers, showPlants, showGrid, showBasins, isDark }: MapDataLayersProps) {
  const rivers = useGeoLayer<RiverProps>(`${PUBLIC_BASE_PATH}/data/sri-lanka-rivers.geojson`, showRivers)
  const grid = useGeoLayer<GridProps>(`${PUBLIC_BASE_PATH}/data/sri-lanka-grid.geojson`, showGrid)
  const plants = useGeoLayer<PlantProps>(`${PUBLIC_BASE_PATH}/data/sri-lanka-power-plants.geojson`, showPlants)
  const basins = useGeoLayer<BasinProps>(`${PUBLIC_BASE_PATH}/data/sri-lanka-basins.geojson`, showBasins)

  const riverColor = isDark ? '#5fa8d3' : '#2e6f9e'
  const gridColor = isDark ? '#cf9b46' : '#9a6a24'
  const plantStroke = isDark ? '#0f1311' : '#fdfbf6'
  const basinColor = isDark ? '#6fc2b4' : '#2c7a6e'

  const riverStyle = (feature?: Feature<Geometry, RiverProps>): PathOptions => {
    const ord = feature?.properties?.ord ?? 4
    return { color: riverColor, weight: ord >= 5 ? 1.8 : 1, opacity: 0.75, interactive: false }
  }

  // Basin watersheds: dashed outline, invisible-but-hittable fill so hover
  // surfaces the basin name without hiding the choropleth underneath.
  const basinStyle = (): PathOptions => ({
    color: basinColor,
    weight: 1.3,
    opacity: 0.85,
    dashArray: '5 4',
    fill: true,
    fillOpacity: 0,
  })

  const onEachBasin = (feature: Feature<Geometry, BasinProps>, layer: Layer) => {
    const name = feature.properties?.name ?? 'Basin'
    const area = feature.properties?.areaKm2
    const label = `<span class="font-semibold">${escapeHtml(name)}</span>${area ? ` · ${area.toLocaleString()} km²` : ''}`
    layer.bindTooltip(label, { sticky: true, direction: 'top', className: 'custom-leaflet-tooltip' })
    layer.on({
      mouseover: () => (layer as Path).setStyle({ weight: 2.2, fillOpacity: 0.12, fillColor: basinColor }),
      mouseout: () => (layer as Path).setStyle({ weight: 1.3, fillOpacity: 0 }),
    })
  }

  const gridStyle = (feature?: Feature<Geometry, GridProps>): PathOptions => {
    const kv = feature?.properties?.kv ?? 0
    const weight = kv >= 220 ? 2.2 : kv >= 132 ? 1.5 : 1
    return { color: gridColor, weight, opacity: kv >= 132 ? 0.85 : 0.55, dashArray: '1 3', interactive: false }
  }

  return (
    <>
      {showBasins && basins && (
        <GeoJSON
          key={`basins-${isDark}`}
          data={basins as FeatureCollection<Polygon | MultiPolygon, BasinProps>}
          style={basinStyle as () => PathOptions}
          onEachFeature={onEachBasin as (f: Feature<Geometry, Record<string, unknown>>, l: Layer) => void}
        />
      )}

      {showGrid && grid && (
        <GeoJSON
          key={`grid-${isDark}`}
          data={grid as FeatureCollection<LineString, GridProps>}
          style={gridStyle as (f?: Feature<Geometry, Record<string, unknown>>) => PathOptions}
          interactive={false}
        />
      )}

      {showRivers && rivers && (
        <GeoJSON
          key={`rivers-${isDark}`}
          data={rivers as FeatureCollection<LineString, RiverProps>}
          style={riverStyle as (f?: Feature<Geometry, Record<string, unknown>>) => PathOptions}
          interactive={false}
        />
      )}

      {showPlants && plants && (plants as FeatureCollection<Point, PlantProps>).features.map((f, i) => {
        const [lon, lat] = f.geometry.coordinates
        const seg = f.properties.segment ?? 'hydro'
        const cap = f.properties.capMw
        const approx = f.properties.approx === true
        const color = PLANT_COLORS[seg] ?? '#9aa18d'
        const r = Math.max(3.5, Math.min(13, Math.sqrt(Math.max(0.1, cap ?? 1)) * 1.5))
        return (
          <CircleMarker
            key={`plant-${i}`}
            center={[lat, lon]}
            radius={approx ? Math.max(3, r * 0.8) : r}
            pane="markerPane"
            /* Approximate (town-level) plants render hollow + faint so they read
               as estimates, not surveyed points. Precise plants stay solid. */
            pathOptions={approx
              ? { color, weight: 1.4, fillColor: color, fillOpacity: 0.12, dashArray: '2 2' }
              : { color: plantStroke, weight: 1, fillColor: color, fillOpacity: 0.92 }}
          >
            <Tooltip direction="top" offset={[0, -2]} opacity={1} className="custom-leaflet-tooltip">
              <div className="px-3 py-2">
                <div className="mono text-[9px] uppercase tracking-[0.1em]" style={{ color }}>
                  {seg}
                </div>
                <div className="mt-0.5 text-[13px] font-semibold text-[var(--ink)]">{f.properties.name}</div>
                {cap != null && (
                  <div className="mono mt-0.5 text-[12px] text-[var(--accent)]">{cap} MW</div>
                )}
                {f.properties.firm && (
                  <div className="mt-0.5 max-w-[200px] truncate text-[11px] text-[var(--ink-3)]">{f.properties.firm}</div>
                )}
                {approx && (
                  <div className="mt-1 text-[10px] italic text-[var(--ink-3)]">
                    ≈ approx (town-level{f.properties.confidence ? `, ${f.properties.confidence}` : ''})
                  </div>
                )}
              </div>
            </Tooltip>
          </CircleMarker>
        )
      })}
    </>
  )
})

export default MapDataLayers
