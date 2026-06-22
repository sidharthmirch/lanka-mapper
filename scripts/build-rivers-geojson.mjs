/**
 * Build a compact, OSM-aligned rivers overlay from the Survey Department of
 * Sri Lanka 1:250k hydrography (RapidSL), redistributed by nuuuwan/rivers_lk
 * (HDX: lka_rapidsl_rvr_250k_sdlka).
 *
 * Why this and not HydroRIVERS: the previous overlay was HydroRIVERS, derived
 * from a 15-arc-second DEM. Its centrelines are systematically offset from the
 * real channels OpenStreetMap traces, so the blue lines never sat on the water.
 * The SDLKA layer is survey-traced at 1:250k, so it lines up with OSM.
 *
 * What we keep: flowing watercourses only — CODE 1 (rivers/streams) and CODE 2
 * (major canals / yoda ela). Standing water (tanks, lagoons, lakes, villus,
 * salterns — CODE 3/4/5/6/7/9/10/11) is dropped so the overlay reads as rivers,
 * not reservoir outlines. Each watercourse network (ST_NET2_ID) is weighted by
 * its total length into an `ord` tier (drives line weight in MapDataLayers), and
 * geometry is Douglas–Peucker simplified to shrink the file while preserving the
 * channel path.
 *
 * Usage:
 *   git clone --depth 1 https://github.com/nuuuwan/rivers_lk /tmp/rivers_lk
 *   node scripts/build-rivers-geojson.mjs /tmp/rivers_lk/data/hdx/lka_rapidsl_rvr_250k_sdlka.geo.json
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { simplify } from '@turf/turf'
import proj4 from 'proj4'

/**
 * Source CRS: Kandawala / Sri Lanka Grid (EPSG:5234) — Transverse Mercator on
 * the Everest 1830 (Sri Lanka) ellipsoid, taken from the SDLKA .prj. The
 * `towgs84` 3-parameter shift (EPSG transformation "Kandawala to WGS 84 (1)",
 * code 1259) is what makes the reprojected channels land on the OSM basemap.
 */
const SLD_KANDAWALA =
  '+proj=tmerc +lat_0=7.0004802778 +lon_0=80.77171111111112 +k=0.9999238418'
  + ' +x_0=200000 +y_0=200000 +a=6377276.345 +rf=300.80169999'
  + ' +towgs84=-97,787,86,0,0,0,0 +units=m +no_defs'
const toWgs84 = proj4(SLD_KANDAWALA, 'WGS84')

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const SRC = process.argv[2]
  || process.env.RIVERS_SRC
  || '/tmp/rivers_lk/data/hdx/lka_rapidsl_rvr_250k_sdlka.geo.json'

/** SDLKA CODE values that are flowing watercourses (rivers + major canals). */
const KEEP_CODES = new Set(
  (process.env.KEEP_CODES || '1,2').split(',').map((s) => Number(s.trim())),
)
/** Drop watercourse networks shorter than this (m) — orphan stubs, not rivers. */
const MIN_NET_LEN = Number(process.env.MIN_NET_LEN || 8000)
/** Douglas–Peucker tolerance in degrees (~0.0015° ≈ 165 m, ample at 1:250k). */
const SIMPLIFY_TOL = Number(process.env.SIMPLIFY_TOL || 0.0015)
/** Coordinate decimal places kept (4 ≈ 11 m — ample for a 1:250k overlay). */
const PRECISION = Number(process.env.PRECISION || 4)
/** Names that are standing water even when mis-coded as a watercourse. */
const WATER_BODY = /kulam|wewa|tank|lagoon|kadal|villu|lewaya|kalapuwa|lake|pond|reservoir/i

const outPath = path.join(__dirname, '..', 'public/data/sri-lanka-rivers.geojson')

const fc = JSON.parse(fs.readFileSync(SRC, 'utf8'))
const all = fc.type === 'FeatureCollection' ? fc.features : [fc]

// First pass: total length per watercourse network so we can weight + prune.
const netLength = new Map()
for (const f of all) {
  const p = f.properties || {}
  if (!KEEP_CODES.has(Number(p.CODE))) continue
  if (p.NAME && WATER_BODY.test(p.NAME)) continue
  const key = p.ST_NET2_ID
  netLength.set(key, (netLength.get(key) || 0) + (Number(p.LENGTH) || 0))
}

/** Line weight tier from a network's total length — gives the overlay hierarchy. */
function ordForLength(meters) {
  if (meters >= 60000) return 6
  if (meters >= 20000) return 5
  return 4
}

const features = []
let keptCoords = 0
for (const f of all) {
  const p = f.properties || {}
  const g = f.geometry
  if (!g || (g.type !== 'LineString' && g.type !== 'MultiLineString')) continue
  if (!KEEP_CODES.has(Number(p.CODE))) continue
  if (p.NAME && WATER_BODY.test(p.NAME)) continue

  const total = netLength.get(p.ST_NET2_ID) || 0
  if (total < MIN_NET_LEN) continue

  // Reproject Kandawala grid metres → WGS84 lon/lat so the line sits on the map.
  const project = (pt) => toWgs84.forward([pt[0], pt[1]])
  const projected = g.type === 'LineString'
    ? { type: 'LineString', coordinates: g.coordinates.map(project) }
    : { type: 'MultiLineString', coordinates: g.coordinates.map((line) => line.map(project)) }

  const simplified = simplify(
    { type: 'Feature', properties: {}, geometry: projected },
    { tolerance: SIMPLIFY_TOL, highQuality: false, mutate: true },
  )
  const sg = simplified.geometry
  // Round in place and drop consecutive duplicate points the rounding creates.
  const round = (pt) => [Number(pt[0].toFixed(PRECISION)), Number(pt[1].toFixed(PRECISION))]
  const dedupe = (line) => line.map(round).filter((pt, i, arr) => i === 0 || pt[0] !== arr[i - 1][0] || pt[1] !== arr[i - 1][1])
  if (sg.type === 'LineString') {
    sg.coordinates = dedupe(sg.coordinates)
  } else {
    sg.coordinates = sg.coordinates.map(dedupe).filter((line) => line.length >= 2)
  }
  const coordCount = sg.type === 'LineString'
    ? sg.coordinates.length
    : sg.coordinates.reduce((a, line) => a + line.length, 0)
  if (coordCount < 2) continue
  keptCoords += coordCount

  const props = { ord: ordForLength(total) }
  const name = (p.NAME || '').trim()
  if (name) props.name = name
  features.push({ type: 'Feature', properties: props, geometry: sg })
}

const out = { type: 'FeatureCollection', features }
fs.writeFileSync(outPath, JSON.stringify(out))

const ordHist = features.reduce((acc, f) => {
  acc[f.properties.ord] = (acc[f.properties.ord] || 0) + 1
  return acc
}, {})
console.log(`source: ${path.basename(SRC)} (${all.length} features)`)
console.log(`kept ${features.length} watercourse reaches, ${keptCoords} coords`)
console.log(`ord histogram: ${JSON.stringify(ordHist)}`)
console.log(`wrote ${outPath} (${(fs.statSync(outPath).size / 1024).toFixed(0)} KB)`)
