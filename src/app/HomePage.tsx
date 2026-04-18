'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import {
  Box,
  CircularProgress,
  Typography,
  Alert,
  ThemeProvider,
  createTheme,
  CssBaseline,
  useMediaQuery,
} from '@mui/material'
import { motion } from 'framer-motion'
import { useShallow } from 'zustand/react/shallow'
import Sidebar from '@/components/ui/Sidebar'
import { useAppStore } from '@/store'
import ErrorBoundary from '@/components/ui/ErrorBoundary'
import TabBar from '@/components/tabs/TabBar'
import RankingsChart from '@/components/tabs/RankingsChart'
import TimeSeriesChart from '@/components/tabs/TimeSeriesChart'
import DataTable from '@/components/tabs/DataTable'
import SourcesContent from '@/components/tabs/SourcesContent'
import MapTimeToolbar, { type MapPlaybackSpeed } from '@/components/map/MapTimeToolbar'
import MapColorLegend from '@/components/map/MapColorLegend'
import {
  buildPlaybackSchedule,
  FRAMES_PER_GAP,
  getMapPlaybackFrameIntervalMs,
  playbackFrameLinearYear,
  type PlaybackFrame,
} from '@/lib/mapPlaybackSchedule'
import type { AppTab, DatasetManifestEntry, MapData } from '@/types'
import {
  applyRegionShadingGradientCssVars,
  getAccentUiPalette,
  getGradientColors,
} from '@/lib/uiThemePresets'

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

function nearestDataYear(sortedYears: number[], y: number): number {
  if (sortedYears.length === 0) return y
  let best = sortedYears[0]
  let bestD = Math.abs(best - y)
  for (const yy of sortedYears) {
    const d = Math.abs(yy - y)
    if (d < bestD) {
      best = yy
      bestD = d
    }
  }
  return best
}

function findStartFrameIndex(schedule: PlaybackFrame[], currentYear: number): number {
  const idx = schedule.findIndex((f) => playbackFrameLinearYear(f) >= currentYear)
  return idx === -1 ? 0 : idx
}

function formatSyncTime(lastCatalogSync: number | null): string {
  if (!lastCatalogSync) return 'Never'
  return new Date(lastCatalogSync).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  })
}

/** Pick map / plots / table from dataset capabilities and current tab. */
function resolveTabForDataset(d: DatasetManifestEntry, current: AppTab): AppTab {
  if (d.hasGeo && !d.hasTime) return 'map'
  if (d.hasTime && !d.hasGeo) return 'plots'
  if (d.hasGeo && d.hasTime) {
    if (current === 'map' || current === 'plots') return current
    return 'map'
  }
  return 'table'
}

export default function HomePage() {
  // Narrowed, shallow-compared selector: destructuring `useAppStore()` with
  // no selector would cause HomePage to re-render on *every* store change,
  // including the ~12 fps value ticks emitted during map playback. Using
  // `useShallow` with a hand-picked slice keeps subscriptions bounded to
  // the state we actually render.
  const {
    sidebarOpen,
    currentDataset,
    currentYear,
    data,
    loading,
    error,
    showChoropleth,
    showCentroids,
    selectedDistrict,
    selectedProvince,
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
    plotYearRange,
    plotSeriesSelection,
    accentPresetId,
    accentTone,
    gradientPresetId,
  } = useAppStore(
    useShallow((s) => ({
      sidebarOpen: s.sidebarOpen,
      currentDataset: s.currentDataset,
      currentYear: s.currentYear,
      data: s.data,
      loading: s.loading,
      error: s.error,
      showChoropleth: s.showChoropleth,
      showCentroids: s.showCentroids,
      selectedDistrict: s.selectedDistrict,
      selectedProvince: s.selectedProvince,
      colorScale: s.colorScale,
      showTooltips: s.showTooltips,
      selectedMetric: s.selectedMetric,
      availableMetrics: s.availableMetrics,
      currentDatasetLevel: s.currentDatasetLevel,
      currentDatasetSource: s.currentDatasetSource,
      currentDatasetSecondarySource: s.currentDatasetSecondarySource,
      currentDatasetUnit: s.currentDatasetUnit,
      currentTab: s.currentTab,
      tableData: s.tableData,
      seriesData: s.seriesData,
      themeMode: s.themeMode,
      datasetManifest: s.datasetManifest,
      catalogLoading: s.catalogLoading,
      lastCatalogSync: s.lastCatalogSync,
      catalogCounts: s.catalogCounts,
      plotYearRange: s.plotYearRange,
      plotSeriesSelection: s.plotSeriesSelection,
      accentPresetId: s.accentPresetId,
      accentTone: s.accentTone,
      gradientPresetId: s.gradientPresetId,
    })),
  )

  // Actions are stable references on the store — select them individually so
  // they never contribute to re-render triggers.
  const initializeCatalog = useAppStore((s) => s.initializeCatalog)
  const setPlotYearRange = useAppStore((s) => s.setPlotYearRange)
  const setPlotSeriesSelection = useAppStore((s) => s.setPlotSeriesSelection)
  const setCurrentTab = useAppStore((s) => s.setCurrentTab)
  const setThemeMode = useAppStore((s) => s.setThemeMode)
  const toggleSidebar = useAppStore((s) => s.toggleSidebar)
  const loadDataset = useAppStore((s) => s.loadDataset)
  const applyMapYearFromSeries = useAppStore((s) => s.applyMapYearFromSeries)
  const applyMapInterpolatedFrame = useAppStore((s) => s.applyMapInterpolatedFrame)
  const selectDistrict = useAppStore((s) => s.selectDistrict)
  const selectProvince = useAppStore((s) => s.selectProvince)
  const setShowChoropleth = useAppStore((s) => s.setShowChoropleth)
  const setShowCentroids = useAppStore((s) => s.setShowCentroids)
  const setSelectedMetric = useAppStore((s) => s.setSelectedMetric)

  const [mounted, setMounted] = useState(false)
  const [mapPlaybackActive, setMapPlaybackActive] = useState(false)
  const [mapPlaybackSpeed, setMapPlaybackSpeed] = useState<MapPlaybackSpeed>(1)
  const [mapPlaybackLoop, setMapPlaybackLoop] = useState(false)
  const [playbackLinearYear, setPlaybackLinearYear] = useState<number | null>(null)
  const playbackScheduleRef = useRef<PlaybackFrame[]>([])
  const playbackStepIndexRef = useRef(0)
  const playbackLinearYearRef = useRef<number | null>(null)
  const setPlaybackLinearYearSync = useCallback((y: number | null) => {
    playbackLinearYearRef.current = y
    setPlaybackLinearYear(y)
  }, [])
  const prefersDark = useMediaQuery('(prefers-color-scheme: dark)')
  const isDarkMode = themeMode === 'dark' || (themeMode === 'system' && prefersDark)

  const activeDataset = useMemo(
    () => datasetManifest.find((dataset) => dataset.id === currentDataset) ?? null,
    [currentDataset, datasetManifest],
  )

  const rankingsData = useMemo((): MapData[] => {
    if (!data?.length) return []
    if (currentDatasetLevel !== 'province') return data
    const byProvince = new Map<string, MapData>()
    for (const row of data) {
      const label =
        typeof row.originalName === 'string' && row.originalName
          ? row.originalName
          : row.name
      const key = label.toLowerCase()
      if (!byProvince.has(key)) {
        byProvince.set(key, { ...row, name: label })
      }
    }
    return Array.from(byProvince.values())
  }, [data, currentDatasetLevel])

  const handleRankingsSelect = useCallback(
    (name: string) => {
      if (currentDatasetLevel === 'province') {
        selectProvince(name)
      } else {
        selectDistrict(name)
      }
    },
    [currentDatasetLevel, selectDistrict, selectProvince],
  )

  const years = useMemo(
    () => activeDataset?.years ?? [currentYear],
    [activeDataset?.years, currentYear],
  )

  const sortedYears = useMemo(() => [...years].sort((a, b) => a - b), [years])

  const mapPlaybackFrameMs = useMemo(
    () => getMapPlaybackFrameIntervalMs(mapPlaybackSpeed),
    [mapPlaybackSpeed],
  )

  const canMapPlayback = Boolean(
    activeDataset?.hasTime
    && sortedYears.length >= 2
    && data
    && data.length > 0
    && Object.keys(seriesData).length > 0,
  )

  const randomPickDisabled = useMemo(() => {
    const candidates =
      currentTab === 'map'
        ? datasetManifest.filter((d) => d.hasGeo)
        : currentTab === 'plots'
          ? datasetManifest.filter((d) => d.hasTime)
          : []
    return candidates.length === 0
  }, [currentTab, datasetManifest])

  const handleRandomPick = useCallback(() => {
    const candidates =
      currentTab === 'map'
        ? datasetManifest.filter((d) => d.hasGeo)
        : currentTab === 'plots'
          ? datasetManifest.filter((d) => d.hasTime)
          : []
    if (candidates.length === 0) return
    const pick = candidates[Math.floor(Math.random() * candidates.length)]
    if (pick.years.length === 0) return
    const y = pick.years[Math.floor(Math.random() * pick.years.length)]
    setMapPlaybackActive(false)
    setPlaybackLinearYearSync(null)
    playbackScheduleRef.current = []
    playbackStepIndexRef.current = 0
    void loadDataset(pick.id, y, selectedMetric ?? undefined)
  }, [currentTab, datasetManifest, loadDataset, selectedMetric, setPlaybackLinearYearSync])

  const theme = useMemo(() => {
    const accent = getAccentUiPalette(accentPresetId, accentTone)
    return createTheme({
      palette: {
        mode: isDarkMode ? 'dark' : 'light',
        primary: { main: accent.main, dark: accent.dark, light: accent.light },
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
    })
  }, [isDarkMode, accentPresetId, accentTone])

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
    if (typeof document === 'undefined') return
    const accent = getAccentUiPalette(accentPresetId, accentTone)
    document.documentElement.style.setProperty('--primary', accent.main)
    document.documentElement.style.setProperty('--primary-dark', accent.dark)
    document.documentElement.style.setProperty('--primary-light', accent.light)
  }, [accentPresetId, accentTone])

  useEffect(() => {
    applyRegionShadingGradientCssVars(getGradientColors(gradientPresetId))
  }, [gradientPresetId])

  useEffect(() => {
    const interval = setInterval(() => {
      void initializeCatalog(true)
    }, CATALOG_POLL_INTERVAL)

    return () => clearInterval(interval)
  }, [initializeCatalog])

  useEffect(() => {
    if (!currentDataset || mapPlaybackActive) return undefined

    const interval = setInterval(() => {
      // Background revalidation: keep existing map/table/series rendered
      // until the refreshed payload lands, instead of flashing a spinner
      // every few minutes on a dataset that probably hasn't changed.
      void loadDataset(currentDataset, currentYear, selectedMetric ?? undefined, {
        forceRefresh: true,
        silent: true,
      })
    }, ACTIVE_DATASET_POLL_INTERVAL)

    return () => clearInterval(interval)
  }, [currentDataset, currentYear, selectedMetric, loadDataset, mapPlaybackActive])

  const handleDatasetChange = useCallback((datasetId: string) => {
    setMapPlaybackActive(false)
    setPlaybackLinearYearSync(null)
    playbackScheduleRef.current = []
    playbackStepIndexRef.current = 0
    const dataset = datasetManifest.find((entry) => entry.id === datasetId)
    if (!dataset) return

    const supportedYear = dataset.years.includes(currentYear)
      ? currentYear
      : dataset.years[dataset.years.length - 1]

    void loadDataset(datasetId, supportedYear)
  }, [currentYear, datasetManifest, loadDataset, setPlaybackLinearYearSync])

  const handleToolbarDatasetSelect = useCallback((dataset: DatasetManifestEntry) => {
    setCurrentTab(resolveTabForDataset(dataset, currentTab))
    handleDatasetChange(dataset.id)
  }, [currentTab, handleDatasetChange, setCurrentTab])

  const handleYearChange = useCallback((year: number) => {
    setMapPlaybackActive(false)
    setPlaybackLinearYearSync(null)
    playbackScheduleRef.current = []
    playbackStepIndexRef.current = 0
    if (currentDataset) {
      void loadDataset(currentDataset, year)
    }
  }, [currentDataset, loadDataset, setPlaybackLinearYearSync])

  const handleToggleMapPlayback = useCallback(() => {
    if (!canMapPlayback) {
      return
    }
    if (mapPlaybackActive) {
      const snap = playbackLinearYearRef.current
      setMapPlaybackActive(false)
      setPlaybackLinearYearSync(null)
      applyMapYearFromSeries(nearestDataYear(sortedYears, snap ?? currentYear))
      return
    }
    const schedule = buildPlaybackSchedule(sortedYears, FRAMES_PER_GAP)
    if (schedule.length === 0) {
      return
    }
    playbackScheduleRef.current = schedule
    const startIdx = findStartFrameIndex(schedule, currentYear)
    playbackStepIndexRef.current = startIdx
    const frame = schedule[startIdx]
    applyMapInterpolatedFrame(frame.y0, frame.y1, frame.t)
    setPlaybackLinearYearSync(playbackFrameLinearYear(frame))
    setMapPlaybackActive(true)
  }, [
    canMapPlayback,
    mapPlaybackActive,
    sortedYears,
    currentYear,
    applyMapYearFromSeries,
    applyMapInterpolatedFrame,
    setPlaybackLinearYearSync,
  ])

  useEffect(() => {
    if (!mapPlaybackActive) return undefined
    const schedule = playbackScheduleRef.current
    if (!schedule.length) {
      setMapPlaybackActive(false)
      setPlaybackLinearYearSync(null)
      return undefined
    }

    const intervalMs = getMapPlaybackFrameIntervalMs(mapPlaybackSpeed)

    const id = window.setInterval(() => {
      const sched = playbackScheduleRef.current
      if (!sched.length) {
        return
      }

      let next = playbackStepIndexRef.current + 1
      if (next >= sched.length) {
        if (mapPlaybackLoop) {
          next = 0
          playbackStepIndexRef.current = 0
          const f0 = sched[0]
          applyMapInterpolatedFrame(f0.y0, f0.y1, f0.t)
          setPlaybackLinearYearSync(playbackFrameLinearYear(f0))
        } else {
          const lastShown = playbackLinearYearRef.current ?? currentYear
          setMapPlaybackActive(false)
          setPlaybackLinearYearSync(null)
          playbackScheduleRef.current = []
          playbackStepIndexRef.current = 0
          applyMapYearFromSeries(nearestDataYear(sortedYears, lastShown))
        }
        return
      }
      playbackStepIndexRef.current = next
      const frame = sched[next]
      applyMapInterpolatedFrame(frame.y0, frame.y1, frame.t)
      setPlaybackLinearYearSync(playbackFrameLinearYear(frame))
    }, intervalMs)

    return () => window.clearInterval(id)
  }, [
    mapPlaybackActive,
    applyMapInterpolatedFrame,
    applyMapYearFromSeries,
    mapPlaybackLoop,
    mapPlaybackSpeed,
    sortedYears,
    currentYear,
    setPlaybackLinearYearSync,
  ])

  useEffect(() => {
    if (currentTab === 'map') return
    const lastShown = playbackLinearYearRef.current
    setMapPlaybackActive(false)
    setPlaybackLinearYearSync(null)
    playbackScheduleRef.current = []
    playbackStepIndexRef.current = 0
    if (lastShown != null) {
      applyMapYearFromSeries(nearestDataYear(sortedYears, lastShown))
    }
  }, [currentTab, sortedYears, applyMapYearFromSeries, setPlaybackLinearYearSync])

  const handleMetricChange = useCallback((metric: string) => {
    setMapPlaybackActive(false)
    setPlaybackLinearYearSync(null)
    playbackScheduleRef.current = []
    playbackStepIndexRef.current = 0
    setSelectedMetric(metric)
  }, [setSelectedMetric, setPlaybackLinearYearSync])

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
          <Box className="flex h-full w-full pb-4 px-4 pt-4 gap-4">
            <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-2">
              <TabBar
                currentTab={currentTab}
                onTabChange={setCurrentTab}
                datasetManifest={datasetManifest}
                onSelectDataset={handleToolbarDatasetSelect}
              />
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.45 }}
                className="relative flex-1 min-h-0 min-w-0 rounded-[20px] border border-[var(--outline)] bg-[var(--surface)]/70 shadow-[0_20px_40px_rgba(15,27,44,0.08)] overflow-hidden"
                aria-label="Main content"
              >
              {currentTab === 'map' && (
                <>
                  <SriLankaMap
                    data={data || []}
                    datasetLevel={currentDatasetLevel}
                    selectedDistrict={selectedDistrict}
                    selectedProvince={selectedProvince}
                    onDistrictSelect={selectDistrict}
                    onProvinceSelect={selectProvince}
                    colorScale={colorScale}
                    showTooltips={showTooltips}
                    showChoropleth={showChoropleth}
                    showCentroids={showCentroids}
                    isDarkMode={isDarkMode}
                    unit={currentDatasetUnit}
                    sidebarOpen={sidebarOpen}
                    accentColor={getAccentUiPalette(accentPresetId, accentTone).main}
                    mapPlaybackActive={mapPlaybackActive}
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
                      <RankingsChart
                        data={rankingsData}
                        unit={currentDatasetUnit}
                        onSelect={handleRankingsSelect}
                        playbackActive={mapPlaybackActive}
                        animationDurationMs={mapPlaybackFrameMs}
                      />
                    </Box>
                  )}

                  {data && data.length > 0 && showChoropleth && (
                    <MapColorLegend
                      colorScale={colorScale}
                      unit={currentDatasetUnit}
                      animateValues={mapPlaybackActive}
                      animationDurationMs={mapPlaybackFrameMs}
                    />
                  )}

                  {activeDataset && (
                    <Box className="absolute bottom-4 left-1/2 z-[860] -translate-x-1/2">
                      <MapTimeToolbar
                        currentYear={currentYear}
                        playbackLinearYear={playbackLinearYear}
                        years={years}
                        loading={loading}
                        canPlayback={canMapPlayback}
                        playbackActive={mapPlaybackActive}
                        onTogglePlayback={handleToggleMapPlayback}
                        playbackSpeed={mapPlaybackSpeed}
                        onPlaybackSpeedChange={setMapPlaybackSpeed}
                        loopEnabled={mapPlaybackLoop}
                        onLoopChange={setMapPlaybackLoop}
                        onYearChange={handleYearChange}
                      />
                    </Box>
                  )}
                </>
              )}

              {currentTab === 'plots' && (
                <TimeSeriesChart
                  years={years}
                  seriesData={seriesData}
                  datasetName={activeDataset?.name ?? 'Current Dataset'}
                  primarySource={currentDatasetSource}
                  secondarySource={currentDatasetSecondarySource}
                  unit={currentDatasetUnit}
                  citation={activeDataset?.citation}
                  citationUrl={activeDataset?.citationUrl}
                  yearRange={plotYearRange ?? [years[0] ?? new Date().getFullYear(), years[years.length - 1] ?? new Date().getFullYear()]}
                  selectedSeries={plotSeriesSelection}
                />
              )}

              {currentTab === 'table' && (
                <DataTable tableData={tableData} />
              )}

              {currentTab === 'sources' && <SourcesContent />}
              </motion.div>
            </div>

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
              years={years}
              currentDatasetSource={currentDatasetSource}
              currentDatasetSecondarySource={currentDatasetSecondarySource}
              currentDatasetUnit={currentDatasetUnit}
              darkMode={isDarkMode}
              currentTab={currentTab}
              showChoropleth={showChoropleth}
              showCentroids={showCentroids}
              colorScale={colorScale}
              datasetManifest={datasetManifest}
              totalDatasets={catalogCounts.total}
              catalogCounts={catalogCounts}
              lastCatalogSyncLabel={formatSyncTime(lastCatalogSync)}
              catalogLoading={catalogLoading}
              onCatalogSync={() => void initializeCatalog(true)}
              onRandomPick={handleRandomPick}
              randomDisabled={randomPickDisabled}
              seriesData={seriesData}
              plotYearRange={plotYearRange}
              onPlotYearRangeChange={setPlotYearRange}
              plotSeriesSelection={plotSeriesSelection}
              onPlotSeriesSelectionChange={setPlotSeriesSelection}
              onDatasetChange={handleDatasetChange}
              onMetricChange={handleMetricChange}
              onToggleChoropleth={setShowChoropleth}
              onToggleCentroids={setShowCentroids}
              onToggleDarkMode={() => setThemeMode(isDarkMode ? 'light' : 'dark')}
              onViewRawData={() => setCurrentTab('table')}
              mapPlaybackActive={mapPlaybackActive}
              mapPlaybackFrameMs={mapPlaybackFrameMs}
            />
          </Box>

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
