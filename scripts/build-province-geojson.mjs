/**
 * One-off / rebuild: merge district polygons into province MultiPolygons.
 * Run: node scripts/build-province-geojson.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import * as turf from '@turf/turf'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const DISTRICT_TO_PROVINCE = {
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

const root = path.join(__dirname, '..')
const inPath = path.join(root, 'public/data/sri-lanka-districts.geojson')
const outPath = path.join(root, 'public/data/sri-lanka-provinces.geojson')

const collection = JSON.parse(fs.readFileSync(inPath, 'utf8'))

/** @type {Record<string, import('geojson').Feature[]>} */
const byProvince = {}

for (const f of collection.features) {
  const name = f.properties?.name
  if (!name) continue
  const province = DISTRICT_TO_PROVINCE[name]
  if (!province) {
    console.warn('No province mapping for district:', name)
    continue
  }
  const flat = turf.flatten(f)
  for (const sub of flat.features) {
    const g = sub.geometry
    if (g.type !== 'Polygon' && g.type !== 'MultiPolygon') continue
    if (!byProvince[province]) byProvince[province] = []
    byProvince[province].push(turf.feature(g, { name: province }))
  }
}

const outFeatures = []

for (const [province, feats] of Object.entries(byProvince)) {
  if (feats.length === 0) continue
  let merged
  if (feats.length === 1) {
    merged = feats[0]
  } else {
    merged = turf.union(turf.featureCollection(feats))
  }
  if (!merged) continue
  merged.properties = { name: province }
  outFeatures.push(merged)
}

const out = turf.featureCollection(outFeatures)
fs.writeFileSync(outPath, JSON.stringify(out))
console.log('Wrote', outPath, 'provinces:', outFeatures.length)
