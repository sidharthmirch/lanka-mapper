import axios from 'axios'
import type { FeatureCollection } from 'geojson'
import type {
  TabularData,
  DatasetMetadata,
  DistrictData,
  ProvinceData,
  DatasetManifestEntry,
  NuuuwanSeries,
} from '@/types'

const BASE_URL = 'https://raw.githubusercontent.com/LDFLK/datasets/main/data/statistics'
const NUUUWAN_BASE_URL = 'https://raw.githubusercontent.com/nuuuwan/lanka_data_timeseries/data/sources/cbsl'
const NUUUWAN_SMALL_CATALOG_URL = 'https://raw.githubusercontent.com/nuuuwan/lanka_data_timeseries/data/all.small.json'

const cache = new Map<string, { data: unknown; expires: number }>()
const CACHE_TTL = 5 * 60 * 1000

function getCached<T>(key: string): T | null {
  const cached = cache.get(key)
  if (!cached) return null
  if (Date.now() > cached.expires) {
    cache.delete(key)
    return null
  }
  return cached.data as T
}

function setCache(key: string, data: unknown, ttl = CACHE_TTL) {
  cache.set(key, { data, expires: Date.now() + ttl })
}

const DISTRICT_NAME_MAP: Record<string, string> = {
  'amparai': 'Ampara',
  'colombo': 'Colombo',
  'gampaha': 'Gampaha',
  'kalutara': 'Kalutara',
  'kandy': 'Kandy',
  'matale': 'Matale',
  'nuwara eliya': 'Nuwara Eliya',
  'galle': 'Galle',
  'matara': 'Matara',
  'hambantota': 'Hambantota',
  'jaffna': 'Jaffna',
  'kilinochchi': 'Kilinochchi',
  'mannar': 'Mannar',
  'vavuniya': 'Vavuniya',
  'mullative': 'Mullaitivu',
  'mullativu': 'Mullaitivu',
  'mullaitivu': 'Mullaitivu',
  'batticaloa': 'Batticaloa',
  'ampara': 'Ampara',
  'trincomalee': 'Trincomalee',
  'kurunegala': 'Kurunegala',
  'puttalam': 'Puttalam',
  'puttalum': 'Puttalam',
  'anuradhapura': 'Anuradhapura',
  'polonnaruwa': 'Polonnaruwa',
  'badulla': 'Badulla',
  'monaragala': 'Moneragala', // GeoJSON uses "Moneragala"
  'ratnapura': 'Ratnapura',
  'rathnapura': 'Ratnapura', // GeoJSON uses "Ratnapura"
  'kegalle': 'Kegalle',
}

function normalizeDistrict(name: string): string {
  const lower = name.toLowerCase().replace(/district\s*$/i, '').trim()
  return DISTRICT_NAME_MAP[lower] || name
}

const PROVINCE_NAME_MAP: Record<string, string> = {
  'western': 'Western Province',
  'central': 'Central Province',
  'southern': 'Southern Province',
  'northern': 'Northern Province',
  'eastern': 'Eastern Province',
  'north western': 'North Western Province',
  'north central': 'North Central Province',
  'north-western': 'North Western Province',
  'north-central': 'North Central Province',
  'uva': 'Uva Province',
  'sabaragamuwa': 'Sabaragamuwa Province',
}

function normalizeProvince(name: string): string {
  const lower = name.toLowerCase().replace(/province\s*$/i, '').trim()
  return PROVINCE_NAME_MAP[lower] || name
}

// --- nuuuwan/lanka_data_timeseries integration ---
// 90 provincial datasets from CBSL: 9 revenue categories × 9 provinces (+ Total, excluded).
// Data lives on the `data` branch as timeseries JSON files.
// Filename: cbsl.Analysis of Revenue Collection of Provincial Councils-{Category}-{Province}.Annual.json

interface NuuuwanTimeseries {
  source_id: string
  category: string
  sub_category: string
  scale: string
  unit: string
  frequency_name: string
  footnotes: Record<string, string>
  cleaned_data: Record<string, number>
}

const NUUUWAN_PROVINCES: string[] = [
  'Central', 'Eastern', 'North-Central', 'North-Western',
  'Northern', 'Sabaragamuwa', 'Southern', 'Uva', 'Western',
]

const NUUUWAN_REVENUE_CATEGORIES: string[] = [
  'Total Revenue',
  'Excise Duty on Liquor',
  'Stamp Duty',
  'Turnover Tax',
  'Licence Fee - Liquor',
  'Licence Fee - Vehicles',
  'Licence Fee - Others',
  'Profit and Dividends',
  'Other Revenue',
]

function isNuuuwanPath(datasetPath: string): boolean {
  return datasetPath.startsWith('nuuuwan:')
}

function buildNuuuwanUrl(category: string, province: string): string {
  const filename = `cbsl.Analysis of Revenue Collection of Provincial Councils-${category}-${province}.Annual.json`
  return `${NUUUWAN_BASE_URL}/${encodeURIComponent(filename)}`
}

async function fetchNuuuwanTimeseries(category: string, province: string): Promise<NuuuwanTimeseries | null> {
  const url = buildNuuuwanUrl(category, province)
  const cacheKey = `nuuuwan-${category}-${province}`
  const cached = getCached<NuuuwanTimeseries>(cacheKey)
  if (cached) return cached

  try {
    const { data } = await axios.get<NuuuwanTimeseries>(url)
    setCache(cacheKey, data)
    return data
  } catch {
    return null
  }
}

async function fetchNuuuwanProvinceData(year: number, category: string): Promise<ProvinceData[]> {
  const dateKey = `${year}-01-01`

  const results = await Promise.allSettled(
    NUUUWAN_PROVINCES.map(async (province) => {
      const timeseries = await fetchNuuuwanTimeseries(category, province)
      if (!timeseries) return null

      const value = timeseries.cleaned_data[dateKey]
      if (value === undefined || value === null) return null

      const normalized = normalizeProvince(province)
      const entry: ProvinceData = {
        name: normalized,
        province: normalized,
        value: Number(value),
        originalName: province,
        originalProvince: province,
        originalValue: value,
      }
      return entry
    })
  )

  return results
    .filter((r): r is PromiseFulfilledResult<ProvinceData | null> => r.status === 'fulfilled')
    .map((r) => r.value)
    .filter((d): d is ProvinceData => d !== null && d.value > 0)
}

// LDFLK/datasets audit (2019-2025): the repository currently exposes five map-compatible
// datasets with Sri Lanka district/province keys. A sixth geo-shaped dataset,
// `Accommodation Capacity by Resort Region` (2019), is intentionally excluded because its
// values are tourism resort regions (for example, `East Coast`, `Ancient Cities`) rather
// than actual province names and therefore cannot be joined to the app's province GeoJSON.
export const DATASET_MANIFEST: DatasetManifestEntry[] = [
  {
    id: 'accommodations-by-district',
    name: 'Accommodations by District',
    description: 'Number of hotel rooms by district.',
    source: 'ldflk',
    unit: 'rooms',
    level: 'district',
    path: 'datasets/Accommodations by District',
    years: [2020, 2021, 2022, 2023, 2024],
    metrics: ['Number of Rooms'],
    defaultMetric: 'Number of Rooms',
  },
  {
    id: 'occupancy-rate-by-district',
    name: 'Occupancy Rate by District',
    description: 'Accommodation occupancy rate by district.',
    source: 'ldflk',
    unit: '%',
    level: 'district',
    path: 'datasets/Occupancy Rate by District',
    yearPaths: {
      2019: 'datasets/Occupancy Rates by District',
    },
    years: [2019, 2020, 2021],
    metrics: ['Occupancy Rate'],
    defaultMetric: 'Occupancy Rate',
  },
  {
    id: 'slbfe-registration-by-district',
    name: 'SLBFE Registration by District',
    description: 'Foreign employment registrations by district and manpower category.',
    source: 'ldflk',
    unit: 'registrations',
    level: 'district',
    path: 'datasets/SLBFE Registration by District',
    yearPaths: {
      2020: 'datasets/SLBFE Registration by District vs Manpower Level vs Gender',
      2021: 'datasets/SLBFE Registration by District vs Manpower Level vs Gender',
      2022: 'datasets/SLBFE registration by district vs manpower level vs gender',
      2023: 'datasets/SLBFE Registration by District vs Manpower Level vs Gender',
    },
    years: [2020, 2021, 2022, 2023, 2024],
    metrics: [
      'Professional Female',
      'Professional Male',
      'Skilled Female',
      'Skilled Male',
      'Semi Skilled Domestic Housekeeping Assistants',
      'Semi Skilled Domestic HouseKeeping Assistance',
      'Semi Skilled Others',
      'Semi Skilled Other Female',
      'Semi Skilled Other Male',
      'Middle Level Female',
      'Middle Level Male',
      'Clerical & Related Female',
      'Clerical & Related Male',
      'Low Skilled Female',
      'Low Skilled Male',
    ],
    defaultMetric: 'Skilled Female',
    yearMetrics: {
      2024: ['Female', 'Male'],
      2023: [
        'Professional Female',
        'Professional Male',
        'Skilled Female',
        'Skilled Male',
        'Semi Skilled Domestic Housekeeping Assistants',
        'Semi Skilled Others',
        'Middle Level Female',
        'Middle Level Male',
        'Clerical & Related Female',
        'Clerical & Related Male',
        'Low Skilled Female',
        'Low Skilled Male',
      ],
      2022: [
        'Professional Female',
        'Professional Male',
        'Skilled Female',
        'Skilled Male',
        'Semi Skilled Domestic Housekeeping Assistants',
        'Semi Skilled Others',
        'Middle Level Female',
        'Middle Level Male',
        'Clerical & Related Female',
        'Clerical & Related Male',
        'Low Skilled Female',
        'Low Skilled Male',
      ],
      2021: [
        'Professional Female',
        'Professional Male',
        'Skilled Female',
        'Skilled Male',
        'Semi Skilled Domestic Housekeeping Assistants',
        'Semi Skilled Others',
        'Middle Level Female',
        'Middle Level Male',
        'Clerical & Related Female',
        'Clerical & Related Male',
        'Low Skilled Female',
        'Low Skilled Male',
      ],
      2020: [
        'Professional Female',
        'Professional Male',
        'Skilled Female',
        'Skilled Male',
        'Semi Skilled Domestic HouseKeeping Assistance',
        'Semi Skilled Other Female',
        'Semi Skilled Other Male',
        'Middle Level Female',
        'Middle Level Male',
        'Clerical & Related Female',
        'Clerical & Related Male',
        'Low Skilled Female',
        'Low Skilled Male',
      ],
    },
    yearDefaultMetric: {
      2024: 'Female',
      2023: 'Skilled Female',
      2022: 'Skilled Female',
      2021: 'Skilled Female',
      2020: 'Skilled Female',
    },
  },
  {
    id: 'accommodation-capacity-by-district',
    name: 'Accommodation Capacity by District',
    description: 'Accommodation capacity by district.',
    source: 'ldflk',
    unit: 'rooms',
    level: 'district',
    path: 'datasets/Accommodation Capacity by District',
    years: [2019],
    metrics: ['Number of Rooms'],
    defaultMetric: 'Number of Rooms',
  },
  {
    id: 'accommodations-by-province',
    name: 'Accommodations by Province',
    description: 'Number of hotel rooms by province.',
    source: 'ldflk',
    unit: 'rooms',
    level: 'province',
    path: 'datasets/Accommodations by Province',
    years: [2020, 2021, 2022, 2023, 2024],
    metrics: ['Number of Rooms'],
    defaultMetric: 'Number of Rooms',
  },
  {
    id: 'cbsl-provincial-revenue',
    name: 'Provincial Revenue (CBSL)',
    description: 'Revenue collection of provincial councils (Rs. Mn) — CBSL timeseries.',
    source: 'nuuuwan',
    secondarySource: 'CBSL',
    unit: 'Rs. Mn',
    level: 'province',
    path: 'nuuuwan:cbsl-provincial-revenue',
    years: [
      1999, 2000, 2002, 2003, 2004, 2005, 2006, 2007, 2008, 2009,
      2010, 2011, 2012, 2013, 2014, 2015, 2016, 2017, 2018, 2019,
      2020, 2021,
    ],
    metrics: NUUUWAN_REVENUE_CATEGORIES,
    defaultMetric: 'Total Revenue',
  },
]

export const AVAILABLE_DATASETS = DATASET_MANIFEST

function getDatasetManifestEntry(year: number, datasetPath: string): DatasetManifestEntry | undefined {
  return DATASET_MANIFEST.find((entry) => {
    const resolvedPath = entry.yearPaths?.[year] ?? entry.path
    return resolvedPath === datasetPath || entry.path === datasetPath
  })
}

function resolveDatasetPath(year: number, datasetPath: string): string {
  return getDatasetManifestEntry(year, datasetPath)?.yearPaths?.[year] ?? datasetPath
}

function normalizeMetricName(metric: string): string {
  return metric
    .toLowerCase()
    .replace(/[%()&]/g, ' ')
    .replace(/housekeeping assistance/g, 'housekeeping assistants')
    .replace(/housekeeping/g, 'housekeeping')
    .replace(/other female/g, 'others')
    .replace(/other male/g, 'others')
    .replace(/others/g, 'others')
    .replace(/\s+/g, ' ')
    .trim()
}

function isAggregateRow(name: string): boolean {
  const normalized = name.toLowerCase().trim()
  return normalized === 'total' || normalized === 'all' || normalized === 'sri lanka'
}

function getMetricColumnIndices(columns: string[], valueColumn?: string): number[] {
  if (!valueColumn) return []

  const exactMatch = columns.findIndex((column) => column.toLowerCase() === valueColumn.toLowerCase())
  if (exactMatch !== -1) return [exactMatch]

  const normalizedTarget = normalizeMetricName(valueColumn)
  const normalizedMatches = columns
    .map((column, index) => ({ column, index, normalized: normalizeMetricName(column) }))
    .filter(({ normalized }) => normalized === normalizedTarget)
    .map(({ index }) => index)

  return normalizedMatches
}

function getRequestedMetric(year: number, datasetPath: string, valueColumn?: string): string | undefined {
  if (valueColumn) return valueColumn
  return getDefaultMetricForYear(getDatasetManifestEntry(year, datasetPath)?.id ?? '', year) || undefined
}

export function getMetricsForYear(datasetId: string, year: number): string[] {
  const entry = DATASET_MANIFEST.find((e) => e.id === datasetId)
  if (!entry) return []
  return entry.yearMetrics?.[year] ?? entry.metrics
}

export function getDefaultMetricForYear(datasetId: string, year: number): string {
  const entry = DATASET_MANIFEST.find((e) => e.id === datasetId)
  if (!entry) return ''
  return entry.yearDefaultMetric?.[year] ?? entry.defaultMetric
}

function getNumericValue(row: unknown[], columnIndices: number[], fallbackIndex: number): number {
  const resolvedIndices = columnIndices.length > 0 ? columnIndices : [fallbackIndex]
  const total = resolvedIndices.reduce((sum, index) => sum + (Number(row[index]) || 0), 0)
  return total
}

export async function fetchDataset(year: number, datasetPath: string): Promise<TabularData> {
  const resolvedPath = resolveDatasetPath(year, datasetPath)
  const cacheKey = `dataset-${year}-${resolvedPath}`
  const cached = getCached<TabularData>(cacheKey)
  if (cached) return cached

  const url = `${BASE_URL}/${year}/${resolvedPath}/data.json`
  const { data } = await axios.get<TabularData>(url)
  setCache(cacheKey, data)
  return data
}

export async function fetchMetadata(year: number, datasetPath: string): Promise<DatasetMetadata> {
  const resolvedPath = resolveDatasetPath(year, datasetPath)
  const cacheKey = `metadata-${year}-${resolvedPath}`
  const cached = getCached<DatasetMetadata>(cacheKey)
  if (cached) return cached

  const url = `${BASE_URL}/${year}/${resolvedPath}/metadata.json`
  const { data } = await axios.get<DatasetMetadata>(url)
  setCache(cacheKey, data)
  return data
}

export async function fetchDistrictData(year: number, datasetPath: string, valueColumn?: string): Promise<DistrictData[]> {
  const tabular = await fetchDataset(year, datasetPath)
  const districtCol = tabular.columns.findIndex((c) =>
    c.toLowerCase().includes('district') && !c.toLowerCase().includes('electoral')
  )
  if (districtCol === -1) return []

  const requestedMetric = getRequestedMetric(year, datasetPath, valueColumn)
  const metricColumnIndices = getMetricColumnIndices(tabular.columns, requestedMetric)
  const valueColIdx = requestedMetric
    ? metricColumnIndices[0] ?? -1
    : tabular.columns.findIndex((c) =>
        !c.toLowerCase().includes('district') &&
        (c.toLowerCase().includes('number') || c.toLowerCase().includes('count') || c.toLowerCase().includes('total'))
      )
  const valueCol = valueColIdx !== -1 ? valueColIdx : tabular.columns.length - 1

  return tabular.rows
    .filter((row) => row[districtCol] && !isAggregateRow(String(row[districtCol])) && (metricColumnIndices.length > 0 || (row[valueCol] !== undefined && row[valueCol] !== null)))
    .map((row) => {
      const district = normalizeDistrict(String(row[districtCol]))

      return {
        name: district,
        district,
        value: getNumericValue(row, metricColumnIndices, valueCol),
        originalName: String(row[districtCol]),
        originalDistrict: String(row[districtCol]),
        originalValue: metricColumnIndices.length > 1
          ? metricColumnIndices.map((index) => row[index])
          : row[valueCol],
      }
    })
    .filter((d) => d.value > 0)
}

export async function fetchProvinceData(year: number, datasetPath: string, valueColumn?: string): Promise<ProvinceData[]> {
  if (isNuuuwanPath(datasetPath)) {
    const entry = DATASET_MANIFEST.find((e) => e.path === datasetPath)
    const category = valueColumn ?? entry?.defaultMetric ?? NUUUWAN_REVENUE_CATEGORIES[0]
    return fetchNuuuwanProvinceData(year, category)
  }

  const tabular = await fetchDataset(year, datasetPath)
  const provinceCol = tabular.columns.findIndex((c) => c.toLowerCase().includes('province'))
  if (provinceCol === -1) return []

  const requestedMetric = getRequestedMetric(year, datasetPath, valueColumn)
  const metricColumnIndices = getMetricColumnIndices(tabular.columns, requestedMetric)
  const valueColIdx = requestedMetric
    ? metricColumnIndices[0] ?? -1
    : tabular.columns.findIndex((c) =>
        !c.toLowerCase().includes('province') &&
        (c.toLowerCase().includes('number') || c.toLowerCase().includes('count') || c.toLowerCase().includes('total'))
      )
  const valueCol = valueColIdx !== -1 ? valueColIdx : tabular.columns.length - 1

  return tabular.rows
    .filter((row) => row[provinceCol] && !isAggregateRow(String(row[provinceCol])) && (metricColumnIndices.length > 0 || (row[valueCol] !== undefined && row[valueCol] !== null)))
    .map((row) => {
      const province = normalizeProvince(String(row[provinceCol]))

      return {
        name: province,
        province,
        value: getNumericValue(row, metricColumnIndices, valueCol),
        originalName: String(row[provinceCol]),
        originalProvince: String(row[provinceCol]),
        originalValue: metricColumnIndices.length > 1
          ? metricColumnIndices.map((index) => row[index])
          : row[valueCol],
      }
    })
    .filter((p) => p.value > 0)
}

let geojsonCache: FeatureCollection | null = null

export interface DatasetSeriesPoint {
  name: string
  values: Record<number, number>
}

interface NuuuwanSmallSeries {
  source_id?: string
  category?: string
  sub_category?: string
  unit?: string
  frequency_name?: string
  cleaned_data?: Record<string, number>
}

export async function fetchDatasetSeries(
  datasetId: string,
  metric?: string,
): Promise<DatasetSeriesPoint[]> {
  const dataset = DATASET_MANIFEST.find((entry) => entry.id === datasetId)
  if (!dataset) {
    return []
  }

  const byName = new Map<string, DatasetSeriesPoint>()
  const yearRows = await Promise.all(
    dataset.years.map(async (year) => ({
      year,
      rows: dataset.level === 'district'
        ? await fetchDistrictData(year, dataset.path, metric)
        : await fetchProvinceData(year, dataset.path, metric),
    })),
  )

  yearRows.forEach(({ year, rows }) => {
    rows.forEach((row) => {
      const existing = byName.get(row.name) ?? { name: row.name, values: {} }
      existing.values[year] = row.value
      byName.set(row.name, existing)
    })
  })

  return Array.from(byName.values())
}

export async function fetchNuuuwanSeriesCatalog(): Promise<NuuuwanSeries[]> {
  const cacheKey = 'nuuuwan-series-catalog'
  const cached = getCached<NuuuwanSeries[]>(cacheKey)
  if (cached) {
    return cached
  }

  const { data } = await axios.get<Record<string, NuuuwanSmallSeries>>(NUUUWAN_SMALL_CATALOG_URL)
  const series = Object.entries(data).flatMap(([id, rawSeries]) => {
    const cleaned = rawSeries.cleaned_data ?? {}
    const values = Object.entries(cleaned).reduce<Record<number, number>>((acc, [date, value]) => {
      const year = Number(String(date).slice(0, 4))
      if (Number.isFinite(year) && Number.isFinite(Number(value))) {
        acc[year] = Number(value)
      }
      return acc
    }, {})

    if (Object.keys(values).length === 0) {
      return []
    }

    const label = rawSeries.sub_category || rawSeries.category || id
    return [{
      id,
      label,
      source: rawSeries.source_id ? `nuuuwan (${rawSeries.source_id.toUpperCase()})` : 'nuuuwan',
      unit: rawSeries.unit,
      frequency: rawSeries.frequency_name,
      values,
    }]
  })

  setCache(cacheKey, series, 60 * 60 * 1000)
  return series
}

export async function loadGeoJSON(): Promise<FeatureCollection> {
  if (geojsonCache) return geojsonCache

  const { data } = await axios.get<FeatureCollection>('/data/sri-lanka-districts.geojson')
  geojsonCache = data
  return data
}
