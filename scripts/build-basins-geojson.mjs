/**
 * Build the river-basin overlay from HydroSHEDS HydroBASINS (Asia, Pfafstetter
 * level 08) — the authoritative watershed delineation used by the Sri Lankan GIS
 * community. Level 08 resolves the island into ~80 basins, comparable to the
 * Irrigation Department's 103 official river basins.
 *
 * HydroBASINS polygons carry no name, only a HYBAS_ID and catchment stats, so we
 * name each basin after its dominant watercourse: the highest-order named reach
 * (from the SDLKA rivers overlay we already build) whose midpoint falls inside it.
 * That yields familiar labels — Mahaweli, Kelani, Kala Oya, … — for the big basins.
 *
 * Usage:
 *   curl -sLO https://data.hydrosheds.org/file/HydroBASINS/standard/hybas_as_lev08_v1c.zip
 *   unzip -o hybas_as_lev08_v1c.zip -d /tmp/hybas_lev08
 *   node scripts/build-rivers-geojson.mjs        # rivers first (provides names)
 *   node scripts/build-basins-geojson.mjs /tmp/hybas_lev08/hybas_as_lev08_v1c.shp
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import * as shapefile from 'shapefile'
import { simplify, booleanPointInPolygon } from '@turf/turf'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const SHP = process.argv[2]
  || process.env.BASINS_SHP
  || '/tmp/hybas_lev08/hybas_as_lev08_v1c.shp'
const DBF = SHP.replace(/\.shp$/, '.dbf')
const SIMPLIFY_TOL = Number(process.env.SIMPLIFY_TOL || 0.0025)
const PRECISION = Number(process.env.PRECISION || 4)

const riversPath = path.join(__dirname, '..', 'public/data/sri-lanka-rivers.geojson')
const outPath = path.join(__dirname, '..', 'public/data/sri-lanka-basins.geojson')

/** Sri Lanka bounding box — basins are island-contained, so a centroid test isolates them. */
const LK = { minLon: 79.5, maxLon: 82.0, minLat: 5.8, maxLat: 10.0 }

function centroidOf(geometry) {
  let lon = 0
  let lat = 0
  let n = 0
  const walk = (g) => {
    if (typeof g[0] === 'number') { lon += g[0]; lat += g[1]; n += 1 } else g.forEach(walk)
  }
  walk(geometry.coordinates)
  return [lon / n, lat / n]
}

const round = (pt) => [Number(pt[0].toFixed(PRECISION)), Number(pt[1].toFixed(PRECISION))]
function roundGeometry(geom) {
  if (geom.type === 'Polygon') return { type: 'Polygon', coordinates: geom.coordinates.map((r) => r.map(round)) }
  return { type: 'MultiPolygon', coordinates: geom.coordinates.map((p) => p.map((r) => r.map(round))) }
}

// 1. Read Sri Lankan basins out of the continental shapefile.
const basins = []
const source = await shapefile.open(SHP, DBF)
for (;;) {
  const result = await source.read()
  if (result.done) break
  const feature = result.value
  const [lon, lat] = centroidOf(feature.geometry)
  if (lon < LK.minLon || lon > LK.maxLon || lat < LK.minLat || lat > LK.maxLat) continue
  basins.push(feature)
}

// 2. Name each basin after the largest named river reach inside it.
const rivers = JSON.parse(fs.readFileSync(riversPath, 'utf8'))
const namedReaches = rivers.features
  .filter((f) => f.properties?.name && f.geometry?.type === 'LineString' && f.geometry.coordinates.length)
  .map((f) => {
    const coords = f.geometry.coordinates
    return { name: f.properties.name, ord: f.properties.ord ?? 4, mid: coords[Math.floor(coords.length / 2)] }
  })
  .sort((a, b) => b.ord - a.ord)

const basinName = new Map()
for (const reach of namedReaches) {
  for (const basin of basins) {
    const id = basin.properties.HYBAS_ID
    if (basinName.has(id)) continue
    try {
      if (booleanPointInPolygon(reach.mid, basin)) {
        basinName.set(id, reach.name)
        break
      }
    } catch {
      // skip malformed geometry pairings
    }
  }
}

// 3. Simplify, round, and emit.
let unnamed = 0
const features = basins.map((basin, i) => {
  let geom = basin.geometry
  try {
    geom = simplify({ type: 'Feature', properties: {}, geometry: basin.geometry }, { tolerance: SIMPLIFY_TOL, highQuality: false, mutate: false }).geometry
  } catch {
    geom = basin.geometry
  }
  const id = basin.properties.HYBAS_ID
  const name = basinName.get(id)
  if (!name) unnamed += 1
  return {
    type: 'Feature',
    properties: {
      name: name ?? `Basin ${i + 1}`,
      named: Boolean(name),
      areaKm2: Math.round(basin.properties.SUB_AREA),
      hybasId: id,
    },
    geometry: roundGeometry(geom),
  }
})

// Larger basins drawn first so smaller ones sit on top for hit-testing.
features.sort((a, b) => b.properties.areaKm2 - a.properties.areaKm2)

fs.writeFileSync(outPath, JSON.stringify({ type: 'FeatureCollection', features }))
console.log(`source: ${path.basename(SHP)}`)
console.log(`kept ${features.length} Sri Lanka basins (${features.length - unnamed} named, ${unnamed} unnamed)`)
console.log(`named sample: ${features.filter((f) => f.properties.named).slice(0, 8).map((f) => f.properties.name).join(', ')}`)
console.log(`-> ${outPath} (${(fs.statSync(outPath).size / 1024).toFixed(0)} KB)`)
