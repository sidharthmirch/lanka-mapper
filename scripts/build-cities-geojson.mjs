/**
 * Build the "city" (Local Government) boundary layer for the admin-level heat
 * toggle, from nuuuwan/lk_admin_regions (e2_tiny resolution). LG areas are Sri
 * Lanka's Municipal Councils, Urban Councils and Pradeshiya Sabhas — the closest
 * thing to named towns/cities with official boundaries (358 of them).
 *
 * Each feature is stamped with its parent `district` and `province` using the
 * app's canonical names, so the map can inherit a city's value from its parent
 * district (the store already expands province datasets down to districts, so a
 * single districtDataMap lookup covers both dataset kinds).
 *
 * Usage:
 *   git clone --filter=blob:none --no-checkout --depth 1 \
 *     https://github.com/nuuuwan/lk_admin_regions /tmp/lk_admin_regions
 *   cd /tmp/lk_admin_regions && git sparse-checkout init --no-cone \
 *     && git sparse-checkout set \
 *        data/geo/geojson/e2_tiny/lgs.geojson \
 *        data/geo/geojson/e2_tiny/districts.geojson \
 *        data/geo/geojson/e2_tiny/provinces.geojson && git checkout
 *   node scripts/build-cities-geojson.mjs /tmp/lk_admin_regions/data/geo/geojson/e2_tiny
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { simplify } from '@turf/turf'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const SRC = process.argv[2]
  || process.env.ADMIN_SRC
  || '/tmp/lk_admin_regions/data/geo/geojson/e2_tiny'
const SIMPLIFY_TOL = Number(process.env.SIMPLIFY_TOL || 0.0012)
const PRECISION = Number(process.env.PRECISION || 4)

const outPath = path.join(__dirname, '..', 'public/data/sri-lanka-cities.geojson')

/** nuuuwan spells one district differently from the app's geojson. */
const DISTRICT_NAME_FIX = { Monaragala: 'Moneragala' }

const read = (name) => JSON.parse(fs.readFileSync(path.join(SRC, `${name}.geojson`), 'utf8'))
const lgs = read('lgs')
const districts = read('districts')
const provinces = read('provinces')

// id → canonical name. Districts match the app already (bar one spelling); the
// app names provinces "X Province", nuuuwan names them "X".
const districtName = new Map(
  districts.features.map((f) => {
    const n = f.properties.name
    return [f.properties.id, DISTRICT_NAME_FIX[n] ?? n]
  }),
)
const provinceName = new Map(
  provinces.features.map((f) => [f.properties.id, `${f.properties.name} Province`]),
)

const round = (pt) => [Number(pt[0].toFixed(PRECISION)), Number(pt[1].toFixed(PRECISION))]
function roundGeometry(geom) {
  if (geom.type === 'Polygon') {
    return { type: 'Polygon', coordinates: geom.coordinates.map((ring) => ring.map(round)) }
  }
  return {
    type: 'MultiPolygon',
    coordinates: geom.coordinates.map((poly) => poly.map((ring) => ring.map(round))),
  }
}

const features = []
let skipped = 0
for (const f of lgs.features) {
  const p = f.properties || {}
  const district = districtName.get(p.district_id)
  const province = provinceName.get(p.province_id)
  if (!district || !province) {
    skipped += 1
    continue
  }

  // Some LG rings are tiny enough that DP simplification degenerates them;
  // fall back to the original geometry rather than dropping the city.
  let geom = f.geometry
  try {
    geom = simplify(
      { type: 'Feature', properties: {}, geometry: f.geometry },
      { tolerance: SIMPLIFY_TOL, highQuality: false, mutate: false },
    ).geometry
  } catch {
    geom = f.geometry
  }
  features.push({
    type: 'Feature',
    properties: { name: p.name, district, province },
    geometry: roundGeometry(geom),
  })
}

const out = { type: 'FeatureCollection', features }
fs.writeFileSync(outPath, JSON.stringify(out))

console.log(`source: ${SRC} (${lgs.features.length} LG areas)`)
console.log(`wrote ${features.length} cities${skipped ? ` (${skipped} skipped: no parent)` : ''}`)
console.log(`-> ${outPath} (${(fs.statSync(outPath).size / 1024).toFixed(0)} KB)`)
