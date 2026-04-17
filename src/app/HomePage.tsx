'use client'

import { useEffect, useMemo, useState } from 'react'
import dynamic from 'next/dynamic'
import {
  Box,
  Fab,
  CircularProgress,
  Typography,
  Alert,
  ThemeProvider,
  createTheme,
  CssBaseline,
  useMediaQuery,
} from '@mui/material'
import MenuIcon from '@mui/icons-material/Menu'
import SyncIcon from '@mui/icons-material/Sync'
import { motion } from 'framer-motion'
import Sidebar from '@/components/ui/Sidebar'
import { useAppStore } from '@/store'
import ErrorBoundary from '@/components/ui/ErrorBoundary'
import TabBar from '@/components/tabs/TabBar'
import RankingsChart from '@/components/tabs/RankingsChart'
import TimeSeriesChart from '@/components/tabs/TimeSeriesChart'
import DataTable from '@/components/tabs/DataTable'

const SriLankaMap = dynamic(() => import('@/components/map/SriLankaMap'), {
  ssr: false,
  loading: () => (
    <Box className="h-full w-full flex items-center justify-center">
      <CircularProgress />
    </Box>
  ),
})

const CATALOG_POLL_INTERVAL = 20 * 60 * 1000
const ACTIVE_DATASET_POLL_INTERVAL = 6 * 60 * 1000

function formatSyncTime(lastCatalogSync: number | null): string {
  if (!lastCatalogSync) return 'Never'
  return new Date(lastCatalogSync).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function HomePage() {
  const {
    sidebarOpen,
    currentDataset,
    currentYear,
    data,
    loading,
    error,
    visualizationMode,
    showChoropleth,
    showCentroids,
    selectedDistrict,
    colorScale,
    showTooltips,
    selectedMetric,
    availableMetrics,
    currentDatasetLevel,
    currentDatasetSource,
    currentDatasetSecondarySource,
    currentDatasetUnit,
    currentTab,
    tableData,
    seriesData,
    themeMode,
    datasetManifest,
    catalogLoading,
    lastCatalogSync,
    catalogCounts,
    initializeCatalog,
    setCurrentTab,
    setThemeMode,
    toggleSidebar,
    loadDataset,
    selectDistrict,
    setVisualizationMode,
    setShowChoropleth,
    setShowCentroids,
    setSelectedMetric,
  } = useAppStore()

  const [mounted, setMounted] = useState(false)
  const prefersDark = useMediaQuery('(prefers-color-scheme: dark)')
  const isDarkMode = themeMode === 'dark' || (themeMode === 'system' && prefersDark)

  const activeDataset = useMemo(
    () => datasetManifest.find((dataset) => dataset.id === currentDataset) ?? null,
    [currentDataset, datasetManifest],
  )

  const years = activeDataset?.years || [currentYear]

  const theme = useMemo(
    () => createTheme({
      palette: {
        mode: isDarkMode ? 'dark' : 'light',
        primary: { main: '#2f8fcd', dark: '#216a9b', light: '#79bde8' },
        secondary: { main: '#de8a35' },
        background: isDarkMode
          ? { default: '#0d1118', paper: '#111a24' }
          : { default: '#edf3f9', paper: '#f9fcff' },
      },
      typography: {
        fontFamily: 'var(--font-sans), "Avenir Next", "Segoe UI", sans-serif',
        h6: { fontWeight: 650, letterSpacing: '-0.01em' },
      },
      components: {
        MuiButton: { styleOverrides: { root: { textTransform: 'none', borderRadius: 12 } } },
      },
    }),
    [isDarkMode],
  )

  useEffect(() => {
    setMounted(true)
    void initializeCatalog()
  }, [initializeCatalog])

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.body.classList.toggle('dark-mode', isDarkMode)
      document.body.classList.toggle('light-mode', !isDarkMode)
    }
  }, [isDarkMode])

  useEffect(() => {
    const interval = setInterval(() => {
      void initializeCatalog(true)
    }, CATALOG_POLL_INTERVAL)

    return () => clearInterval(interval)
  }, [initializeCatalog])

  useEffect(() => {
    if (!currentDataset) return undefined

    const interval = setInterval(() => {
      void loadDataset(currentDataset, currentYear, selectedMetric ?? undefined, { forceRefresh: true })
    }, ACTIVE_DATASET_POLL_INTERVAL)

    return () => clearInterval(interval)
  }, [currentDataset, currentYear, selectedMetric, loadDataset])

  const handleDatasetChange = (datasetId: string) => {
    const dataset = datasetManifest.find((entry) => entry.id === datasetId)
    if (!dataset) return

    const supportedYear = dataset.years.includes(currentYear)
      ? currentYear
      : dataset.years[dataset.years.length - 1]

    void loadDataset(datasetId, supportedYear)
  }

  const handleYearChange = (year: number) => {
    if (currentDataset) {
      void loadDataset(currentDataset, year)
    }
  }

  const handleMetricChange = (metric: string) => {
    setSelectedMetric(metric)
  }

  if (!mounted) {
    return (
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <Box className="h-screen w-screen flex items-center justify-center">
          <CircularProgress />
        </Box>
      </ThemeProvider>
    )
  }

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <ErrorBoundary>
        <Box className="app-shell h-screen w-screen relative overflow-hidden" role="main">
          <TabBar
            currentTab={currentTab}
            onTabChange={setCurrentTab}
            totalDatasets={catalogCounts.total}
            lastSyncLabel={formatSyncTime(lastCatalogSync)}
          />

          <Box className="flex h-full w-full pt-[90px] pb-4 px-4 gap-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.45 }}
              className="relative h-full min-w-0 flex-1 rounded-[20px] border border-[var(--outline)] bg-[var(--surface)]/70 shadow-[0_20px_40px_rgba(15,27,44,0.08)] overflow-hidden"
              aria-label="Sri Lanka interactive map"
            >
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

                  {data && data.length === 0 && (
                    <Box className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-[var(--outline)] bg-[var(--surface)]/95 px-5 py-4 text-center shadow-[0_14px_28px_rgba(0,0,0,0.12)]">
                      <Typography className="font-semibold">No geographic layer in this dataset</Typography>
                      <Typography variant="body2" className="opacity-75 mt-1">
                        Use the Time Series or Table tabs for this source.
                      </Typography>
                    </Box>
                  )}

                  {data && data.length > 0 && (
                    <Box className="absolute left-4 top-4 z-[850] w-[320px]">
                      <RankingsChart data={data} onSelect={selectDistrict} />
                    </Box>
                  )}
                </>
              )}

              {currentTab === 'timeseries' && (
                <TimeSeriesChart
                  years={years}
                  seriesData={seriesData}
                  datasetName={activeDataset?.name ?? 'Current Dataset'}
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
              loading={loading || catalogLoading}
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
              datasetManifest={datasetManifest}
              totalDatasets={catalogCounts.total}
              catalogCounts={catalogCounts}
              lastCatalogSyncLabel={formatSyncTime(lastCatalogSync)}
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
            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.22 }} className="fixed bottom-6 right-6 z-[900]">
              <Fab color="primary" onClick={toggleSidebar} aria-label="Open sidebar menu">
                <MenuIcon />
              </Fab>
            </motion.div>
          )}

          <motion.button
            type="button"
            className="fixed left-6 bottom-6 z-[920] flex items-center gap-2 rounded-xl border border-[var(--outline)] bg-[var(--surface)]/85 px-3 py-2 text-xs font-semibold shadow-[0_8px_24px_rgba(0,0,0,0.1)]"
            onClick={() => void initializeCatalog(true)}
          >
            <SyncIcon sx={{ fontSize: 14 }} />
            Sync now
          </motion.button>

          {error && (
            <Box className="fixed bottom-20 left-1/2 -translate-x-1/2 z-[1000]">
              <Alert severity="error" className="shadow-lg rounded-xl">{error}</Alert>
            </Box>
          )}

          {loading && (
            <Box className="fixed inset-0 bg-[rgba(8,18,30,0.25)] backdrop-blur-sm flex items-center justify-center z-[1100]">
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="rounded-2xl border border-[var(--outline)] bg-[var(--surface)]/92 p-6"
              >
                <Box className="flex items-center space-x-4">
                  <CircularProgress size={28} thickness={4} />
                  <Box>
                    <Typography className="font-semibold">Loading dataset</Typography>
                    <Typography variant="body2" className="opacity-70">Polling live sources and refreshing visuals…</Typography>
                  </Box>
                </Box>
              </motion.div>
            </Box>
          )}
        </Box>
      </ErrorBoundary>
    </ThemeProvider>
  )
}
