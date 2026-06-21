/**
 * Build a compact rivers overlay for the map from nuuuwan/lk_rivers (HydroRIVERS).
 *
 * lk_rivers ships ~181 per-reach GeoJSON files (7.9MB) with HydroRIVERS
 * attributes. We keep only the significant rivers (Strahler stream order >= MIN_ORDER),
 * merge them into one FeatureCollection of LineStrings carrying a single `ord`
 * property (drives line weight), and write a small file. Run mapshaper -simplify
 * on the output afterward to shrink further.
 *
 * Usage:
 *   git clone --depth 1 https://github.com/nuuuwan/lk_rivers /tmp/lk_rivers
 *   node scripts/build-rivers-geojson.mjs /tmp/lk_rivers/data/rivers
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const SRC = process.argv[2] || process.env.RIVERS_SRC || '/tmp/lk_rivers/data/rivers'
const MIN_ORDER = Number(process.env.MIN_ORDER || 4)
const outPath = path.join(__dirname, '..', 'public/data/sri-lanka-rivers.geojson')

const files = fs.readdirSync(SRC).filter((f) => f.endsWith('.geojson'))
const features = []
const orderHist = {}

for (const file of files) {
  const fc = JSON.parse(fs.readFileSync(path.join(SRC, file), 'utf8'))
  const feats = fc.type === 'FeatureCollection' ? fc.features : [fc]
  for (const f of feats) {
    const g = f.geometry
    if (!g || (g.type !== 'LineString' && g.type !== 'MultiLineString')) continue
    const ord = Number(f.properties?.ORD_STRA ?? 0)
    orderHist[ord] = (orderHist[ord] || 0) + 1
    if (ord < MIN_ORDER) continue
    features.push({ type: 'Feature', properties: { ord }, geometry: g })
  }
}

const out = { type: 'FeatureCollection', features }
fs.writeFileSync(outPath, JSON.stringify(out))
console.log('stream-order histogram:', JSON.stringify(orderHist))
console.log(`kept ${features.length} reaches (ORD_STRA >= ${MIN_ORDER}) -> ${outPath}`)
