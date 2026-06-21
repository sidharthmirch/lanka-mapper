/**
 * Snapshot the DCS National Data Archive (NADA) catalog into a local "db"
 * (public/data/nada-catalog.json) that the app serves, instead of depending on
 * nada.statistics.gov.lk being up at request time.
 *
 * The NADA REST API is CORS-open, so the browser CAN fetch it directly (that's
 * the runtime fallback), but this baked snapshot is the primary source — built
 * server-side (headless / CI) and committed, like the CEB snapshot.
 *
 * Usage: node scripts/build-nada-catalog.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import https from 'node:https'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const outPath = path.join(__dirname, '..', 'public/data/nada-catalog.json')
const API = 'https://nada.statistics.gov.lk/index.php/api/catalog/search?ps=2000'

function getJson(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, { headers: { 'User-Agent': 'lanka-mapper/1.0 (open-data map)', Accept: 'application/json' } }, (res) => {
        let body = ''
        res.on('data', (c) => (body += c))
        res.on('end', () => (res.statusCode === 200 ? resolve(JSON.parse(body)) : reject(new Error('HTTP ' + res.statusCode))))
      })
      .on('error', reject)
  })
}

const json = await getJson(API)
const rows = json?.result?.rows ?? json?.rows ?? []
if (!Array.isArray(rows) || rows.length === 0) throw new Error('NADA catalog returned no studies')

// Keep the fields the archive browser needs (same shape as the live API rows).
const studies = rows.map((s) => ({
  id: String(s.id),
  idno: s.idno ?? '',
  title: (s.title ?? '').trim(),
  authoring_entity: (s.authoring_entity ?? '').trim() || null,
  year_start: s.year_start ?? null,
  year_end: s.year_end ?? null,
  type: s.type ?? 'survey',
  url: s.url || `https://nada.statistics.gov.lk/index.php/catalog/${s.id}`,
  total_downloads: Number(s.total_downloads) || 0,
}))

const out = {
  source: 'DCS National Data Archive (nada.statistics.gov.lk)',
  fetchedAt: new Date().toISOString(),
  total: studies.length,
  studies,
}

// Skip rewriting when nothing changed (avoid churn from the fetchedAt timestamp).
try {
  const prev = JSON.parse(fs.readFileSync(outPath, 'utf8'))
  const same = prev.total === out.total && JSON.stringify(prev.studies) === JSON.stringify(out.studies)
  if (same) {
    console.log(`NADA catalog unchanged (${out.total} studies); leaving snapshot in place.`)
    process.exit(0)
  }
} catch {
  // no existing snapshot
}

fs.writeFileSync(outPath, JSON.stringify(out, null, 2) + '\n')
console.log(`NADA catalog: ${out.total} studies -> ${outPath}`)
