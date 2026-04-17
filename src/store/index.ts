'use client'

import { create } from 'zustand'
import { persist, devtools } from 'zustand/middleware'
import type { AppTab, ColorScale, VisualizationMode, LatLngTuple, MapData, TabularData, ThemeMode } from '@/types'
import {
  fetchDistrictData,
  fetchDatasetSeries,
  fetchProvinceData,
  AVAILABLE_DATASETS,
  DATASET_MANIFEST,
  getMetricsForYear,
  getDefaultMetricForYear,
} from '@/services/dataService'

interface AppState {
  mapCenter: LatLngTuple
  zoom: number
  selectedDistrict: string | null
  selectedProvince: string | null
  
  currentDataset: string | null
  currentYear: number
  data: MapData[] | null
  selectedMetric: string | null
  currentDatasetLevel: 'district' | 'province' | null
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
  loadDataset: (datasetId: string, year: number, metric?: string) => Promise<void>
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
  colors: ['#e3f2fd', '#90caf9', '#42a5f5', '#1e88e5', '#1565c0', '#0d47a1'],
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

export const useAppStore = create<AppState>()(
  devtools(
    persist(
      (set, get) => ({
        mapCenter: SRI_LANKA_CENTER,
        zoom: 8,
        selectedDistrict: null,
        selectedProvince: null,
        
        currentDataset: null,
        currentYear: 2024,
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
        
        loadDataset: async (datasetId, year, metric) => {
          const dataset = AVAILABLE_DATASETS.find(d => d.id === datasetId)
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

          // Increment request ID — any older in-flight response will be ignored
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
            currentDatasetSource: DATASET_MANIFEST.find((entry) => entry.id === datasetId)?.source ?? null,
            currentDatasetSecondarySource: DATASET_MANIFEST.find((entry) => entry.id === datasetId)?.secondarySource ?? null,
            currentDatasetUnit: DATASET_MANIFEST.find((entry) => entry.id === datasetId)?.unit ?? null,
            availableMetrics,
          })
          
          try {
            let data: MapData[]
            if (dataset.level === 'district') {
              const districtData = await fetchDistrictData(supportedYear, dataset.path, selectedMetric)
              data = districtData.map((district) => ({
                name: district.name,
                district: district.district,
                value: district.value,
                originalName: district.originalName,
                originalValue: district.originalValue,
              }))
            } else {
              const provinceData = await fetchProvinceData(supportedYear, dataset.path, selectedMetric)
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

              const provinceValues = provinceData.map((province) => province.value)
              const colorScale: ColorScale = {
                min: provinceValues.length > 0 ? Math.min(...provinceValues) : DEFAULT_COLOR_SCALE.min,
                max: provinceValues.length > 0 ? Math.max(...provinceValues) : DEFAULT_COLOR_SCALE.max,
                colors: DEFAULT_COLOR_SCALE.colors,
              }

              const shouldLoadSeries = get().currentTab === 'timeseries'
              const rawSeries = shouldLoadSeries ? await fetchDatasetSeries(datasetId, selectedMetric) : []
              const seriesData = rawSeries.reduce<Record<string, Record<number, number>>>((acc, point) => {
                acc[point.name] = point.values
                return acc
              }, {})

              const tableData: TabularData = {
                columns: ['Name', 'Value'],
                rows: provinceData.map((item) => [item.originalName ?? item.name, item.value]),
              }

              if (requestId !== _loadRequestId) return
              set({ data, loading: false, colorScale, tableData, seriesData })
              return
            }
            
            const values = data.map(d => d.value)
            const colorScale: ColorScale = {
              min: values.length > 0 ? Math.min(...values) : DEFAULT_COLOR_SCALE.min,
              max: values.length > 0 ? Math.max(...values) : DEFAULT_COLOR_SCALE.max,
              colors: DEFAULT_COLOR_SCALE.colors,
            }
            
            const tableData = {
              columns: ['Name', 'Value'],
              rows: data.map((item) => [item.originalName ?? item.name, item.value]),
            }

            const shouldLoadSeries = get().currentTab === 'timeseries'
            const rawSeries = shouldLoadSeries ? await fetchDatasetSeries(datasetId, selectedMetric) : []
            const seriesData = rawSeries.reduce<Record<string, Record<number, number>>>((acc, point) => {
              acc[point.name] = point.values
              return acc
            }, {})

            if (requestId !== _loadRequestId) return
            set({ data, loading: false, colorScale, tableData, seriesData })
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
        }),
      }
    ),
    { name: 'SriLankaStore' }
  )
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
