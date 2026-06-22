/**
 * Precise power-plant coordinates from OpenStreetMap (power=plant / power=generator),
 * the authoritative surveyed source. Covers the major CEB-owned stations the NCRE
 * generation book omits (Lakvijaya, Victoria, Kotmale, Kerawalapitiya, Kelanitissa,
 * the big hydros …) plus precise locations for many private plants.
 *
 * These are real surveyed points (approx:false in the map) and take precedence over
 * the agent town-level coordinates in ceb-plant-coords.json.
 *
 * Usage (refresh):
 *   Q='[out:json][timeout:120];
 *      ( nwr["power"="plant"](5.8,79.5,10.0,82.0);
 *        nwr["power"="generator"](5.8,79.5,10.0,82.0); );
 *      out center tags;'
 *   curl -s --data-urlencode "data=$Q" \
 *     https://maps.mail.ru/osm/tools/overpass/api/interpreter -o /tmp/osm_plants.json
 *   node scripts/build-osm-plant-coords.mjs /tmp/osm_plants.json
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const SRC = process.argv[2] || '/tmp/osm_plants.json'
const outPath = path.join(__dirname, 'osm-plant-coords.json')

/** Generic / sub-unit OSM names that aren't a distinct, labellable plant. */
const JUNK = /^(unit\s*\d|gt\s*\d|mini\s+(power|hydro|turbine|water)|mini\s+hydropower|labs|maskelioya)\b/i

/** OSM source tag → our map segment. */
const SEG = {
  hydro: 'hydro', solar: 'solar', wind: 'wind',
  biomass: 'biomass', biogas: 'biomass', biofuel: 'biomass', waste: 'biomass',
  coal: 'coal', oil: 'oil', diesel: 'oil', gas: 'oil',
}

/** "900 MW" | "10500 kW" | "3.5 MW" | "yes" → MW number or null. */
function parseCap(raw) {
  if (!raw) return null
  const m = String(raw).match(/([\d.]+)\s*(kW|MW|GW)?/i)
  if (!m) return null
  const v = Number(m[1])
  if (!Number.isFinite(v)) return null
  const unit = (m[2] || 'MW').toLowerCase()
  const mw = unit === 'kw' ? v / 1000 : unit === 'gw' ? v * 1000 : v
  return Number(mw.toFixed(3))
}

const data = JSON.parse(fs.readFileSync(SRC, 'utf8'))
const seen = new Set()
const plants = []
for (const e of data.elements || []) {
  const t = e.tags || {}
  const name = (t.name || t['name:en'] || '').trim()
  if (!name || JUNK.test(name)) continue
  const lat = e.lat ?? e.center?.lat
  const lon = e.lon ?? e.center?.lon
  if (typeof lat !== 'number' || typeof lon !== 'number') continue
  const key = name.toLowerCase()
  if (seen.has(key)) continue
  seen.add(key)
  const src = t['plant:source'] || t['generator:source'] || ''
  plants.push({
    name,
    lat: Number(lat.toFixed(5)),
    lon: Number(lon.toFixed(5)),
    segment: SEG[src] || 'other',
    capMw: parseCap(t['plant:output:electricity'] || t['generator:output:electricity']),
    source: 'OpenStreetMap',
    confidence: 'high',
  })
}

fs.writeFileSync(outPath, JSON.stringify(plants, null, 0))
const seg = plants.reduce((a, p) => ((a[p.segment] = (a[p.segment] || 0) + 1), a), {})
console.log(`OSM precise plants: ${plants.length} ${JSON.stringify(seg)}`)
console.log(`-> ${outPath}`)
