/**
 * Extract CSE-listed power plants (hydro / solar / wind) from the artifacts
 * power map (power/power_map.html) into a GeoJSON point layer for the map.
 *
 * Each plant is a <circle class="plant"> with data-* attributes (lat, lon,
 * segment, capacity, firm, river). We keep the fields the map overlay needs.
 *
 * Usage:
 *   node scripts/build-power-plants-geojson.mjs /path/to/artifacts/power/power_map.html
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const SRC = process.argv[2] || process.env.POWER_MAP_HTML
  || '/Users/sidharth/Repos/artifacts/power/power_map.html'
const outPath = path.join(__dirname, '..', 'public/data/sri-lanka-power-plants.geojson')

const html = fs.readFileSync(SRC, 'utf8')
const attr = (s, name) => {
  const m = s.match(new RegExp(`data-${name}="([^"]*)"`))
  return m ? m[1] : ''
}

const features = []
const seen = new Set()
for (const m of html.matchAll(/<circle class="plant"[^>]*>/g)) {
  const el = m[0]
  const lat = Number(attr(el, 'lat'))
  const lon = Number(attr(el, 'lon'))
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || lat === 0 || lon === 0) continue
  const segment = attr(el, 'segment')
  const name = attr(el, 'plant')
  const key = `${segment}:${name}:${lat}:${lon}`
  if (seen.has(key)) continue
  seen.add(key)
  features.push({
    type: 'Feature',
    properties: {
      name,
      segment, // hydro | solar | wind
      firm: attr(el, 'firmfull') || attr(el, 'firm'),
      ticker: attr(el, 'ticker'),
      capMw: Number(attr(el, 'capmw')) || null,
      river: attr(el, 'river') || null,
      approx: false,
    },
    geometry: { type: 'Point', coordinates: [lon, lat] },
  })
}

const norm = (s) => s.toLowerCase()
  .replace(/\b(wpp|spp|bmp|mhp|mhpp|dpp|power|plant|station|hydroelectric|hydropower|hydro|solar|wind|farm|mini|phase|reservoir|ganga|oya|aru|ela|ii|iii|iv|i)\b/g, '')
  .replace(/[^a-z0-9]/g, '')
const knownNames = new Set(features.map((f) => norm(f.properties.name)))

// Merge OSM-surveyed plants (scripts/osm-plant-coords.json) — PRECISE coords for
// the major CEB stations the NCRE book omits + many private plants. approx:false.
const osmPath = path.join(__dirname, 'osm-plant-coords.json')
let osmAdded = 0
if (fs.existsSync(osmPath)) {
  for (const p of JSON.parse(fs.readFileSync(osmPath, 'utf8'))) {
    const key = norm(p.name)
    if (!key || knownNames.has(key)) continue
    knownNames.add(key)
    features.push({
      type: 'Feature',
      properties: {
        name: p.name,
        segment: p.segment,
        capMw: typeof p.capMw === 'number' ? p.capMw : null,
        approx: false,
        source: p.source ?? 'OpenStreetMap',
      },
      geometry: { type: 'Point', coordinates: [p.lon, p.lat] },
    })
    osmAdded += 1
  }
}

// Merge agent-geocoded CEB NCRE plants (scripts/ceb-plant-coords.json). These are
// TOWN/LOCALITY level, not plant-precise, so they carry approx:true + confidence;
// the map renders them as hollow low-opacity dots so they don't read as surveyed
// points. Skip any whose name already matches a precise (CSE or OSM) plant above.
const cebPath = path.join(__dirname, 'ceb-plant-coords.json')
let cebAdded = 0
if (fs.existsSync(cebPath)) {
  for (const p of JSON.parse(fs.readFileSync(cebPath, 'utf8'))) {
    const key = norm(p.name)
    if (!key || knownNames.has(key)) continue
    knownNames.add(key)
    features.push({
      type: 'Feature',
      properties: {
        name: p.name,
        segment: p.segment,
        capMw: typeof p.capMw === 'number' ? p.capMw : null,
        approx: true,
        confidence: p.confidence ?? null,
        source: p.source ?? null,
      },
      geometry: { type: 'Point', coordinates: [p.lon, p.lat] },
    })
    cebAdded += 1
  }
}

const bySeg = features.reduce((a, f) => ((a[f.properties.segment] = (a[f.properties.segment] || 0) + 1), a), {})
const approxCount = features.filter((f) => f.properties.approx).length
fs.writeFileSync(outPath, JSON.stringify({ type: 'FeatureCollection', features }))
console.log(`plants: ${features.length} (${features.length - approxCount} precise [+${osmAdded} OSM], ${cebAdded} approx CEB)`, JSON.stringify(bySeg), '->', outPath)
