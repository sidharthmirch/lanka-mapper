'use client'

import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import { Box, Fab, CircularProgress, Typography, Alert, ThemeProvider, createTheme, CssBaseline } from '@mui/material'
import MenuIcon from '@mui/icons-material/Menu'
import { motion } from 'framer-motion'
import Sidebar from '@/components/ui/Sidebar'
import { AVAILABLE_DATASETS, DATASET_MANIFEST } from '@/services/dataService'
import { useAppStore } from '@/store'
import ErrorBoundary from '@/components/ui/ErrorBoundary'

const theme = createTheme({
  palette: {
    mode: 'light',
    primary: { main: '#1976d2', dark: '#1565c0', light: '#42a5f5' },
    secondary: { main: '#dc004e' },
    background: { default: '#fafafa', paper: '#ffffff' },
  },
  typography: { fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif' },
  components: {
    MuiButton: { styleOverrides: { root: { textTransform: 'none' } } },
  },
})

const SriLankaMap = dynamic(() => import('@/components/map/SriLankaMap'), {
  ssr: false,
  loading: () => (
    <Box className="h-full w-full flex items-center justify-center bg-gray-100">
      <CircularProgress />
    </Box>
  ),
})

const MapToolbar = dynamic(() => import('@/components/ui/MapToolbar'), {
  ssr: false,
})

export default function HomePage() {
  const {
    sidebarOpen, currentDataset, currentYear, data, loading, error,
    visualizationMode, selectedDistrict, colorScale, showTooltips,
    selectedMetric, availableMetrics, currentDatasetLevel,
    toggleSidebar, loadDataset, selectDistrict, setVisualizationMode, setSelectedMetric,
  } = useAppStore()

  const [mounted, setMounted] = useState(false)
  const years = DATASET_MANIFEST.find((dataset) => dataset.id === currentDataset)?.years || [currentYear]

  useEffect(() => {
    setMounted(true)
    if (!currentDataset) {
      loadDataset('accommodations-by-district', 2024)
    }
  }, [currentDataset, loadDataset])

  const handleDatasetChange = (datasetId: string) => {
    const dataset = AVAILABLE_DATASETS.find(d => d.id === datasetId)
    if (!dataset) return

    const supportedYear = dataset.years.includes(currentYear)
      ? currentYear
      : dataset.years[dataset.years.length - 1]

    loadDataset(datasetId, supportedYear)
  }

  const handleYearChange = (year: number) => {
    if (currentDataset) loadDataset(currentDataset, year)
  }

  const handleMetricChange = (metric: string) => {
    setSelectedMetric(metric)
  }

  if (!mounted) {
    return (
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <Box className="h-screen w-screen flex items-center justify-center bg-gray-100">
          <CircularProgress />
        </Box>
      </ThemeProvider>
    )
  }

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <ErrorBoundary>
        <Box className="h-screen w-screen relative overflow-hidden bg-gray-100" role="main">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5 }} className="h-full w-full" aria-label="Sri Lanka interactive map">
            <SriLankaMap
              data={data || []}
              selectedDistrict={selectedDistrict}
              onDistrictSelect={selectDistrict}
              colorScale={colorScale}
              showTooltips={showTooltips}
              visualizationMode={visualizationMode}
            />
          </motion.div>

          <MapToolbar
            currentYear={currentYear}
            years={years}
            visualizationMode={visualizationMode}
            onYearChange={handleYearChange}
            onVisualizationModeChange={setVisualizationMode}
          />

          <Sidebar 
            open={sidebarOpen} 
            onClose={toggleSidebar} 
            currentDataset={currentDataset} 
            data={data} 
            loading={loading} 
            selectedDistrict={selectedDistrict} 
            selectedMetric={selectedMetric}
            availableMetrics={availableMetrics}
            currentDatasetLevel={currentDatasetLevel}
            onDatasetChange={handleDatasetChange} 
            onMetricChange={handleMetricChange}
          />

          {!sidebarOpen && (
            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.3 }} className="fixed bottom-6 right-6 z-[900]">
              <Fab color="primary" onClick={toggleSidebar} className="shadow-[0_8px_24px_rgba(25,118,210,0.3)] hover:shadow-[0_12px_28px_rgba(25,118,210,0.4)] transition-shadow" aria-label="Open sidebar menu">
                <MenuIcon />
              </Fab>
            </motion.div>
          )}

          {error && (
            <Box className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[1000]">
              <Alert severity="error" onClose={() => {}} className="shadow-lg rounded-xl">{error}</Alert>
            </Box>
          )}

          <Box className="fixed top-6 left-6 z-[900]">
            <motion.div initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.2 }}>
              <Box className="bg-white/70 backdrop-blur-xl border border-white/40 shadow-[0_8px_32px_rgba(0,0,0,0.08)] rounded-2xl px-5 py-3" role="banner">
                <Typography variant="h6" className="font-bold text-gray-900 tracking-tight">Sri Lanka Data Visualizer</Typography>
                <Typography variant="caption" className="text-primary font-medium uppercase tracking-wider text-[10px]">Interactive map explorer</Typography>
              </Box>
            </motion.div>
          </Box>

          {loading && (
            <Box className="fixed inset-0 bg-white/30 backdrop-blur-sm flex items-center justify-center z-[1100]">
              <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white/90 backdrop-blur-md border border-white/50 shadow-[0_16px_40px_rgba(0,0,0,0.12)] rounded-2xl p-6">
                <Box className="flex items-center space-x-4">
                  <CircularProgress size={28} thickness={4} />
                  <Typography className="font-medium text-gray-700">Loading dataset...</Typography>
                </Box>
              </motion.div>
            </Box>
          )}
        </Box>
      </ErrorBoundary>
    </ThemeProvider>
  )
}
