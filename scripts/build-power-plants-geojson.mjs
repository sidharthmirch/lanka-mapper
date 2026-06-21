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
    },
    geometry: { type: 'Point', coordinates: [lon, lat] },
  })
}

const bySeg = features.reduce((a, f) => ((a[f.properties.segment] = (a[f.properties.segment] || 0) + 1), a), {})
fs.writeFileSync(outPath, JSON.stringify({ type: 'FeatureCollection', features }))
console.log(`plants: ${features.length}`, JSON.stringify(bySeg), '->', outPath)
