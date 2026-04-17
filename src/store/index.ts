'use client'

import { create } from 'zustand'
import { persist, devtools } from 'zustand/middleware'
import type { AppTab, ColorScale, VisualizationMode, LatLngTuple, MapData, TabularData, ThemeMode, DatasetManifestEntry } from '@/types'
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

interface LoadDatasetOptions {
  forceRefresh?: boolean
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
  loading: boolean
  error: string | null

  sidebarOpen: boolean
  visualizationMode: VisualizationMode
  showChoropleth: boolean
  showCentroids: boolean
  currentTab: AppTab
  colorScale: ColorScale
  showTooltips: boolean
  themeMode: ThemeMode

  setMapCenter: (center: LatLngTuple) => void
  setZoom: (zoom: number) => void
  selectDistrict: (district: string | null) => void
  selectProvince: (province: string | null) => void
  initializeCatalog: (forceRefresh?: boolean) => Promise<void>
  loadDataset: (datasetId: string, year: number, metric?: string, options?: LoadDatasetOptions) => Promise<void>
  setSelectedMetric: (metric: string) => void
  setVisualizationMode: (mode: VisualizationMode) => void
  setShowChoropleth: (show: boolean) => void
  setShowCentroids: (show: boolean) => void
  setCurrentTab: (tab: AppTab) => void
  setThemeMode: (mode: ThemeMode) => void
  toggleSidebar: () => void
  setColorScale: (scale: ColorScale) => void
  toggleTooltips: () => void
  resetSelection: () => void
}

const DEFAULT_COLOR_SCALE: ColorScale = {
  min: 0,
  max: 100,
  colors: ['#f2f3f5', '#c0d8f5', '#7cb3e8', '#3d8fd6', '#1f68ad', '#17457a'],
}

const SRI_LANKA_CENTER: LatLngTuple = [7.8731, 80.7718]

let _loadRequestId = 0

const PROVINCE_TO_DISTRICTS: Record<string, string[]> = {
  'Western Province': ['Colombo', 'Gampaha', 'Kalutara'],
  'Central Province': ['Kandy', 'Matale', 'Nuwara Eliya'],
  'Southern Province': ['Galle', 'Matara', 'Hambantota'],
  'Northern Province': ['Jaffna', 'Kilinochchi', 'Mannar', 'Vavuniya', 'Mullaitivu'],
  'Eastern Province': ['Batticaloa', 'Ampara', 'Trincomalee'],
  'North Western Province': ['Kurunegala', 'Puttalam'],
  'North Central Province': ['Anuradhapura', 'Polonnaruwa'],
  'Uva Province': ['Badulla', 'Moneragala'],
  'Sabaragamuwa Province': ['Ratnapura', 'Kegalle'],
}

function pickDefaultDataset(manifest: DatasetManifestEntry[]): DatasetManifestEntry | null {
  if (manifest.length === 0) return null

  const mapFriendly = manifest.find((dataset) => dataset.level !== 'national')
  return mapFriendly ?? manifest[0]
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
        loading: false,
        error: null,

        sidebarOpen: true,
        visualizationMode: 'choropleth',
        showChoropleth: true,
        showCentroids: false,
        currentTab: 'map',
        colorScale: DEFAULT_COLOR_SCALE,
        showTooltips: true,
        themeMode: 'system',

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

          const requestId = ++_loadRequestId

          set({
            loading: true,
            error: null,
            data: null,
            tableData: null,
            seriesData: {},
            colorScale: DEFAULT_COLOR_SCALE,
            currentDataset: datasetId,
            currentYear: supportedYear,
            selectedMetric,
            currentDatasetLevel: dataset.level,
            currentDatasetSource: dataset.source,
            currentDatasetSecondarySource: dataset.secondarySource ?? null,
            currentDatasetUnit: dataset.unit,
            availableMetrics,
          })

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
            const colorScale: ColorScale = {
              min: values.length > 0 ? Math.min(...values) : DEFAULT_COLOR_SCALE.min,
              max: values.length > 0 ? Math.max(...values) : DEFAULT_COLOR_SCALE.max,
              colors: DEFAULT_COLOR_SCALE.colors,
            }

            const tableData = await fetchDataset(supportedYear, dataset.path, options)

            const shouldLoadSeries = get().currentTab === 'timeseries'
            const rawSeries = shouldLoadSeries
              ? await fetchDatasetSeries(datasetId, selectedMetric, options)
              : []
            const seriesData = rawSeries.reduce<Record<string, Record<number, number>>>((acc, point) => {
              acc[point.name] = point.values
              return acc
            }, {})

            if (requestId !== _loadRequestId) return

            set({
              data,
              loading: false,
              colorScale,
              tableData,
              seriesData,
              currentDatasetLevel: resolvedLevel,
            })
          } catch (err) {
            if (requestId !== _loadRequestId) return
            set({
              error: err instanceof Error ? err.message : 'Failed to load dataset',
              loading: false,
              data: null,
              colorScale: DEFAULT_COLOR_SCALE,
            })
          }
        },

        setSelectedMetric: (metric) => {
          const { currentDataset, currentYear } = get()
          set({ selectedMetric: metric })

          if (currentDataset) {
            void get().loadDataset(currentDataset, currentYear, metric)
          }
        },

        setVisualizationMode: (mode) => set({ visualizationMode: mode }),
        setShowChoropleth: (show) => set({ showChoropleth: show }),
        setShowCentroids: (show) => set({ showCentroids: show }),
        setCurrentTab: (tab) => {
          set({ currentTab: tab })
          const { currentDataset, currentYear, selectedMetric } = get()
          if (tab === 'timeseries' && currentDataset && Object.keys(get().seriesData).length === 0) {
            void get().loadDataset(currentDataset, currentYear, selectedMetric ?? undefined)
          }
        },
        setThemeMode: (mode) => set({ themeMode: mode }),
        toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
        setColorScale: (scale) => set({ colorScale: scale }),
        toggleTooltips: () => set((state) => ({ showTooltips: !state.showTooltips })),
        resetSelection: () => set({ selectedDistrict: null, selectedProvince: null }),
      }),
      {
        name: 'sri-lanka-visualizer',
        partialize: (state) => ({
          sidebarOpen: state.sidebarOpen,
          visualizationMode: state.visualizationMode,
          currentTab: state.currentTab,
          showTooltips: state.showTooltips,
          currentYear: state.currentYear,
          selectedMetric: state.selectedMetric,
          themeMode: state.themeMode,
          currentDataset: state.currentDataset,
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
  loading: state.loading,
  error: state.error,
  datasetManifest: state.datasetManifest,
  catalogLoading: state.catalogLoading,
  lastCatalogSync: state.lastCatalogSync,
  catalogCounts: state.catalogCounts,
}))

export const useUIState = () => useAppStore((state) => ({
  sidebarOpen: state.sidebarOpen,
  visualizationMode: state.visualizationMode,
  showChoropleth: state.showChoropleth,
  showCentroids: state.showCentroids,
  currentTab: state.currentTab,
  colorScale: state.colorScale,
  showTooltips: state.showTooltips,
  themeMode: state.themeMode,
}))
