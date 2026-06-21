/**
 * Snapshot Sri Lanka's live(ish) electricity generation mix from the CEB
 * Generation Summary (edlcare.edl.lk/gensum) into public/data/ceb-generation.json.
 *
 * A static site can't fetch this in-browser (no CORS), so this runs server-side
 * on a schedule (GitHub Action, or the headless box) and commits the snapshot;
 * the map reads the baked file and shows "as of <time>". CEB publishes with ~a
 * day's lag, so we request today and take the latest available 15-min interval.
 *
 * Usage: node scripts/build-ceb-generation.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import https from 'node:https'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const outPath = path.join(__dirname, '..', 'public/data/ceb-generation.json')
const BASE = 'https://edlcare.edl.lk'

// fuel column -> display, color (matches plant/segment palette), clean flag
const SOURCES = [
  { key: 'Major Hydro', label: 'Major hydro', color: '#4ea3d1', clean: true },
  { key: 'SPP Minihydro', label: 'Mini hydro', color: '#5fa8d3', clean: true },
  { key: 'Wind', label: 'Wind', color: '#6fcf97', clean: true },
  { key: 'Solar', label: 'Solar', color: '#f2c14e', clean: true },
  { key: 'SPP Biomass', label: 'Biomass', color: '#8a6d3b', clean: true },
  { key: 'Coal', label: 'Coal', color: '#8a8f98', clean: false },
  { key: 'Thermal-Oil', label: 'Oil', color: '#b3553a', clean: false },
]

function getJson(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, { headers: { 'User-Agent': 'lanka-mapper/1.0 (open-data map)', Accept: 'application/json' } }, (res) => {
        let body = ''
        res.on('data', (c) => (body += c))
        res.on('end', () => {
          if (res.statusCode !== 200) return reject(new Error('HTTP ' + res.statusCode))
          try {
            resolve(JSON.parse(body))
          } catch (e) {
            reject(e)
          }
        })
      })
      .on('error', reject)
  })
}

/** Sri Lanka local date (UTC+5:30) as YYYY-MM-DD. */
function slDate(offsetDays = 0) {
  const ms = Date.now() + 5.5 * 3600 * 1000 + offsetDays * 86400 * 1000
  return new Date(ms).toISOString().slice(0, 10)
}

function rowTotal(row) {
  return SOURCES.reduce((s, src) => s + (Number(row[src.key]) || 0), 0)
}

// Find the latest curve with real data: try today, then yesterday.
let curve = []
for (const offset of [0, -1, -2]) {
  const data = await getJson(`${BASE}/api/gensum/load-curve?date=${slDate(offset)}`).catch(() => [])
  if (Array.isArray(data) && data.some((r) => rowTotal(r) > 1)) {
    curve = data.filter((r) => rowTotal(r) > 1)
    break
  }
}
if (curve.length === 0) throw new Error('No CEB load-curve data available')

const latest = curve[curve.length - 1]
const totalMW = rowTotal(latest)
const sources = SOURCES.map((src) => {
  const mw = Number(latest[src.key]) || 0
  return { name: src.key, label: src.label, color: src.color, clean: src.clean, mw: Math.round(mw * 10) / 10, pct: totalMW ? Math.round((mw / totalMW) * 1000) / 10 : 0 }
}).sort((a, b) => b.mw - a.mw)

const cleanMW = sources.filter((s) => s.clean).reduce((s, x) => s + x.mw, 0)

const out = {
  fetchedAt: new Date().toISOString(),
  asOf: latest.DateTime, // Sri Lanka local time
  source: 'CEB Generation Summary (edlcare.edl.lk/gensum)',
  totalMW: Math.round(totalMW * 10) / 10,
  cleanPct: totalMW ? Math.round((cleanMW / totalMW) * 1000) / 10 : 0,
  sources,
}

fs.writeFileSync(outPath, JSON.stringify(out, null, 2) + '\n')
console.log(`CEB mix as of ${out.asOf}: ${out.totalMW} MW, ${out.cleanPct}% clean -> ${outPath}`)
console.log(sources.map((s) => `${s.label} ${s.mw}MW (${s.pct}%)`).join(', '))
