'use client'

import { useEffect, useMemo, useState } from 'react'
import dynamic from 'next/dynamic'
import { Box, Fab, CircularProgress, Typography, Alert, ThemeProvider, createTheme, CssBaseline, useMediaQuery } from '@mui/material'
import MenuIcon from '@mui/icons-material/Menu'
import { motion } from 'framer-motion'
import Sidebar from '@/components/ui/Sidebar'
import { AVAILABLE_DATASETS, DATASET_MANIFEST } from '@/services/dataService'
import { useAppStore } from '@/store'
import ErrorBoundary from '@/components/ui/ErrorBoundary'
import TabBar from '@/components/tabs/TabBar'
import RankingsChart from '@/components/tabs/RankingsChart'
import TimeSeriesChart from '@/components/tabs/TimeSeriesChart'
import DataTable from '@/components/tabs/DataTable'

const SriLankaMap = dynamic(() => import('@/components/map/SriLankaMap'), {
  ssr: false,
  loading: () => (
    <Box className="h-full w-full flex items-center justify-center bg-gray-100">
      <CircularProgress />
    </Box>
  ),
})

export default function HomePage() {
  const {
    sidebarOpen, currentDataset, currentYear, data, loading, error,
    visualizationMode, showChoropleth, showCentroids, selectedDistrict, colorScale, showTooltips,
    selectedMetric, availableMetrics, currentDatasetLevel, currentDatasetSource, currentDatasetSecondarySource,
    currentDatasetUnit, currentTab, tableData, seriesData, setCurrentTab, themeMode, setThemeMode,
    toggleSidebar, loadDataset, selectDistrict, setVisualizationMode, setShowChoropleth, setShowCentroids, setSelectedMetric,
  } = useAppStore()

  const [mounted, setMounted] = useState(false)
  const prefersDark = useMediaQuery('(prefers-color-scheme: dark)')
  const isDarkMode = themeMode === 'dark' || (themeMode === 'system' && prefersDark)
  const years = DATASET_MANIFEST.find((dataset) => dataset.id === currentDataset)?.years || [currentYear]
  const theme = useMemo(() => createTheme({
    palette: {
      mode: isDarkMode ? 'dark' : 'light',
      primary: { main: '#007aff', dark: '#0059b8', light: '#4da3ff' },
      secondary: { main: '#dc004e' },
      background: isDarkMode
        ? { default: '#101215', paper: '#1a1d22' }
        : { default: '#fafafa', paper: '#ffffff' },
    },
    typography: { fontFamily: '"Inter", "Helvetica", "Arial", sans-serif' },
    components: {
      MuiButton: { styleOverrides: { root: { textTransform: 'none' } } },
    },
  }), [isDarkMode])

  useEffect(() => {
    setMounted(true)
    if (!currentDataset) {
      loadDataset('accommodations-by-district', 2024)
    }
  }, [currentDataset, loadDataset])

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.body.classList.toggle('dark-mode', isDarkMode)
      document.body.classList.toggle('light-mode', !isDarkMode)
    }
  }, [isDarkMode])

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
          <TabBar currentTab={currentTab} onTabChange={setCurrentTab} />

          <Box className="flex h-full w-full pt-[70px]">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5 }} className="relative h-full min-w-0 flex-1" aria-label="Sri Lanka interactive map">
              {currentTab === 'map' && (
                <>
                  <SriLankaMap
                    data={data || []}
                    selectedDistrict={selectedDistrict}
                    onDistrictSelect={selectDistrict}
                    colorScale={colorScale}
                    showTooltips={showTooltips}
                    visualizationMode={visualizationMode}
                    showChoropleth={showChoropleth}
                    showCentroids={showCentroids}
                    isDarkMode={isDarkMode}
                  />
                  <Box className="absolute left-6 top-24 z-[850] w-[320px]">
                    <RankingsChart data={data || []} onSelect={selectDistrict} />
                  </Box>
                </>
              )}
              {currentTab === 'timeseries' && (
                <TimeSeriesChart
                  years={years}
                  seriesData={seriesData}
                  datasetName={DATASET_MANIFEST.find((dataset) => dataset.id === currentDataset)?.name ?? 'Current Dataset'}
                  primarySource={currentDatasetSource}
                  secondarySource={currentDatasetSecondarySource}
                  unit={currentDatasetUnit}
                />
              )}
              {currentTab === 'table' && (
                <DataTable tableData={tableData} />
              )}
            </motion.div>

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
              currentYear={currentYear}
              years={years}
              currentDatasetSource={currentDatasetSource}
              currentDatasetSecondarySource={currentDatasetSecondarySource}
              currentDatasetUnit={currentDatasetUnit}
              darkMode={isDarkMode}
              currentTab={currentTab}
              visualizationMode={visualizationMode}
              showChoropleth={showChoropleth}
              showCentroids={showCentroids}
              colorScale={colorScale}
              onDatasetChange={handleDatasetChange}
              onMetricChange={handleMetricChange}
              onYearChange={handleYearChange}
              onVisualizationModeChange={setVisualizationMode}
              onToggleChoropleth={setShowChoropleth}
              onToggleCentroids={setShowCentroids}
              onToggleDarkMode={() => setThemeMode(isDarkMode ? 'light' : 'dark')}
              onViewRawData={() => setCurrentTab('table')}
            />
          </Box>

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
