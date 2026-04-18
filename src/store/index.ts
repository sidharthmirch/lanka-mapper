'use client'

import { create } from 'zustand'
import { persist, devtools } from 'zustand/middleware'
import type { AppTab, ColorScale, LatLngTuple, MapData, TabularData, ThemeMode, DatasetManifestEntry } from '@/types'
import {
  fetchDataset,
  fetchDatasetCatalog,
  fetchDatasetSeries,
  fetchDistrictData,
  fetchProvinceData,
  getCatalogMeta,
  getDefaultMetricForYear,
  getMetricsForYear,
  inferDatasetLevel,
} from '@/services/dataService'
import { type AccentTone, DEFAULT_ACCENT_ID, DEFAULT_GRADIENT_ID, getGradientColors } from '@/lib/uiThemePresets'
import { buildMapDataInterpolated, PROVINCE_TO_DISTRICTS } from '@/lib/mapInterpolation'

interface LoadDatasetOptions {
  forceRefresh?: boolean
  /**
   * Background revalidations (catalog polls) should not blank the visible
   * map/table/series while the new payload is in flight; only clear state
   * when the identity of the dataset actually changes.
   */
  silent?: boolean
}

interface AppState {
  mapCenter: LatLngTuple
  zoom: number
  selectedDistrict: string | null
  selectedProvince: string | null

  datasetManifest: DatasetManifestEntry[]
  catalogLoading: boolean
  lastCatalogSync: number | null
  catalogCounts: {
    total: number
    ldflk: number
    nuuuwan: number
  }

  currentDataset: string | null
  currentYear: number
  data: MapData[] | null
  selectedMetric: string | null
  currentDatasetLevel: 'district' | 'province' | 'national' | null
  currentDatasetSource: 'ldflk' | 'nuuuwan' | null
  currentDatasetSecondarySource: string | null
  currentDatasetUnit: string | null
  availableMetrics: string[]
  tableData: TabularData | null
  seriesData: Record<string, Record<number, number>>
  /** Inclusive year range for the Plots tab (map tab uses currentYear). */
  plotYearRange: [number, number] | null
  plotSeriesSelection: string[]
  loading: boolean
  error: string | null

  sidebarOpen: boolean
  showChoropleth: boolean
  showCentroids: boolean
  currentTab: AppTab
  colorScale: ColorScale
  showTooltips: boolean
  themeMode: ThemeMode
  /** UI accent (MUI primary + `--primary`). */
  accentPresetId: string
  /** Bold preset colors vs soft grey-tint (`soft`) for primary UI. */
  accentTone: AccentTone
  /** Choropleth / region shading color ramp. */
  gradientPresetId: string
  /** Thousands separators in formatted numbers. */
  numberUseGrouping: boolean
  /** 0 = auto; otherwise max significant digits (3–6 typical). */
  numberMaxSigFigs: number

  setMapCenter: (center: LatLngTuple) => void
  setZoom: (zoom: number) => void
  selectDistrict: (district: string | null) => void
  selectProvince: (province: string | null) => void
  initializeCatalog: (forceRefresh?: boolean) => Promise<void>
  loadDataset: (datasetId: string, year: number, metric?: string, options?: LoadDatasetOptions) => Promise<void>
  setSelectedMetric: (metric: string) => void
  setShowChoropleth: (show: boolean) => void
  setShowCentroids: (show: boolean) => void
  setCurrentTab: (tab: AppTab) => void
  setPlotYearRange: (range: [number, number]) => void
  setPlotSeriesSelection: (names: string[]) => void
  setThemeMode: (mode: ThemeMode) => void
  setAccentPresetId: (id: string) => void
  setAccentTone: (tone: AccentTone) => void
  setGradientPresetId: (id: string) => void
  toggleSidebar: () => void
  setColorScale: (scale: ColorScale) => void
  toggleTooltips: () => void
  resetSelection: () => void
  /** Updates map data + year from preloaded time series (no network). */
  applyMapYearFromSeries: (year: number) => void
  /** Linearly interpolates values between two data years for smooth playback. */
  applyMapInterpolatedFrame: (y0: number, y1: number, t: number) => void
  setNumberUseGrouping: (value: boolean) => void
  setNumberMaxSigFigs: (value: number) => void
}

const DEFAULT_COLOR_SCALE: ColorScale = {
  min: 0,
  max: 100,
  colors: getGradientColors(DEFAULT_GRADIENT_ID),
}

const SRI_LANKA_CENTER: LatLngTuple = [7.8731, 80.7718]

let _loadRequestId = 0

/**
 * De-dupe in-flight loadDataset calls with identical (datasetId, year,
 * metric, forceRefresh) tuples. Tab/metric/interval-poll wiring can all
 * fire into the same underlying fetch within a single render burst; the
 * `_loadRequestId` guard only prevents stale *writes*, not duplicate
 * network round-trips.
 */
const _inFlightLoads = new Map<string, Promise<void>>()

function buildLoadDedupKey(datasetId: string, year: number, metric: string | undefined, forceRefresh: boolean): string {
  return `${datasetId}::${year}::${metric ?? ''}::${forceRefresh ? '1' : '0'}`
}


function pickDefaultDataset(manifest: DatasetManifestEntry[]): DatasetManifestEntry | null {
  if (manifest.length === 0) return null

  const mapFriendly = manifest.find((dataset) => dataset.level !== 'national')
  return mapFriendly ?? manifest[0]
}

function buildMapDataFromSeries(
  seriesData: Record<string, Record<number, number>>,
  year: number,
  level: 'district' | 'province' | 'national' | null,
): MapData[] {
  if (!level || level === 'national') {
    return []
  }

  if (level === 'district') {
    return Object.entries(seriesData)
      .map(([name, values]) => ({
        name,
        district: name,
        value: values[year] ?? 0,
      }))
      .filter((row) => row.value > 0)
  }

  const expanded: MapData[] = []
  for (const [provinceName, values] of Object.entries(seriesData)) {
    const v = values[year] ?? 0
    if (v <= 0) continue
    const districts = PROVINCE_TO_DISTRICTS[provinceName] ?? []
    for (const d of districts) {
      expanded.push({
        name: d,
        district: d,
        value: v,
        originalName: provinceName,
      })
    }
  }
  return expanded
}

/**
 * Stack-safe min/max scan. `Math.min(...arr)` / `Math.max(...arr)` use the
 * call stack for arguments and can blow up beyond ~tens of thousands of
 * entries — fine for Sri Lanka districts, but cheap insurance for future
 * national-level series.
 */
function minMax(values: number[]): { min: number; max: number } | null {
  if (values.length === 0) return null
  let min = values[0]
  let max = values[0]
  for (let i = 1; i < values.length; i++) {
    const v = values[i]
    if (v < min) min = v
    if (v > max) max = v
  }
  return { min, max }
}

function deriveColorScaleFromValues(values: number[], gradientPresetId: string): ColorScale {
  const positives = values.filter((v) => v > 0)
  const bounds = minMax(positives)
  return {
    min: bounds?.min ?? DEFAULT_COLOR_SCALE.min,
    max: bounds?.max ?? DEFAULT_COLOR_SCALE.max,
    colors: getGradientColors(gradientPresetId),
  }
}

export const useAppStore = create<AppState>()(
  devtools(
    persist(
      (set, get) => ({
        mapCenter: SRI_LANKA_CENTER,
        zoom: 8,
        selectedDistrict: null,
        selectedProvince: null,

        datasetManifest: [],
        catalogLoading: false,
        lastCatalogSync: null,
        catalogCounts: {
          total: 0,
          ldflk: 0,
          nuuuwan: 0,
        },

        currentDataset: null,
        currentYear: new Date().getFullYear(),
        data: null,
        selectedMetric: null,
        currentDatasetLevel: null,
        currentDatasetSource: null,
        currentDatasetSecondarySource: null,
        currentDatasetUnit: null,
        availableMetrics: [],
        tableData: null,
        seriesData: {},
        plotYearRange: null,
        plotSeriesSelection: [],
        loading: false,
        error: null,

        sidebarOpen: true,
        showChoropleth: true,
        showCentroids: false,
        currentTab: 'map',
        colorScale: DEFAULT_COLOR_SCALE,
        showTooltips: true,
        themeMode: 'system',
        accentPresetId: DEFAULT_ACCENT_ID,
        accentTone: 'main',
        gradientPresetId: DEFAULT_GRADIENT_ID,
        numberUseGrouping: true,
        numberMaxSigFigs: 0,

        setMapCenter: (center) => set({ mapCenter: center }),
        setZoom: (zoom) => set({ zoom }),
        selectDistrict: (district) => set({ selectedDistrict: district, selectedProvince: null }),
        selectProvince: (province) => set({ selectedProvince: province, selectedDistrict: null }),

        initializeCatalog: async (forceRefresh = false) => {
          set({ catalogLoading: true, error: null })

          try {
            const manifest = await fetchDatasetCatalog({ forceRefresh })
            const meta = getCatalogMeta()
            const activeDatasetId = get().currentDataset
            const resolvedActiveDataset = activeDatasetId
              ? manifest.find((dataset) => dataset.id === activeDatasetId)
              : null
            const fallbackDataset = pickDefaultDataset(manifest)
            const datasetToLoad = resolvedActiveDataset ?? fallbackDataset

            set({
              datasetManifest: manifest,
              catalogLoading: false,
              lastCatalogSync: meta.lastSyncedAt,
              catalogCounts: meta.counts,
            })

            if (!datasetToLoad) {
              return
            }

            const nextYear = datasetToLoad.years.includes(get().currentYear)
              ? get().currentYear
              : datasetToLoad.years[datasetToLoad.years.length - 1]

            await get().loadDataset(datasetToLoad.id, nextYear, get().selectedMetric ?? undefined, { forceRefresh })
          } catch (err) {
            set({
              catalogLoading: false,
              error: err instanceof Error ? err.message : 'Failed to load live dataset catalog',
            })
          }
        },

        loadDataset: async (datasetId, year, metric, options = {}) => {
          const dataset = get().datasetManifest.find((entry) => entry.id === datasetId)
          if (!dataset) {
            set({ error: 'Dataset not found', loading: false })
            return
          }

          const supportedYear = dataset.years.includes(year)
            ? year
            : dataset.years[dataset.years.length - 1]

          const availableMetrics = getMetricsForYear(datasetId, supportedYear)
          const requestedMetric = metric ?? get().selectedMetric ?? getDefaultMetricForYear(datasetId, supportedYear)
          const selectedMetric = availableMetrics.includes(requestedMetric)
            ? requestedMetric
            : getDefaultMetricForYear(datasetId, supportedYear)

          const forceRefresh = Boolean(options.forceRefresh)
          const dedupKey = buildLoadDedupKey(datasetId, supportedYear, selectedMetric, forceRefresh)
          const existing = _inFlightLoads.get(dedupKey)
          if (existing) {
            return existing
          }

          // Silent refresh: same dataset identity + data already on screen →
          // keep the old payload rendered while the new one is in flight so
          // we don't flash a loading spinner on background revalidation.
          const currentState = get()
          const isSameDataset = currentState.currentDataset === datasetId
            && currentState.currentYear === supportedYear
            && currentState.selectedMetric === selectedMetric
          const keepExistingRender = Boolean(options.silent)
            && isSameDataset
            && currentState.data !== null

          const requestId = ++_loadRequestId

          if (keepExistingRender) {
            set({
              error: null,
              currentDataset: datasetId,
              currentYear: supportedYear,
              selectedMetric,
              currentDatasetLevel: dataset.level,
              currentDatasetSource: dataset.source,
              currentDatasetSecondarySource: dataset.secondarySource ?? null,
              currentDatasetUnit: dataset.unit,
              availableMetrics,
            })
          } else {
            set({
              loading: true,
              error: null,
              data: null,
              tableData: null,
              seriesData: {},
              colorScale: {
                ...DEFAULT_COLOR_SCALE,
                colors: getGradientColors(get().gradientPresetId),
              },
              currentDataset: datasetId,
              currentYear: supportedYear,
              selectedMetric,
              currentDatasetLevel: dataset.level,
              currentDatasetSource: dataset.source,
              currentDatasetSecondarySource: dataset.secondarySource ?? null,
              currentDatasetUnit: dataset.unit,
              availableMetrics,
            })
          }

          const run = async () => {
          try {
            const levelHint = dataset.level
            let resolvedLevel: 'district' | 'province' | 'national' = levelHint
            let data: MapData[] = []

            const districtData = (levelHint === 'district' || levelHint === 'national')
              ? await fetchDistrictData(supportedYear, dataset.path, selectedMetric, options)
              : []

            if (districtData.length > 0) {
              resolvedLevel = 'district'
              data = districtData.map((district) => ({
                name: district.name,
                district: district.district,
                value: district.value,
                originalName: district.originalName,
                originalValue: district.originalValue,
              }))
            }

            if (data.length === 0 && (levelHint === 'province' || levelHint === 'national')) {
              const provinceData = await fetchProvinceData(supportedYear, dataset.path, selectedMetric, options)
              if (provinceData.length > 0) {
                resolvedLevel = 'province'
                const expanded: MapData[] = []

                for (const province of provinceData) {
                  const districts = PROVINCE_TO_DISTRICTS[province.name] || []
                  for (const district of districts) {
                    expanded.push({
                      name: district,
                      district,
                      value: province.value,
                      originalName: province.originalName,
                      originalValue: province.originalValue,
                    })
                  }
                }

                data = expanded
              }
            }

            if (data.length === 0 && levelHint === 'national') {
              resolvedLevel = await inferDatasetLevel(supportedYear, dataset.path, options)
            }

            const values = data.map((entry) => entry.value)
            const bounds = minMax(values)
            const colorScale: ColorScale = {
              min: bounds?.min ?? DEFAULT_COLOR_SCALE.min,
              max: bounds?.max ?? DEFAULT_COLOR_SCALE.max,
              colors: getGradientColors(get().gradientPresetId),
            }

            const tableData = await fetchDataset(supportedYear, dataset.path, options)

            const shouldLoadSeries = dataset.hasTime
            const rawSeries = shouldLoadSeries
              ? await fetchDatasetSeries(datasetId, selectedMetric, options)
              : []
            const seriesData = rawSeries.reduce<Record<string, Record<number, number>>>((acc, point) => {
              acc[point.name] = point.values
              return acc
            }, {})

            if (requestId !== _loadRequestId) return

            const sortedDatasetYears = [...dataset.years].sort((a, b) => a - b)
            const defaultPlotRange: [number, number] = [
              sortedDatasetYears[0] ?? supportedYear,
              sortedDatasetYears[sortedDatasetYears.length - 1] ?? supportedYear,
            ]

            const seriesKeys = Object.keys(seriesData).sort((a, b) => a.localeCompare(b))
            const defaultPlotSeries = seriesKeys.slice(0, Math.min(4, seriesKeys.length))

            set({
              data,
              loading: false,
              colorScale,
              tableData,
              seriesData,
              plotYearRange: defaultPlotRange,
              plotSeriesSelection: defaultPlotSeries,
              currentDatasetLevel: resolvedLevel,
            })
          } catch (err) {
            if (requestId !== _loadRequestId) return
            // On silent refresh, keep the last-known-good payload visible so
            // a transient upstream failure doesn't wipe the screen; only the
            // error string is surfaced.
            if (keepExistingRender) {
              set({
                error: err instanceof Error ? err.message : 'Failed to load dataset',
                loading: false,
              })
            } else {
              set({
                error: err instanceof Error ? err.message : 'Failed to load dataset',
                loading: false,
                data: null,
                colorScale: {
                  ...DEFAULT_COLOR_SCALE,
                  colors: getGradientColors(get().gradientPresetId),
                },
              })
            }
          }
          }

          const promise = run().finally(() => {
            if (_inFlightLoads.get(dedupKey) === promise) {
              _inFlightLoads.delete(dedupKey)
            }
          })
          _inFlightLoads.set(dedupKey, promise)
          return promise
        },

        setSelectedMetric: (metric) => {
          const { currentDataset, currentYear } = get()
          set({ selectedMetric: metric })

          if (currentDataset) {
            void get().loadDataset(currentDataset, currentYear, metric)
          }
        },

        setShowChoropleth: (show) => set({ showChoropleth: show }),
        setShowCentroids: (show) => set({ showCentroids: show }),
        setCurrentTab: (tab) => {
          set({ currentTab: tab })
          const { currentDataset, currentYear, selectedMetric } = get()
          if (tab === 'plots' && currentDataset && Object.keys(get().seriesData).length === 0) {
            void get().loadDataset(currentDataset, currentYear, selectedMetric ?? undefined)
          }
        },
        setPlotYearRange: (range) => set({ plotYearRange: range }),
        setPlotSeriesSelection: (names) => set({ plotSeriesSelection: names }),
        setThemeMode: (mode) => set({ themeMode: mode }),
        setAccentPresetId: (id) => set({ accentPresetId: id }),
        setAccentTone: (tone) => set({ accentTone: tone }),
        setGradientPresetId: (id) => set((state) => ({
          gradientPresetId: id,
          colorScale: {
            ...state.colorScale,
            colors: getGradientColors(id),
          },
        })),
        setNumberUseGrouping: (value) => set({ numberUseGrouping: value }),
        setNumberMaxSigFigs: (value) => set({
          numberMaxSigFigs: Math.max(0, Math.min(12, Math.floor(value))),
        }),
        toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
        setColorScale: (scale) => set({ colorScale: scale }),
        toggleTooltips: () => set((state) => ({ showTooltips: !state.showTooltips })),
        resetSelection: () => set({ selectedDistrict: null, selectedProvince: null }),

        applyMapYearFromSeries: (year: number) => {
          const dataset = get().datasetManifest.find((d) => d.id === get().currentDataset)
          const seriesData = get().seriesData
          const level = get().currentDatasetLevel

          if (!dataset?.hasTime || Object.keys(seriesData).length === 0 || !level || level === 'national') {
            return
          }

          const data = buildMapDataFromSeries(seriesData, year, level)
          if (data.length === 0) return

          const colorScale = deriveColorScaleFromValues(data.map((e) => e.value), get().gradientPresetId)
          set({ currentYear: year, data, colorScale })
        },

        applyMapInterpolatedFrame: (y0, y1, t) => {
          const dataset = get().datasetManifest.find((d) => d.id === get().currentDataset)
          const seriesData = get().seriesData
          const level = get().currentDatasetLevel

          if (!dataset?.hasTime || Object.keys(seriesData).length === 0 || !level || level === 'national') {
            return
          }

          const data = buildMapDataInterpolated(seriesData, y0, y1, t, level)
          if (data.length === 0) return

          // Derive the color scale from the endpoint years (y0 and y1) rather than the
          // current interpolated values, so the min/max domain stays stable across
          // every frame in the segment and the legend doesn't jitter.
          const endpointData = [
            ...buildMapDataInterpolated(seriesData, y0, y1, 0, level),
            ...buildMapDataInterpolated(seriesData, y0, y1, 1, level),
          ]
          const colorScale = deriveColorScaleFromValues(
            endpointData.map((e) => e.value),
            get().gradientPresetId,
          )
          set({ data, colorScale })
        },
      }),
      {
        name: 'sri-lanka-visualizer',
        version: 7,
        migrate: (persistedState: unknown, version: number) => {
          const state = persistedState as Record<string, unknown>
          if (version === 0) {
            // Migrate timeseries → plots
            if (state.currentTab === 'timeseries') {
              state.currentTab = 'plots'
            }
          }
          if (version < 2) {
            state.plotYearRange = null
            state.plotSeriesSelection = []
          }
          if (version < 3) {
            // Field removed: plotYScaleMode never shipped
            delete state.plotYScaleMode
          }
          if (version < 4) {
            state.accentPresetId = state.accentPresetId ?? DEFAULT_ACCENT_ID
            state.gradientPresetId = state.gradientPresetId ?? DEFAULT_GRADIENT_ID
          }
          if (version < 5) {
            state.numberUseGrouping = state.numberUseGrouping ?? true
            state.numberMaxSigFigs = state.numberMaxSigFigs ?? 0
          }
          if (version < 6) {
            state.accentTone = (state.accentTone as AccentTone | undefined) ?? 'main'
          }
          if (version < 7) {
            // visualizationMode removed (heatmap never wired)
            delete state.visualizationMode
          }
          return state as unknown as AppState
        },
        partialize: (state) => ({
          sidebarOpen: state.sidebarOpen,
          currentTab: state.currentTab,
          showTooltips: state.showTooltips,
          currentYear: state.currentYear,
          selectedMetric: state.selectedMetric,
          themeMode: state.themeMode,
          currentDataset: state.currentDataset,
          accentPresetId: state.accentPresetId,
          accentTone: state.accentTone,
          gradientPresetId: state.gradientPresetId,
          numberUseGrouping: state.numberUseGrouping,
          numberMaxSigFigs: state.numberMaxSigFigs,
        }),
      },
    ),
    { name: 'SriLankaStore' },
  ),
)

export const useMapState = () => useAppStore((state) => ({
  center: state.mapCenter,
  zoom: state.zoom,
  selectedDistrict: state.selectedDistrict,
  selectedProvince: state.selectedProvince,
}))

export const useDataState = () => useAppStore((state) => ({
  dataset: state.currentDataset,
  year: state.currentYear,
  data: state.data,
  selectedMetric: state.selectedMetric,
  currentDatasetLevel: state.currentDatasetLevel,
  currentDatasetSource: state.currentDatasetSource,
  currentDatasetSecondarySource: state.currentDatasetSecondarySource,
  currentDatasetUnit: state.currentDatasetUnit,
  availableMetrics: state.availableMetrics,
  tableData: state.tableData,
  seriesData: state.seriesData,
  plotYearRange: state.plotYearRange,
  plotSeriesSelection: state.plotSeriesSelection,
  loading: state.loading,
  error: state.error,
  datasetManifest: state.datasetManifest,
  catalogLoading: state.catalogLoading,
  lastCatalogSync: state.lastCatalogSync,
  catalogCounts: state.catalogCounts,
}))

export const useUIState = () => useAppStore((state) => ({
  sidebarOpen: state.sidebarOpen,
  showChoropleth: state.showChoropleth,
  showCentroids: state.showCentroids,
  currentTab: state.currentTab,
  colorScale: state.colorScale,
  showTooltips: state.showTooltips,
  themeMode: state.themeMode,
  accentPresetId: state.accentPresetId,
  accentTone: state.accentTone,
  gradientPresetId: state.gradientPresetId,
}))
