/**
 * One-off cleaner: take the agent-geocoded CEB plant coordinates (/tmp/ceb_geo_all.json,
 * the union of the haiku-agent batches) and produce a committed, sanity-filtered
 * coordinate file for the map.
 *
 * IMPORTANT: these coordinates are TOWN / LOCALITY level, not plant-precise. The
 * agents resolved most plants only to their named town (many plants in one town
 * therefore share a coordinate). We keep that but mark every entry approx:true so
 * the map can render them distinctly and the tooltip can disclose confidence.
 *
 * Filters applied:
 *  - keep confidence high|medium (drop the most-inferred "low")
 *  - drop country-centre defaults (within ~0.12° of 7.87,80.77 — an agent fallback)
 *  - drop wind plants placed inland (lon > 80.2): Sri Lanka's utility wind is the
 *    Puttalam/Mannar west coast, so inland wind coords are misplacements
 *  - jitter exact-duplicate coordinates in a small deterministic ring so stacked
 *    town-centroid plants render as separate dots near the town
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const src = JSON.parse(fs.readFileSync('/tmp/ceb_geo_all.json', 'utf8'))
const outPath = path.join(__dirname, 'ceb-plant-coords.json')

const nearCenter = (p) => Math.abs(p.lat - 7.87) < 0.12 && Math.abs(p.lon - 80.77) < 0.12
const kept = src.filter((p) => (
  (p.confidence === 'high' || p.confidence === 'medium')
  && !nearCenter(p)
  && !(p.segment === 'wind' && p.lon > 80.2)
))

// Jitter exact-duplicate coords (town centroids shared by many plants) so they
// don't render on top of each other — small ring, deterministic by occurrence.
const seen = new Map()
const jittered = kept.map((p) => {
  const key = `${p.lat.toFixed(3)},${p.lon.toFixed(3)}`
  const n = seen.get(key) ?? 0
  seen.set(key, n + 1)
  if (n === 0) return p
  const angle = (n * 2.39996) // golden angle, spreads points in a spiral
  const r = 0.012 + 0.004 * n // ~1.3km steps outward
  return {
    ...p,
    lat: Number((p.lat + r * Math.sin(angle)).toFixed(5)),
    lon: Number((p.lon + r * Math.cos(angle)).toFixed(5)),
  }
})

fs.writeFileSync(outPath, JSON.stringify(jittered, null, 0))
const conf = jittered.reduce((a, p) => { a[p.confidence] = (a[p.confidence] || 0) + 1; return a }, {})
const seg = jittered.reduce((a, p) => { a[p.segment] = (a[p.segment] || 0) + 1; return a }, {})
console.log(`kept ${jittered.length} of ${src.length} (confidence ${JSON.stringify(conf)}, segment ${JSON.stringify(seg)})`)
console.log(`-> ${outPath}`)
