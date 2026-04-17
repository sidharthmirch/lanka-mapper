'use client'

import { create } from 'zustand'
import { persist, devtools } from 'zustand/middleware'
import type { ColorScale, VisualizationMode, LatLngTuple, MapData } from '@/types'
import {
  fetchDistrictData,
  fetchProvinceData,
  AVAILABLE_DATASETS,
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
  availableMetrics: string[]
  loading: boolean
  error: string | null
  
  sidebarOpen: boolean
  visualizationMode: VisualizationMode
  colorScale: ColorScale
  showTooltips: boolean
  
  setMapCenter: (center: LatLngTuple) => void
  setZoom: (zoom: number) => void
  selectDistrict: (district: string | null) => void
  selectProvince: (province: string | null) => void
  loadDataset: (datasetId: string, year: number, metric?: string) => Promise<void>
  setSelectedMetric: (metric: string) => void
  setVisualizationMode: (mode: VisualizationMode) => void
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
        availableMetrics: [],
        loading: false,
        error: null,
        
        sidebarOpen: true,
        visualizationMode: 'choropleth',
        colorScale: DEFAULT_COLOR_SCALE,
        showTooltips: true,
        
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
            colorScale: DEFAULT_COLOR_SCALE,
            currentDataset: datasetId,
            currentYear: supportedYear,
            selectedMetric,
            currentDatasetLevel: dataset.level,
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

              if (requestId !== _loadRequestId) return
              set({ data, loading: false, colorScale })
              return
            }
            
            const values = data.map(d => d.value)
            const colorScale: ColorScale = {
              min: values.length > 0 ? Math.min(...values) : DEFAULT_COLOR_SCALE.min,
              max: values.length > 0 ? Math.max(...values) : DEFAULT_COLOR_SCALE.max,
              colors: DEFAULT_COLOR_SCALE.colors,
            }
            
            if (requestId !== _loadRequestId) return
            set({ data, loading: false, colorScale })
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
          showTooltips: state.showTooltips,
          currentYear: state.currentYear,
          selectedMetric: state.selectedMetric,
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
  availableMetrics: state.availableMetrics,
  loading: state.loading,
  error: state.error,
}))

export const useUIState = () => useAppStore((state) => ({
  sidebarOpen: state.sidebarOpen,
  visualizationMode: state.visualizationMode,
  colorScale: state.colorScale,
  showTooltips: state.showTooltips,
}))
