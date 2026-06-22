/**
 * Build curated "local" datasets from data.gov.lk + CBSL into the app's
 * LocalDataFile format under public/data/local/, and assemble the manifest.
 *
 * These are district/province aggregates the LDFLK + nuuuwan parents lack
 * (census population, literacy, poverty, crime, …). data.gov.lk's TLS cert is
 * EXPIRED, so fetch with rejectUnauthorized:false here at build time; the
 * repo-baked static files are unaffected at app runtime.
 *
 * Each dataset: parse -> { level, unit, metrics, valuesByLocation: loc->year->metric->number }.
 * Location names stay raw; the app canonicalizes via normalizeDistrict/Province.
 *
 * Usage: node scripts/build-local-datasets.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import https from 'node:https'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const OUT_DIR = path.join(__dirname, '..', 'public/data/local')
fs.mkdirSync(OUT_DIR, { recursive: true })

function fetchText(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, { headers: { 'User-Agent': 'lanka-mapper/1.0' }, rejectUnauthorized: false }, (res) => {
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          return resolve(fetchText(res.headers.location))
        }
        if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode} for ${url}`))
        let body = ''
        res.on('data', (c) => (body += c))
        res.on('end', () => resolve(body))
      })
      .on('error', reject)
  })
}

/** Minimal CSV line splitter (handles double-quoted fields with commas). */
function splitCsvLine(line) {
  const out = []
  let cur = ''
  let q = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (q && line[i + 1] === '"') { cur += '"'; i++ } else q = !q
    } else if (ch === ',' && !q) {
      out.push(cur); cur = ''
    } else cur += ch
  }
  out.push(cur)
  return out.map((s) => s.trim())
}

function cleanDistrict(name) {
  return name
    .replace(/\s*-\s*/g, ' ') // "Nuwara - Eliya" -> "Nuwara Eliya"
    .replace(/\s*\([^)]*\)/g, '') // strip parenthetical notes
    .replace(/\s+/g, ' ')
    .trim()
}

const num = (v) => {
  const n = Number(String(v).replace(/,/g, '').trim())
  return Number.isFinite(n) ? n : null
}

// ---------------------------------------------------------------------------
// Datasets
// ---------------------------------------------------------------------------

const datasets = []

// 1) Population by District, census years 1871-2012 (values are in thousands)
datasets.push({
  manifest: {
    id: 'population-by-district-census',
    name: 'Population by District (Census)',
    description: 'Total population by district across census years 1871–2012.',
    secondarySource: 'Dept. of Census & Statistics',
    unit: 'persons',
    level: 'district',
    metrics: ['Value'],
    citation: 'Department of Census and Statistics, Sri Lanka (via data.gov.lk)',
    citationUrl: 'https://data.gov.lk/dataset/population-district-census-years',
    tags: ['local', 'census', 'population', 'district'],
  },
  async parse() {
    const csv = await fetchText('https://data.gov.lk/sites/default/files/population_by_district_in_census_years.csv')
    const lines = csv.split(/\r?\n/).filter((l) => l.trim())
    const header = splitCsvLine(lines[0])
    const years = header.slice(1).map((y) => y.trim()).filter((y) => /^\d{4}$/.test(y))
    const valuesByLocation = {}
    for (const line of lines.slice(1)) {
      const cols = splitCsvLine(line)
      const district = cleanDistrict(cols[0])
      if (!district || /total|all island|sri lanka/i.test(district)) continue
      const byYear = {}
      years.forEach((year, i) => {
        const v = num(cols[i + 1])
        if (v !== null && v > 0) byYear[year] = { Value: Math.round(v * 1000) } // thousands -> persons
      })
      if (Object.keys(byYear).length) valuesByLocation[district] = byYear
    }
    return { level: 'district', unit: 'persons', metrics: ['Value'], valuesByLocation }
  },
})

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------

const manifest = []
for (const ds of datasets) {
  try {
    const dataFile = await ds.parse()
    const locations = Object.keys(dataFile.valuesByLocation).length
    if (locations === 0) throw new Error('no locations parsed')
    const years = [...new Set(Object.values(dataFile.valuesByLocation).flatMap((b) => Object.keys(b)))]
      .map(Number).filter(Number.isFinite).sort((a, b) => a - b)
    fs.writeFileSync(path.join(OUT_DIR, `${ds.manifest.id}.json`), JSON.stringify(dataFile))
    manifest.push({
      ...ds.manifest,
      source: 'local',
      path: `local:${ds.manifest.id}`,
      years,
      defaultMetric: ds.manifest.metrics[0],
      hasGeo: dataFile.level !== 'national',
      hasTime: years.length > 1,
    })
    console.log(`✓ ${ds.manifest.id}: ${locations} locations, years ${years[0]}–${years[years.length - 1]}`)
  } catch (e) {
    console.error(`✗ ${ds.manifest.id}: ${e.message}`)
  }
}

fs.writeFileSync(path.join(OUT_DIR, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n')
console.log(`\nwrote manifest with ${manifest.length} local dataset(s) -> public/data/local/manifest.json`)
