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

// Map data.gov.lk spelling variants to names normalizeDistrict canonicalizes.
const DISTRICT_SPELLING = {
  hambanthota: 'Hambantota',
  puttlam: 'Puttalam',
  mulativ: 'Mullaitivu',
  mullativu: 'Mullaitivu',
  monaragala: 'Moneragala',
  kilinochchiya: 'Kilinochchi',
}

function cleanDistrict(name) {
  const base = (name || '')
    .replace(/\s*-\s*/g, ' ') // "Nuwara - Eliya" -> "Nuwara Eliya"
    .replace(/\s*\([^)]*\)/g, '') // strip parenthetical division notes
    .replace(/\s+/g, ' ')
    .trim()
  return DISTRICT_SPELLING[base.toLowerCase()] ?? base
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

// 2) Literacy rate (age 15+) by district, 2012. CSV: province,district,value.
datasets.push({
  manifest: {
    id: 'literacy-rate-by-district',
    name: 'Literacy Rate by District',
    description: 'Adult (age 15 and above) literacy rate by district, 2012.',
    secondarySource: 'Dept. of Census & Statistics',
    unit: '%',
    level: 'district',
    metrics: ['Value'],
    citation: 'Department of Census and Statistics, Sri Lanka (via data.gov.lk)',
    citationUrl: 'https://data.gov.lk/dataset/literacy-rate-age-15-above',
    tags: ['local', 'literacy', 'education', 'district'],
  },
  async parse() {
    const csv = await fetchText('https://data.gov.lk/sites/default/files/literacy_rate_by_age_15_%26_above.csv')
    const lines = csv.split(/\r?\n/).filter((l) => l.trim())
    const valuesByLocation = {}
    for (const line of lines) {
      const c = splitCsvLine(line)
      const district = cleanDistrict(c[1] || '')
      if (!district || /total|all island|sri lanka/i.test(district)) continue
      const v = num(c[2])
      if (v !== null && v > 0) valuesByLocation[district] = { 2012: { Value: v } }
    }
    return { level: 'district', unit: '%', metrics: ['Value'], valuesByLocation }
  },
})

// 3) Provincial GDP by industrial origin (Rs. Mn), 2006-2011. Sector = metric.
datasets.push({
  manifest: {
    id: 'province-gdp-by-sector',
    name: 'Provincial GDP by Sector',
    description: 'Provincial gross domestic product by industrial origin (Rs. Mn), 2006–2011.',
    secondarySource: 'Dept. of Census & Statistics',
    unit: 'Rs. Mn',
    level: 'province',
    metrics: ['Total', 'Agriculture', 'Industry', 'Services'],
    citation: 'Department of Census and Statistics, Sri Lanka (via data.gov.lk)',
    citationUrl: 'https://data.gov.lk/dataset/province-wise-gross-domestic-production-2006-2012',
    tags: ['local', 'gdp', 'economy', 'province'],
  },
  async parse() {
    const csv = await fetchText('https://data.gov.lk/sites/default/files/gdp.csv')
    const lines = csv.split(/\r?\n/).filter((l) => l.trim())
    const header = splitCsvLine(lines[0])
    const years = header.slice(1).filter((y) => /^\d{4}$/.test(y))
    const valuesByLocation = {}
    for (const line of lines.slice(1)) {
      const c = splitCsvLine(line)
      const m = c[0].match(/^(.+?)\s+Province\s+(Agriculture|Industry|Services)/i)
      if (!m) continue
      const province = m[1].trim()
      const sector = m[2][0].toUpperCase() + m[2].slice(1).toLowerCase()
      valuesByLocation[province] ||= {}
      years.forEach((yr, i) => {
        const v = num(c[i + 1])
        if (v === null) return
        valuesByLocation[province][yr] ||= {}
        valuesByLocation[province][yr][sector] = Math.round(v)
      })
    }
    for (const byYear of Object.values(valuesByLocation)) {
      for (const yr of Object.values(byYear)) {
        const t = (yr.Agriculture || 0) + (yr.Industry || 0) + (yr.Services || 0)
        if (t > 0) yr.Total = t
      }
    }
    return { level: 'province', unit: 'Rs. Mn', metrics: ['Total', 'Agriculture', 'Industry', 'Services'], valuesByLocation }
  },
})

// 4) Crime by district, 2010-2012. TRANSPOSED (districts as columns) -> pivot.
//    Crime category = metric; 'Total' = sum of categories.
datasets.push({
  manifest: {
    id: 'crime-by-district',
    name: 'Crime by District',
    description: 'Reported grave crimes by category and district, 2010–2012.',
    secondarySource: 'Sri Lanka Police via Dept. of Census & Statistics',
    unit: 'incidents',
    level: 'district',
    metrics: ['Total'],
    citation: 'Sri Lanka Police (via data.gov.lk)',
    citationUrl: 'https://data.gov.lk/dataset/crime-data-2010-2012',
    tags: ['local', 'crime', 'police', 'district'],
  },
  async parse() {
    const base = 'https://data.gov.lk/sites/default/files/Crime_data_'
    const valuesByLocation = {}
    const categories = new Set()
    for (const year of ['2010', '2011', '2012']) {
      let csv
      try { csv = await fetchText(`${base}${year}.csv`) } catch { continue }
      const lines = csv.split(/\r?\n/).filter((l) => l.trim())
      const districts = splitCsvLine(lines[0]).slice(1).map(cleanDistrict)
      for (const line of lines.slice(1)) {
        const c = splitCsvLine(line)
        const cat = (c[0] || '').replace(/\s+/g, ' ').trim()
        if (!cat || /^total/i.test(cat)) continue
        categories.add(cat)
        districts.forEach((d, i) => {
          const v = num(c[i + 1])
          if (v === null || !d) return
          valuesByLocation[d] ||= {}
          valuesByLocation[d][year] ||= {}
          valuesByLocation[d][year][cat] = (valuesByLocation[d][year][cat] || 0) + v
        })
      }
    }
    for (const byYear of Object.values(valuesByLocation)) {
      for (const yr of Object.values(byYear)) {
        yr.Total = Object.values(yr).reduce((a, b) => a + b, 0)
      }
    }
    const metrics = ['Total', ...[...categories].sort()]
    return { level: 'district', unit: 'incidents', metrics, valuesByLocation }
  },
})

// 5) Road-accident casualties by district + severity, 2010-2012 (merge siblings).
datasets.push({
  manifest: {
    id: 'road-accidents-by-district',
    name: 'Road Accident Casualties by District',
    description: 'Road-accident casualties by severity and district, 2010–2012.',
    secondarySource: 'Sri Lanka Police via Dept. of Census & Statistics',
    unit: 'casualties',
    level: 'district',
    metrics: ['Total', 'Deaths', 'Grievous Injury', 'Non Grievous Injury'],
    citation: 'Sri Lanka Police (via data.gov.lk)',
    citationUrl: 'https://data.gov.lk/dataset/road-accident-data-severity-injuries-2012',
    tags: ['local', 'road', 'accidents', 'safety', 'district'],
  },
  async parse() {
    const base = 'https://data.gov.lk/sites/default/files/road_accident_data_by_severity_of_injuries_'
    const valuesByLocation = {}
    for (const year of ['2010', '2011', '2012']) {
      let csv
      try { csv = await fetchText(`${base}${year}.csv`) } catch { continue }
      const lines = csv.split(/\r?\n/).filter((l) => l.trim())
      for (const line of lines.slice(1)) {
        const c = splitCsvLine(line)
        const d = cleanDistrict(c[0])
        if (!d || /total|all island|sri lanka/i.test(d)) continue
        const deaths = (num(c[1]) || 0) + (num(c[2]) || 0)
        const grievous = (num(c[3]) || 0) + (num(c[4]) || 0)
        const nonGrievous = (num(c[5]) || 0) + (num(c[6]) || 0)
        const total = num(c[7]) ?? deaths + grievous + nonGrievous
        valuesByLocation[d] ||= {}
        const cur = valuesByLocation[d][year] || { Total: 0, Deaths: 0, 'Grievous Injury': 0, 'Non Grievous Injury': 0 }
        cur.Total += total
        cur.Deaths += deaths
        cur['Grievous Injury'] += grievous
        cur['Non Grievous Injury'] += nonGrievous
        valuesByLocation[d][year] = cur
      }
    }
    return { level: 'district', unit: 'casualties', metrics: ['Total', 'Deaths', 'Grievous Injury', 'Non Grievous Injury'], valuesByLocation }
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
