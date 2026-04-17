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
const LDFLK_GIT_TREE_URL = 'https://api.github.com/repos/LDFLK/datasets/git/trees/main?recursive=1'
const NUUUWAN_ALL_URL = 'https://raw.githubusercontent.com/nuuuwan/lanka_data_timeseries/data/all.json'
const NUUUWAN_BASE_URL = 'https://raw.githubusercontent.com/nuuuwan/lanka_data_timeseries/data/sources/cbsl'

const cache = new Map<string, { data: unknown; expires: number }>()
const CACHE_TTL = 5 * 60 * 1000
const CATALOG_TTL = 20 * 60 * 1000

interface FetchOptions {
  forceRefresh?: boolean
}

function getCached<T>(key: string, forceRefresh = false): T | null {
  if (forceRefresh) return null

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
  amparai: 'Ampara',
  colombo: 'Colombo',
  gampaha: 'Gampaha',
  kalutara: 'Kalutara',
  kandy: 'Kandy',
  matale: 'Matale',
  'nuwara eliya': 'Nuwara Eliya',
  galle: 'Galle',
  matara: 'Matara',
  hambantota: 'Hambantota',
  jaffna: 'Jaffna',
  kilinochchi: 'Kilinochchi',
  mannar: 'Mannar',
  vavuniya: 'Vavuniya',
  mullative: 'Mullaitivu',
  mullativu: 'Mullaitivu',
  mullaitivu: 'Mullaitivu',
  batticaloa: 'Batticaloa',
  ampara: 'Ampara',
  trincomalee: 'Trincomalee',
  kurunegala: 'Kurunegala',
  puttalam: 'Puttalam',
  puttalum: 'Puttalam',
  anuradhapura: 'Anuradhapura',
  polonnaruwa: 'Polonnaruwa',
  badulla: 'Badulla',
  monaragala: 'Moneragala',
  ratnapura: 'Ratnapura',
  rathnapura: 'Ratnapura',
  kegalle: 'Kegalle',
}

function normalizeDistrict(name: string): string {
  const lower = name.toLowerCase().replace(/district\s*$/i, '').trim()
  return DISTRICT_NAME_MAP[lower] || name
}

const PROVINCE_NAME_MAP: Record<string, string> = {
  western: 'Western Province',
  central: 'Central Province',
  southern: 'Southern Province',
  northern: 'Northern Province',
  eastern: 'Eastern Province',
  'north western': 'North Western Province',
  'north central': 'North Central Province',
  'north-western': 'North Western Province',
  'north-central': 'North Central Province',
  uva: 'Uva Province',
  sabaragamuwa: 'Sabaragamuwa Province',
}

function normalizeProvince(name: string): string {
  const lower = name.toLowerCase().replace(/province\s*$/i, '').trim()
  return PROVINCE_NAME_MAP[lower] || name
}

function normalizeLocationToken(value: string): string {
  return value
    .toLowerCase()
    .replace(/province/g, '')
    .replace(/district/g, '')
    .replace(/[()]/g, ' ')
    .replace(/[\-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

const CANONICAL_PROVINCE_ALIASES: Array<{ alias: string; canonical: string }> = [
  { alias: 'western', canonical: 'Western Province' },
  { alias: 'central', canonical: 'Central Province' },
  { alias: 'southern', canonical: 'Southern Province' },
  { alias: 'northern', canonical: 'Northern Province' },
  { alias: 'eastern', canonical: 'Eastern Province' },
  { alias: 'north western', canonical: 'North Western Province' },
  { alias: 'north-western', canonical: 'North Western Province' },
  { alias: 'north central', canonical: 'North Central Province' },
  { alias: 'north-central', canonical: 'North Central Province' },
  { alias: 'uva', canonical: 'Uva Province' },
  { alias: 'sabaragamuwa', canonical: 'Sabaragamuwa Province' },
]

const CANONICAL_DISTRICT_ALIASES: Array<{ alias: string; canonical: string }> = Object.entries(DISTRICT_NAME_MAP)
  .map(([alias, canonical]) => ({ alias, canonical }))

const LOCATION_ALIASES = [
  ...CANONICAL_PROVINCE_ALIASES.map((entry) => ({ ...entry, level: 'province' as const })),
  ...CANONICAL_DISTRICT_ALIASES.map((entry) => ({ ...entry, level: 'district' as const })),
]
  .sort((a, b) => b.alias.length - a.alias.length)

interface ResolvedLocation {
  level: 'province' | 'district'
  canonicalName: string
  baseLabel: string
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function resolveLocationInSubCategory(subCategory: string): ResolvedLocation | null {
  const normalized = normalizeLocationToken(subCategory)

  for (const alias of LOCATION_ALIASES) {
    const normalizedAlias = normalizeLocationToken(alias.alias)
    const tailPattern = new RegExp(`(?:^|\\s|-)${escapeRegExp(normalizedAlias)}$`, 'i')
    if (!tailPattern.test(normalized)) {
      continue
    }

    const baseLabel = normalized
      .replace(tailPattern, '')
      .replace(/[-\s]+$/g, '')
      .trim()

    if (!baseLabel) {
      return null
    }

    return {
      level: alias.level,
      canonicalName: alias.level === 'province'
        ? normalizeProvince(alias.canonical)
        : normalizeDistrict(alias.canonical),
      baseLabel,
    }
  }

  return null
}

function toTitleCase(value: string): string {
  return value
    .split(/\s+/)
    .map((part) => {
      if (!part) return part
      if (part.length <= 2) return part.toUpperCase()
      return part[0].toUpperCase() + part.slice(1).toLowerCase()
    })
    .join(' ')
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function inferLevelFromPath(path: string): 'district' | 'province' | 'national' {
  const normalized = path.toLowerCase()
  if (normalized.includes('district')) return 'district'
  if (normalized.includes('province')) return 'province'
  return 'national'
}

function isAggregateRow(name: string): boolean {
  const normalized = name.toLowerCase().trim()
  return normalized === 'total' || normalized === 'all' || normalized === 'sri lanka'
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

function getNumericValue(row: unknown[], columnIndices: number[], fallbackIndex: number): number {
  const resolvedIndices = columnIndices.length > 0 ? columnIndices : [fallbackIndex]
  return resolvedIndices.reduce((sum, index) => sum + (Number(row[index]) || 0), 0)
}

function inferTabularLevel(columns: string[]): 'district' | 'province' | 'national' {
  const lower = columns.map((column) => column.toLowerCase())
  const hasDistrict = lower.some((column) => column.includes('district') && !column.includes('electoral'))
  if (hasDistrict) return 'district'
  const hasProvince = lower.some((column) => column.includes('province'))
  if (hasProvince) return 'province'
  return 'national'
}

const FALLBACK_DATASET_MANIFEST: DatasetManifestEntry[] = [
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
    years: [2020, 2021, 2022, 2023, 2024],
    metrics: ['Skilled Female'],
    defaultMetric: 'Skilled Female',
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
    description: 'Revenue collection of provincial councils (Rs. Mn).',
    source: 'nuuuwan',
    secondarySource: 'CBSL',
    unit: 'Rs. Mn',
    level: 'province',
    path: 'nuuuwan:cbsl-provincial-revenue',
    years: [2018, 2019, 2020, 2021],
    metrics: ['Total Revenue'],
    defaultMetric: 'Total Revenue',
  },
]

let datasetManifestState: DatasetManifestEntry[] = [...FALLBACK_DATASET_MANIFEST]
let catalogLastSyncedAt: number | null = null
let catalogCounts = { total: FALLBACK_DATASET_MANIFEST.length, ldflk: 4, nuuuwan: 1 }

interface LdfTreeEntry {
  path: string
  type: 'blob' | 'tree'
}

interface LdfTreeResponse {
  tree: LdfTreeEntry[]
}

interface NuuuwanRawSeries {
  source_id?: string
  category?: string
  sub_category?: string
  scale?: string
  cleaned_data?: Record<string, number>
}

interface NuuuwanGroup {
  key: string
  sourceId: string
  category: string
  baseLabel: string
  level: 'district' | 'province'
  unit: string
  years: number[]
  valuesByLocation: Record<string, Record<number, number>>
}

interface NuuuwanCatalogCache {
  groupsByKey: Record<string, NuuuwanGroup>
  expiresAt: number
}

let nuuuwanCatalogCache: NuuuwanCatalogCache | null = null

function sortYearsAscending(values: Iterable<number>): number[] {
  return Array.from(new Set(values)).sort((a, b) => a - b)
}

async function fetchNuuuwanGroups(options: FetchOptions = {}): Promise<Record<string, NuuuwanGroup>> {
  const forceRefresh = Boolean(options.forceRefresh)
  if (!forceRefresh && nuuuwanCatalogCache && Date.now() < nuuuwanCatalogCache.expiresAt) {
    return nuuuwanCatalogCache.groupsByKey
  }

  const cacheKey = 'nuuuwan-all-json'
  const cached = getCached<NuuuwanRawSeries[]>(cacheKey, forceRefresh)
  const allSeries = cached ?? (await axios.get<NuuuwanRawSeries[]>(NUUUWAN_ALL_URL)).data
  if (!cached) {
    setCache(cacheKey, allSeries, CATALOG_TTL)
  }

  const grouped = new Map<string, {
    sourceId: string
    category: string
    baseLabel: string
    level: 'district' | 'province'
    unit: string
    years: Set<number>
    valuesByLocation: Map<string, Record<number, number>>
  }>()

  allSeries.forEach((series) => {
    const subCategory = series.sub_category ?? ''
    const category = series.category ?? 'Uncategorized'
    const resolved = resolveLocationInSubCategory(subCategory)
    if (!resolved) {
      return
    }

    const rawValues = series.cleaned_data ?? {}
    const values = Object.entries(rawValues).reduce<Record<number, number>>((acc, [dateKey, value]) => {
      const year = Number(String(dateKey).slice(0, 4))
      const numeric = Number(value)
      if (Number.isFinite(year) && Number.isFinite(numeric)) {
        acc[year] = numeric
      }
      return acc
    }, {})

    if (Object.keys(values).length === 0) {
      return
    }

    const sourceId = (series.source_id ?? 'nuuuwan').toLowerCase()
    const groupKey = [sourceId, category.trim(), resolved.baseLabel, resolved.level].join('::')

    if (!grouped.has(groupKey)) {
      grouped.set(groupKey, {
        sourceId,
        category,
        baseLabel: resolved.baseLabel,
        level: resolved.level,
        unit: series.scale || 'value',
        years: new Set<number>(),
        valuesByLocation: new Map<string, Record<number, number>>(),
      })
    }

    const group = grouped.get(groupKey)
    if (!group) return

    Object.keys(values)
      .map((year) => Number(year))
      .filter((year) => Number.isFinite(year))
      .forEach((year) => group.years.add(year))

    group.valuesByLocation.set(resolved.canonicalName, values)
  })

  const groupsByKey: Record<string, NuuuwanGroup> = {}
  grouped.forEach((group, key) => {
    if (group.valuesByLocation.size < 3) {
      return
    }

    groupsByKey[key] = {
      key,
      sourceId: group.sourceId,
      category: group.category,
      baseLabel: group.baseLabel,
      level: group.level,
      unit: group.unit,
      years: sortYearsAscending(group.years),
      valuesByLocation: Array.from(group.valuesByLocation.entries()).reduce<Record<string, Record<number, number>>>((acc, [name, values]) => {
        acc[name] = values
        return acc
      }, {}),
    }
  })

  nuuuwanCatalogCache = {
    groupsByKey,
    expiresAt: Date.now() + CATALOG_TTL,
  }

  return groupsByKey
}

function buildLdfDatasetName(path: string): string {
  const segments = path.split('/').filter(Boolean)
  const leaf = segments[segments.length - 1] ?? path
  return leaf
    .replace(/\s+/g, ' ')
    .replace(/\bvs\b/gi, 'vs')
    .trim()
}

async function fetchLdfCatalog(options: FetchOptions = {}): Promise<DatasetManifestEntry[]> {
  const forceRefresh = Boolean(options.forceRefresh)
  const cacheKey = 'ldflk-tree'
  const cached = getCached<LdfTreeResponse>(cacheKey, forceRefresh)
  const treeResponse = cached ?? (await axios.get<LdfTreeResponse>(LDFLK_GIT_TREE_URL)).data
  if (!cached) {
    setCache(cacheKey, treeResponse, CATALOG_TTL)
  }

  const pathMatches = treeResponse.tree
    .map((entry) => entry.path)
    .map((path) => {
      const match = path.match(/^data\/statistics\/(\d{4})\/(.+)\/data\.json$/)
      if (!match) return null
      return {
        year: Number(match[1]),
        path: match[2],
      }
    })
    .filter((entry): entry is { year: number; path: string } => entry !== null)

  return pathMatches
    .sort((a, b) => b.year - a.year || a.path.localeCompare(b.path))
    .map((entry) => {
      const datasetName = buildLdfDatasetName(entry.path)
      const level = inferLevelFromPath(entry.path)
      return {
        id: `ldflk-${entry.year}-${slugify(entry.path)}`,
        name: `${datasetName} (${entry.year})`,
        description: `${datasetName} from LDFLK (${entry.year}).`,
        source: 'ldflk' as const,
        unit: 'value',
        level,
        path: entry.path,
        years: [entry.year],
        metrics: ['Value'],
        defaultMetric: 'Value',
        tags: [
          'live-catalog',
          level,
          String(entry.year),
        ],
      }
    })
}

function formatNuuuwanDatasetName(group: NuuuwanGroup): string {
  const category = group.category.replace(/\s+/g, ' ').trim()
  const baseLabel = toTitleCase(group.baseLabel)
  return `${baseLabel} (${category})`
}

function buildNuuuwanCatalogEntries(groupsByKey: Record<string, NuuuwanGroup>): DatasetManifestEntry[] {
  return Object.values(groupsByKey)
    .sort((a, b) => a.category.localeCompare(b.category) || a.baseLabel.localeCompare(b.baseLabel))
    .map((group) => ({
      id: `nuuuwan-group-${slugify(group.key)}`,
      name: formatNuuuwanDatasetName(group),
      description: `${group.category} by ${group.level}.`,
      source: 'nuuuwan' as const,
      secondarySource: group.sourceId.toUpperCase(),
      unit: group.unit,
      level: group.level,
      path: `nuuuwan-group:${encodeURIComponent(group.key)}`,
      years: group.years,
      metrics: ['Value'],
      defaultMetric: 'Value',
      tags: [
        'live-catalog',
        group.level,
        'timeseries',
      ],
    }))
}

function isNuuuwanGroupPath(datasetPath: string): boolean {
  return datasetPath.startsWith('nuuuwan-group:')
}

function getNuuuwanGroupKey(datasetPath: string): string {
  return decodeURIComponent(datasetPath.replace('nuuuwan-group:', ''))
}

function isLegacyNuuuwanPath(datasetPath: string): boolean {
  return datasetPath.startsWith('nuuuwan:')
}

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

const LEGACY_NUUUWAN_PROVINCES: string[] = [
  'Central', 'Eastern', 'North-Central', 'North-Western',
  'Northern', 'Sabaragamuwa', 'Southern', 'Uva', 'Western',
]

const LEGACY_NUUUWAN_REVENUE_CATEGORIES: string[] = [
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

function buildLegacyNuuuwanUrl(category: string, province: string): string {
  const filename = `cbsl.Analysis of Revenue Collection of Provincial Councils-${category}-${province}.Annual.json`
  return `${NUUUWAN_BASE_URL}/${encodeURIComponent(filename)}`
}

async function fetchLegacyNuuuwanTimeseries(category: string, province: string, options: FetchOptions = {}): Promise<NuuuwanTimeseries | null> {
  const forceRefresh = Boolean(options.forceRefresh)
  const url = buildLegacyNuuuwanUrl(category, province)
  const cacheKey = `legacy-nuuuwan-${category}-${province}`
  const cached = getCached<NuuuwanTimeseries>(cacheKey, forceRefresh)
  if (cached) return cached

  try {
    const { data } = await axios.get<NuuuwanTimeseries>(url)
    setCache(cacheKey, data)
    return data
  } catch {
    return null
  }
}

async function fetchLegacyNuuuwanProvinceData(year: number, category: string, options: FetchOptions = {}): Promise<ProvinceData[]> {
  const dateKey = `${year}-01-01`

  const results = await Promise.allSettled(
    LEGACY_NUUUWAN_PROVINCES.map(async (province) => {
      const timeseries = await fetchLegacyNuuuwanTimeseries(category, province, options)
      if (!timeseries) return null

      const value = timeseries.cleaned_data[dateKey]
      if (value === undefined || value === null) return null

      const normalized = normalizeProvince(province)
      return {
        name: normalized,
        province: normalized,
        value: Number(value),
        originalName: province,
        originalProvince: province,
        originalValue: value,
      } as ProvinceData
    }),
  )

  return results
    .filter((result): result is PromiseFulfilledResult<ProvinceData | null> => result.status === 'fulfilled')
    .map((result) => result.value)
    .filter((entry): entry is ProvinceData => entry !== null && entry.value > 0)
}

export async function fetchDatasetCatalog(options: FetchOptions = {}): Promise<DatasetManifestEntry[]> {
  const forceRefresh = Boolean(options.forceRefresh)
  const cachedManifest = getCached<DatasetManifestEntry[]>('dataset-catalog', forceRefresh)
  if (cachedManifest) {
    datasetManifestState = cachedManifest
    return cachedManifest
  }

  try {
    const [ldflkCatalog, nuuuwanGroups] = await Promise.all([
      fetchLdfCatalog(options),
      fetchNuuuwanGroups(options),
    ])

    const nuuuwanCatalog = buildNuuuwanCatalogEntries(nuuuwanGroups)
    const manifest = [...ldflkCatalog, ...nuuuwanCatalog]

    datasetManifestState = manifest
    catalogLastSyncedAt = Date.now()
    catalogCounts = {
      total: manifest.length,
      ldflk: ldflkCatalog.length,
      nuuuwan: nuuuwanCatalog.length,
    }

    setCache('dataset-catalog', manifest, CATALOG_TTL)
    return manifest
  } catch {
    return datasetManifestState
  }
}

export function getDatasetManifest(): DatasetManifestEntry[] {
  return datasetManifestState
}

export function getCatalogMeta() {
  return {
    lastSyncedAt: catalogLastSyncedAt,
    counts: catalogCounts,
  }
}

function findManifestEntry(datasetId: string): DatasetManifestEntry | undefined {
  return datasetManifestState.find((entry) => entry.id === datasetId)
}

function resolveDatasetPath(year: number, datasetPath: string): string {
  if (isNuuuwanGroupPath(datasetPath) || isLegacyNuuuwanPath(datasetPath)) {
    return datasetPath
  }

  const match = datasetManifestState.find((entry) => entry.path === datasetPath && entry.years.includes(year))
  if (match?.yearPaths?.[year]) {
    return match.yearPaths[year]
  }
  return match?.path ?? datasetPath
}

function getRequestedMetric(datasetId: string, year: number, valueColumn?: string): string | undefined {
  if (valueColumn) return valueColumn
  return getDefaultMetricForYear(datasetId, year) || undefined
}

export function getMetricsForYear(datasetId: string, year: number): string[] {
  const entry = findManifestEntry(datasetId)
  if (!entry) return []
  return entry.yearMetrics?.[year] ?? entry.metrics
}

export function getDefaultMetricForYear(datasetId: string, year: number): string {
  const entry = findManifestEntry(datasetId)
  if (!entry) return ''
  return entry.yearDefaultMetric?.[year] ?? entry.defaultMetric
}

function inferValueColumnIndex(columns: string[], geographicKeyword: 'district' | 'province'): number {
  const lowerKeyword = geographicKeyword.toLowerCase()
  const index = columns.findIndex((column) => {
    const lower = column.toLowerCase()
    return !lower.includes(lowerKeyword)
      && (lower.includes('number') || lower.includes('count') || lower.includes('total') || lower.includes('value'))
  })

  if (index !== -1) return index
  return columns.length - 1
}

export async function fetchDataset(year: number, datasetPath: string, options: FetchOptions = {}): Promise<TabularData> {
  const forceRefresh = Boolean(options.forceRefresh)

  if (isNuuuwanGroupPath(datasetPath)) {
    const key = getNuuuwanGroupKey(datasetPath)
    const groups = await fetchNuuuwanGroups(options)
    const group = groups[key]
    if (!group) {
      return { columns: ['Location', 'Value'], rows: [] }
    }

    const rows = Object.entries(group.valuesByLocation)
      .map(([location, values]) => [location, values[year] ?? null])
      .filter((row) => row[1] !== null)

    return {
      columns: ['Location', 'Value'],
      rows,
    }
  }

  if (isLegacyNuuuwanPath(datasetPath)) {
    const category = LEGACY_NUUUWAN_REVENUE_CATEGORIES[0]
    const provinceRows = await fetchLegacyNuuuwanProvinceData(year, category, options)
    return {
      columns: ['Province', category],
      rows: provinceRows.map((row) => [row.name, row.value]),
    }
  }

  const resolvedPath = resolveDatasetPath(year, datasetPath)
  const cacheKey = `dataset-${year}-${resolvedPath}`
  const cached = getCached<TabularData>(cacheKey, forceRefresh)
  if (cached) return cached

  const url = `${BASE_URL}/${year}/${resolvedPath}/data.json`
  const { data } = await axios.get<TabularData>(url)
  setCache(cacheKey, data)
  return data
}

export async function fetchMetadata(year: number, datasetPath: string, options: FetchOptions = {}): Promise<DatasetMetadata> {
  const forceRefresh = Boolean(options.forceRefresh)

  if (isNuuuwanGroupPath(datasetPath)) {
    const key = getNuuuwanGroupKey(datasetPath)
    const groups = await fetchNuuuwanGroups(options)
    const group = groups[key]

    return {
      dataset_name: group ? formatNuuuwanDatasetName(group) : 'Nuuuwan Grouped Dataset',
      extracted_date: new Date().toISOString(),
      row_count: group ? Object.keys(group.valuesByLocation).length : 0,
    }
  }

  const resolvedPath = resolveDatasetPath(year, datasetPath)
  const cacheKey = `metadata-${year}-${resolvedPath}`
  const cached = getCached<DatasetMetadata>(cacheKey, forceRefresh)
  if (cached) return cached

  const url = `${BASE_URL}/${year}/${resolvedPath}/metadata.json`
  const { data } = await axios.get<DatasetMetadata>(url)
  setCache(cacheKey, data)
  return data
}

export async function fetchDistrictData(
  year: number,
  datasetPath: string,
  valueColumn?: string,
  options: FetchOptions = {},
): Promise<DistrictData[]> {
  if (isNuuuwanGroupPath(datasetPath)) {
    const key = getNuuuwanGroupKey(datasetPath)
    const groups = await fetchNuuuwanGroups(options)
    const group = groups[key]
    if (!group || group.level !== 'district') {
      return []
    }

    return Object.entries(group.valuesByLocation)
      .map(([districtName, values]) => ({
        name: normalizeDistrict(districtName),
        district: normalizeDistrict(districtName),
        value: Number(values[year] ?? 0),
        originalName: districtName,
        originalDistrict: districtName,
        originalValue: values[year],
      }))
      .filter((row) => row.value > 0)
  }

  if (isLegacyNuuuwanPath(datasetPath)) {
    return []
  }

  const tabular = await fetchDataset(year, datasetPath, options)
  const districtCol = tabular.columns.findIndex((column) =>
    column.toLowerCase().includes('district') && !column.toLowerCase().includes('electoral'),
  )
  if (districtCol === -1) return []

  const dataset = datasetManifestState.find((entry) => entry.path === datasetPath && entry.years.includes(year))
  const requestedMetric = getRequestedMetric(dataset?.id ?? '', year, valueColumn)
  const metricColumnIndices = getMetricColumnIndices(tabular.columns, requestedMetric)
  const valueCol = inferValueColumnIndex(tabular.columns, 'district')

  return tabular.rows
    .filter((row) => row[districtCol] && !isAggregateRow(String(row[districtCol])) && (metricColumnIndices.length > 0 || row[valueCol] !== undefined))
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
      } as DistrictData
    })
    .filter((entry) => entry.value > 0)
}

export async function fetchProvinceData(
  year: number,
  datasetPath: string,
  valueColumn?: string,
  options: FetchOptions = {},
): Promise<ProvinceData[]> {
  if (isNuuuwanGroupPath(datasetPath)) {
    const key = getNuuuwanGroupKey(datasetPath)
    const groups = await fetchNuuuwanGroups(options)
    const group = groups[key]
    if (!group || group.level !== 'province') {
      return []
    }

    return Object.entries(group.valuesByLocation)
      .map(([provinceName, values]) => ({
        name: normalizeProvince(provinceName),
        province: normalizeProvince(provinceName),
        value: Number(values[year] ?? 0),
        originalName: provinceName,
        originalProvince: provinceName,
        originalValue: values[year],
      }))
      .filter((row) => row.value > 0)
  }

  if (isLegacyNuuuwanPath(datasetPath)) {
    const category = valueColumn || LEGACY_NUUUWAN_REVENUE_CATEGORIES[0]
    return fetchLegacyNuuuwanProvinceData(year, category, options)
  }

  const tabular = await fetchDataset(year, datasetPath, options)
  const provinceCol = tabular.columns.findIndex((column) => column.toLowerCase().includes('province'))
  if (provinceCol === -1) return []

  const dataset = datasetManifestState.find((entry) => entry.path === datasetPath && entry.years.includes(year))
  const requestedMetric = getRequestedMetric(dataset?.id ?? '', year, valueColumn)
  const metricColumnIndices = getMetricColumnIndices(tabular.columns, requestedMetric)
  const valueCol = inferValueColumnIndex(tabular.columns, 'province')

  return tabular.rows
    .filter((row) => row[provinceCol] && !isAggregateRow(String(row[provinceCol])) && (metricColumnIndices.length > 0 || row[valueCol] !== undefined))
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
      } as ProvinceData
    })
    .filter((entry) => entry.value > 0)
}

let geojsonCache: FeatureCollection | null = null

export interface DatasetSeriesPoint {
  name: string
  values: Record<number, number>
}

export async function fetchDatasetSeries(
  datasetId: string,
  metric?: string,
  options: FetchOptions = {},
): Promise<DatasetSeriesPoint[]> {
  const dataset = findManifestEntry(datasetId)
  if (!dataset) {
    return []
  }

  if (isNuuuwanGroupPath(dataset.path)) {
    const key = getNuuuwanGroupKey(dataset.path)
    const groups = await fetchNuuuwanGroups(options)
    const group = groups[key]
    if (!group) return []

    return Object.entries(group.valuesByLocation).map(([name, values]) => ({ name, values }))
  }

  const byName = new Map<string, DatasetSeriesPoint>()

  const yearRows = await Promise.all(
    dataset.years.map(async (year) => {
      if (dataset.level === 'district') {
        const rows = await fetchDistrictData(year, dataset.path, metric, options)
        return { year, rows }
      }

      if (dataset.level === 'province') {
        const rows = await fetchProvinceData(year, dataset.path, metric, options)
        return { year, rows }
      }

      const tabular = await fetchDataset(year, dataset.path, options)
      const labelColumnIndex = tabular.columns.findIndex((column) =>
        ['district', 'province', 'name', 'category', 'item', 'indicator'].some((keyword) => column.toLowerCase().includes(keyword)),
      )
      const safeLabelIndex = labelColumnIndex !== -1 ? labelColumnIndex : 0
      const numericColumnIndex = tabular.columns.findIndex((column, index) => index !== safeLabelIndex && /value|total|count|number|amount|index/i.test(column))
      const safeValueIndex = numericColumnIndex !== -1 ? numericColumnIndex : Math.max(1, tabular.columns.length - 1)

      const rows = tabular.rows
        .filter((row) => row[safeLabelIndex] !== undefined)
        .map((row) => ({
          name: String(row[safeLabelIndex]),
          value: Number(row[safeValueIndex]) || 0,
        }))
        .filter((row) => row.name && !isAggregateRow(row.name))

      return { year, rows }
    }),
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

export async function fetchNuuuwanSeriesCatalog(options: FetchOptions = {}): Promise<NuuuwanSeries[]> {
  const groups = await fetchNuuuwanGroups(options)
  return Object.values(groups).map((group) => ({
    id: group.key,
    label: formatNuuuwanDatasetName(group),
    source: `nuuuwan (${group.sourceId.toUpperCase()})`,
    unit: group.unit,
    frequency: 'Annual',
    values: {},
  }))
}

export async function inferDatasetLevel(year: number, datasetPath: string, options: FetchOptions = {}): Promise<'district' | 'province' | 'national'> {
  if (isNuuuwanGroupPath(datasetPath)) {
    const key = getNuuuwanGroupKey(datasetPath)
    const groups = await fetchNuuuwanGroups(options)
    const group = groups[key]
    if (!group) return 'national'
    return group.level
  }

  if (isLegacyNuuuwanPath(datasetPath)) {
    return 'province'
  }

  const dataset = await fetchDataset(year, datasetPath, options)
  return inferTabularLevel(dataset.columns)
}

export async function loadGeoJSON(): Promise<FeatureCollection> {
  if (geojsonCache) return geojsonCache

  const { data } = await axios.get<FeatureCollection>('/data/sri-lanka-districts.geojson')
  geojsonCache = data
  return data
}
