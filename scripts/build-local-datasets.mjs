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
import zlib from 'node:zlib'
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
  if (v === null || v === undefined || v === '' || v === '-') return null
  const n = Number(String(v).replace(/,/g, '').trim())
  return Number.isFinite(n) ? n : null
}

// Canonical 25 districts — used to keep only district rows (the source XLSX
// files mix in 'Sri Lanka', province subtotals, and sector rows).
const DISTRICTS = new Set(
  [
    'Colombo', 'Gampaha', 'Kalutara', 'Kandy', 'Matale', 'Nuwara Eliya', 'Galle', 'Matara',
    'Hambantota', 'Jaffna', 'Kilinochchi', 'Mannar', 'Vavuniya', 'Mullaitivu', 'Batticaloa',
    'Ampara', 'Trincomalee', 'Kurunegala', 'Puttalam', 'Anuradhapura', 'Polonnaruwa', 'Badulla',
    'Moneragala', 'Ratnapura', 'Kegalle',
  ].map((d) => d.toLowerCase()),
)
const isDistrict = (name) => DISTRICTS.has(cleanDistrict(name).toLowerCase())

// ---- Minimal zero-dependency XLSX reader (ZIP + sharedStrings + sheet XML) ----

function fetchBuffer(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, { headers: { 'User-Agent': 'lanka-mapper/1.0' }, rejectUnauthorized: false }, (res) => {
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          return resolve(fetchBuffer(res.headers.location))
        }
        if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode} for ${url}`))
        const chunks = []
        res.on('data', (c) => chunks.push(c))
        res.on('end', () => resolve(Buffer.concat(chunks)))
      })
      .on('error', reject)
  })
}

function unzip(buf) {
  let i = buf.length - 22
  while (i >= 0 && buf.readUInt32LE(i) !== 0x06054b50) i--
  if (i < 0) throw new Error('not a zip')
  const count = buf.readUInt16LE(i + 10)
  let p = buf.readUInt32LE(i + 16)
  const files = {}
  for (let n = 0; n < count; n++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) break
    const method = buf.readUInt16LE(p + 10)
    const compSize = buf.readUInt32LE(p + 20)
    const nameLen = buf.readUInt16LE(p + 28)
    const extraLen = buf.readUInt16LE(p + 30)
    const commentLen = buf.readUInt16LE(p + 32)
    const lho = buf.readUInt32LE(p + 42)
    const name = buf.toString('utf8', p + 46, p + 46 + nameLen)
    const lNameLen = buf.readUInt16LE(lho + 26)
    const lExtraLen = buf.readUInt16LE(lho + 28)
    const dataStart = lho + 30 + lNameLen + lExtraLen
    const raw = buf.subarray(dataStart, dataStart + compSize)
    files[name] = method === 8 ? zlib.inflateRawSync(raw) : Buffer.from(raw)
    p += 46 + nameLen + extraLen + commentLen
  }
  return files
}

const decodeXml = (s) =>
  s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&amp;/g, '&')

function parseSharedStrings(xml) {
  const out = []
  const re = /<si>([\s\S]*?)<\/si>/g
  let m
  while ((m = re.exec(xml))) {
    const ts = [...m[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((x) => decodeXml(x[1]))
    out.push(ts.join(''))
  }
  return out
}

function colIndex(ref) {
  const letters = ref.match(/^[A-Z]+/)[0]
  let n = 0
  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64)
  return n - 1
}

function parseSheet(xml, shared) {
  const rows = []
  const rowRe = /<row[^>]*>([\s\S]*?)<\/row>/g
  let rm
  while ((rm = rowRe.exec(xml))) {
    const cells = []
    const cellRe = /<c\s+r="([A-Z]+\d+)"([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g
    let cm
    while ((cm = cellRe.exec(rm[1]))) {
      const ci = colIndex(cm[1])
      const attrs = cm[2] || ''
      const body = cm[3] || ''
      const t = (attrs.match(/t="([^"]+)"/) || [])[1]
      const v = body.match(/<v>([\s\S]*?)<\/v>/)
      const is = body.match(/<t[^>]*>([\s\S]*?)<\/t>/)
      let val = ''
      if (t === 's' && v) val = shared[Number(v[1])] ?? ''
      else if (t === 'inlineStr' && is) val = decodeXml(is[1])
      else if (v) val = decodeXml(v[1])
      cells[ci] = val
    }
    rows.push(cells)
  }
  return rows
}

/** Read the first worksheet of an XLSX buffer into an array of row arrays. */
function readXlsx(buf) {
  const files = unzip(buf)
  const shared = files['xl/sharedStrings.xml'] ? parseSharedStrings(files['xl/sharedStrings.xml'].toString('utf8')) : []
  const sheetName =
    Object.keys(files).find((n) => /xl\/worksheets\/sheet1\.xml$/.test(n)) ||
    Object.keys(files).find((n) => /xl\/worksheets\/.*\.xml$/.test(n))
  return parseSheet(files[sheetName].toString('utf8'), shared)
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

const round2 = (n) => Math.round(n * 100) / 100

// 6) Unemployment rate by district, 2009-2014 (XLSX; the .csv sibling is corrupt).
datasets.push({
  manifest: {
    id: 'unemployment-by-district',
    name: 'Unemployment Rate by District',
    description: 'Unemployment rate (%) by district, 2009–2014.',
    secondarySource: 'Dept. of Census & Statistics — Labour Force Survey',
    unit: '%',
    level: 'district',
    metrics: ['Value'],
    citation: 'Department of Census and Statistics, Sri Lanka (via data.gov.lk)',
    citationUrl: 'https://data.gov.lk/dataset/unemployment-rate-province-and-district-2009-2014',
    tags: ['local', 'unemployment', 'labour', 'district'],
  },
  async parse() {
    const rows = readXlsx(await fetchBuffer('https://data.gov.lk/sites/default/files/Unemployment%20rate%20%28%25%29%20by%20province%20and%20district%202009%20-%202014.xlsx'))
    const years = ['2009', '2010', '2011', '2012', '2013', '2014']
    const valuesByLocation = {}
    for (const r of rows) {
      if (!isDistrict(r[0] || '')) continue
      const byYear = {}
      years.forEach((y, i) => {
        const v = num(r[i + 1])
        if (v !== null) byYear[y] = { Value: round2(v) }
      })
      if (Object.keys(byYear).length) valuesByLocation[cleanDistrict(r[0])] = byYear
    }
    return { level: 'district', unit: '%', metrics: ['Value'], valuesByLocation }
  },
})

// 7) Labour-force participation by district, 2010-2014 (XLSX; multi-metric).
//    Columns: [name, 2010_count, 2010_rate, 2011_count, 2011_rate, ...].
datasets.push({
  manifest: {
    id: 'labour-force-participation-by-district',
    name: 'Labour Force Participation by District',
    description: 'Labour-force participation rate (%) and participant count by district, 2010–2014.',
    secondarySource: 'Dept. of Census & Statistics — Labour Force Survey',
    unit: '%',
    level: 'district',
    metrics: ['Rate', 'Participants'],
    citation: 'Department of Census and Statistics, Sri Lanka (via data.gov.lk)',
    citationUrl: 'https://data.gov.lk/dataset/labour-force-participation-province-and-district-2010-2014',
    tags: ['local', 'labour', 'employment', 'district'],
  },
  async parse() {
    const rows = readXlsx(await fetchBuffer('https://data.gov.lk/sites/default/files/Labour%20force%20participation%20by%20province%20and%20district%202010-2014.xlsx'))
    const years = ['2010', '2011', '2012', '2013', '2014']
    const valuesByLocation = {}
    for (const r of rows) {
      if (!isDistrict(r[0] || '')) continue
      const byYear = {}
      years.forEach((y, j) => {
        const count = num(r[1 + j * 2])
        const rate = num(r[2 + j * 2])
        const cell = {}
        if (rate !== null) cell.Rate = round2(rate)
        if (count !== null) cell.Participants = Math.round(count)
        if (Object.keys(cell).length) byYear[y] = cell
      })
      if (Object.keys(byYear).length) valuesByLocation[cleanDistrict(r[0])] = byYear
    }
    return { level: 'district', unit: '%', metrics: ['Rate', 'Participants'], valuesByLocation }
  },
})

// 8) Household expenditure by district, 2013 (XLSX; multi-metric, Rs./month).
datasets.push({
  manifest: {
    id: 'household-expenditure-by-district',
    name: 'Household Expenditure by District',
    description: 'Average monthly household expenditure (Rs.) by district, 2013 — total, food & drink, non-food, and food ratio (%).',
    secondarySource: 'Dept. of Census & Statistics — HIES',
    unit: 'Rs./month',
    level: 'district',
    metrics: ['Total', 'Food and Drink', 'Non-food', 'Food ratio'],
    citation: 'Department of Census and Statistics, Sri Lanka (via data.gov.lk)',
    citationUrl: 'https://data.gov.lk/dataset/household-expenditure-province-and-district-2013',
    tags: ['local', 'expenditure', 'hies', 'district'],
  },
  async parse() {
    const rows = readXlsx(await fetchBuffer('https://data.gov.lk/sites/default/files/Household%20expenditure%20%28Rs.%20average%20monthly%29%20on%20Food%20and%20drink%2C%20Non-food%20and%20Food%20ratio%2A%20by%20Province%20and%20District%20-%202013.xlsx'))
    const cols = ['Total', 'Food and Drink', 'Non-food', 'Food ratio']
    const valuesByLocation = {}
    for (const r of rows) {
      if (!isDistrict(r[0] || '')) continue
      const cell = {}
      cols.forEach((c, i) => {
        const v = num(r[i + 1])
        if (v !== null) cell[c] = c === 'Food ratio' ? round2(v) : Math.round(v)
      })
      if (Object.keys(cell).length) valuesByLocation[cleanDistrict(r[0])] = { 2013: cell }
    }
    return { level: 'district', unit: 'Rs./month', metrics: cols, valuesByLocation }
  },
})

// 9) Poverty indicators by district, HIES 2012/13–2019 (CBSL ESS 2025 table 2.13).
//    Three indicators x three survey periods -> a time series + metric switch.
datasets.push({
  manifest: {
    id: 'poverty-by-district',
    name: 'Poverty Indicators by District',
    description: 'District poverty headcount index, poor-household share, and poverty gap across HIES rounds 2012/13, 2016, 2019.',
    secondarySource: 'Central Bank of Sri Lanka — ESS 2025',
    unit: '%',
    level: 'district',
    metrics: ['Head Count Index', 'Poor Household %', 'Poverty Gap'],
    citation: 'Central Bank of Sri Lanka, Economic & Social Statistics 2025 (Table 2.13)',
    citationUrl: 'https://www.cbsl.gov.lk/en/statistics/statistical-tables/real-sector',
    tags: ['local', 'poverty', 'hies', 'district'],
  },
  async parse() {
    const rows = readXlsx(await fetchBuffer('https://www.cbsl.gov.lk/sites/default/files/cbslweb_documents/statistics/sheets/ess_2025_table2.13_e.xlsx'))
    // col1 = name; head-count cols 2-4, poor-household 6-8, poverty-gap 10-12
    // across periods 2012/13, 2016, 2019(a).
    const periodCols = [
      { year: '2013', head: 2, poor: 6, gap: 10 },
      { year: '2016', head: 3, poor: 7, gap: 11 },
      { year: '2019', head: 4, poor: 8, gap: 12 },
    ]
    const valuesByLocation = {}
    for (const r of rows) {
      if (!isDistrict(r[1] || '')) continue
      const byYear = {}
      for (const { year, head, poor, gap } of periodCols) {
        const cell = {}
        const h = num(r[head])
        const p = num(r[poor])
        const g = num(r[gap])
        if (h !== null) cell['Head Count Index'] = round2(h)
        if (p !== null) cell['Poor Household %'] = round2(p)
        if (g !== null) cell['Poverty Gap'] = round2(g)
        if (Object.keys(cell).length) byYear[year] = cell
      }
      if (Object.keys(byYear).length) valuesByLocation[cleanDistrict(r[1])] = byYear
    }
    return { level: 'district', unit: '%', metrics: ['Head Count Index', 'Poor Household %', 'Poverty Gap'], valuesByLocation }
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
