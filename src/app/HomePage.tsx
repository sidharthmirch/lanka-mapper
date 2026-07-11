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
import { motion, useReducedMotion } from 'framer-motion'
import { useShallow } from 'zustand/react/shallow'
import Sidebar from '@/components/ui/Sidebar'
import CommandSurface from '@/components/ui/CommandSurface'
import { useAppStore } from '@/store'
import ErrorBoundary from '@/components/ui/ErrorBoundary'
import RankingsChart from '@/components/tabs/RankingsChart'
import MapTimeToolbar, { type MapPlaybackSpeed } from '@/components/map/MapTimeToolbar'
import MapColorLegend from '@/components/map/MapColorLegend'
import CebLivePanel from '@/components/map/CebLivePanel'
import FloatingPanel from '@/components/map/FloatingPanel'
import {
  buildPlaybackSchedule,
  FRAMES_PER_GAP,
  getMapPlaybackFrameIntervalMs,
  getPlaybackStartFrameIndex,
  playbackFrameLinearYear,
  type PlaybackFrame,
} from '@/lib/mapPlaybackSchedule'
import type { AppTab, DatasetManifestEntry, MapAdminLevel, MapData } from '@/types'
import {
  applyRegionShadingGradientCssVars,
  getAccentUiPalette,
  getGradientColors,
} from '@/lib/uiThemePresets'
import { formatMetricValue } from '@/lib/formatDataValue'

const SriLankaMap = dynamic(() => import('@/components/map/SriLankaMap'), {
  ssr: false,
  loading: () => (
    <Box className="flex h-full w-full items-center justify-center bg-[var(--bg)]">
      <span className="mono text-[11px] uppercase tracking-[0.16em] text-[var(--ink-3)]">Loading map…</span>
    </Box>
  ),
})

const TimeSeriesChart = dynamic(() => import('@/components/tabs/TimeSeriesChart'))
const DataTable = dynamic(() => import('@/components/tabs/DataTable'))
const SourcesContent = dynamic(() => import('@/components/tabs/SourcesContent'))

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
    mapAdminLevel,
    showRivers,
    showPlants,
    showGrid,
    showBasins,
    showCebLive,
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
      mapAdminLevel: s.mapAdminLevel,
      showRivers: s.showRivers,
      showPlants: s.showPlants,
      showGrid: s.showGrid,
      showBasins: s.showBasins,
      showCebLive: s.showCebLive,
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
  const setMapAdminLevel = useAppStore((s) => s.setMapAdminLevel)
  const setShowRivers = useAppStore((s) => s.setShowRivers)
  const setShowPlants = useAppStore((s) => s.setShowPlants)
  const setShowGrid = useAppStore((s) => s.setShowGrid)
  const setShowBasins = useAppStore((s) => s.setShowBasins)
  const setShowCebLive = useAppStore((s) => s.setShowCebLive)
  const setSelectedMetric = useAppStore((s) => s.setSelectedMetric)

  const [mounted, setMounted] = useState(false)
  const prefersReducedMotion = useReducedMotion() ?? false
  /** Floating "Top Regions" card can be closed (restored via the on-map chip). */
  const [rankingsHidden, setRankingsHidden] = useState(false)
  const [mapPlaybackActive, setMapPlaybackActive] = useState(false)
  const [mapPlaybackSpeed, setMapPlaybackSpeed] = useState<MapPlaybackSpeed>(1)
  const [mapPlaybackLoop, setMapPlaybackLoop] = useState(false)
  const [playbackLinearYear, setPlaybackLinearYear] = useState<number | null>(null)
  const playbackScheduleRef = useRef<PlaybackFrame[]>([])
  const playbackStepIndexRef = useRef(0)
  const playbackLinearYearRef = useRef<number | null>(null)
  const mobileSidebarInitializedRef = useRef(false)
  const setPlaybackLinearYearSync = useCallback((y: number | null) => {
    playbackLinearYearRef.current = y
    setPlaybackLinearYear(y)
  }, [])
  const isMobileLayout = useMediaQuery('(max-width: 767px)')
  const prefersDark = useMediaQuery('(prefers-color-scheme: dark)')
  // Warm-neutral light by default; warm dark variant via the sidebar toggle.
  // `system` follows the OS preference until the user explicitly picks light/dark.
  const isDarkMode = themeMode === 'dark' || (themeMode === 'system' && prefersDark)

  const activeDataset = useMemo(
    () => datasetManifest.find((dataset) => dataset.id === currentDataset) ?? null,
    [currentDataset, datasetManifest],
  )

  // Heat-level toggle: a dataset can be painted at its native granularity or any
  // finer one (values inherit downward). A district dataset offers district +
  // city; a province dataset offers province + district + city.
  const availableAdminLevels = useMemo<MapAdminLevel[]>(() => {
    if (currentDatasetLevel === 'province') return ['province', 'district', 'city']
    if (currentDatasetLevel === 'district') return ['district', 'city']
    return []
  }, [currentDatasetLevel])

  const renderLevel: MapAdminLevel = useMemo(() => {
    const natural: MapAdminLevel = currentDatasetLevel === 'province' ? 'province' : 'district'
    if (mapAdminLevel && availableAdminLevels.includes(mapAdminLevel)) return mapAdminLevel
    return natural
  }, [mapAdminLevel, availableAdminLevels, currentDatasetLevel])

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

  // Headline stat for the status bar — the current leader region (point-to-point,
  // so it tracks playback frames). Uses the deduped rankings set.
  const headlineStat = useMemo(() => {
    if (!rankingsData.length) return null
    let top = rankingsData[0]
    for (const row of rankingsData) {
      if (row.value > top.value) top = row
    }
    return top.value > 0 ? { name: top.name, value: top.value } : null
  }, [rankingsData])

  const selectedMapItem = useMemo(() => {
    const selectedName = selectedProvince ?? selectedDistrict
    if (!selectedName) return null
    const rows = selectedProvince ? rankingsData : data ?? []
    const match = rows.find((row) => row.name.toLowerCase() === selectedName.toLowerCase())
    return match ? { name: match.name, value: match.value, level: selectedProvince ? 'Province' : 'District' } : null
  }, [data, rankingsData, selectedDistrict, selectedProvince])
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

  // Random-pick candidates per tab: map → geographic, plots → time series,
  // table → any dataset (all have a table). Sources has no dataset view.
  const randomCandidates = useMemo(() => {
    if (currentTab === 'map') return datasetManifest.filter((d) => d.hasGeo)
    if (currentTab === 'plots') return datasetManifest.filter((d) => d.hasTime)
    if (currentTab === 'table') return datasetManifest
    return []
  }, [currentTab, datasetManifest])

  const randomPickDisabled = randomCandidates.length === 0

  const handleRandomPick = useCallback(() => {
    const candidates = randomCandidates
    if (candidates.length === 0) return
    const pick = candidates[Math.floor(Math.random() * candidates.length)]
    if (pick.years.length === 0) return
    const y = pick.years[Math.floor(Math.random() * pick.years.length)]
    setMapPlaybackActive(false)
    setPlaybackLinearYearSync(null)
    playbackScheduleRef.current = []
    playbackStepIndexRef.current = 0
    void loadDataset(pick.id, y, selectedMetric ?? undefined)
  }, [randomCandidates, loadDataset, selectedMetric, setPlaybackLinearYearSync])

  const theme = useMemo(() => {
    const accent = getAccentUiPalette(accentPresetId, accentTone, isDarkMode)
    return createTheme({
      palette: {
        mode: isDarkMode ? 'dark' : 'light',
        primary: { main: accent.main, dark: accent.dark, light: accent.light },
        secondary: { main: isDarkMode ? '#74b394' : '#3b665a' },
        background: isDarkMode
          ? { default: '#0f1311', paper: '#161b18' }
          : { default: '#f4f0e8', paper: '#fdfbf6' },
        text: isDarkMode
          ? { primary: '#ece6db', secondary: '#abb1a2' }
          : { primary: '#22201c', secondary: '#5e574b' },
        divider: isDarkMode ? '#2a322b' : '#ddd4c4',
        error: { main: isDarkMode ? '#e07a5f' : '#9a341f' },
        success: { main: isDarkMode ? '#74b394' : '#2f6b54' },
        warning: { main: isDarkMode ? '#d6a14a' : '#8a6320' },
      },
      shape: { borderRadius: 8 },
      typography: {
        fontFamily: 'var(--font-sans), ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif',
        h6: { fontWeight: 660, lineHeight: 1.15, letterSpacing: 0 },
        subtitle2: { fontWeight: 620, letterSpacing: 0 },
        button: { fontWeight: 600, letterSpacing: 0 },
      },
      components: {
        MuiButton: {
          defaultProps: { disableElevation: true },
          styleOverrides: { root: { textTransform: 'none', borderRadius: 8 } },
        },
        MuiIconButton: { styleOverrides: { root: { borderRadius: 8 } } },
        MuiPaper: { styleOverrides: { root: { backgroundImage: 'none' } } },
      },
    })
  }, [isDarkMode, accentPresetId, accentTone])

  useEffect(() => {
    setMounted(true)
    void initializeCatalog()
  }, [initializeCatalog])

  useEffect(() => {
    if (!mounted || !isMobileLayout || mobileSidebarInitializedRef.current) return
    mobileSidebarInitializedRef.current = true
    if (sidebarOpen) {
      toggleSidebar()
    }
  }, [isMobileLayout, mounted, sidebarOpen, toggleSidebar])

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.body.classList.toggle('dark-mode', isDarkMode)
      document.body.classList.toggle('light-mode', !isDarkMode)
    }
  }, [isDarkMode])

  useEffect(() => {
    if (typeof document === 'undefined') return
    const accent = getAccentUiPalette(accentPresetId, accentTone, isDarkMode)
    const root = document.documentElement.style
    root.setProperty('--primary', accent.main)
    root.setProperty('--primary-dark', accent.dark)
    root.setProperty('--primary-light', accent.light)
    // Tie the semantic accent (playback rail, year readout, rankings, scrubber)
    // to the chosen preset too — otherwise it stayed the static CSS terracotta
    // while only `--primary` (tabs, etc.) followed the picker, desyncing them.
    root.setProperty('--accent', accent.main)
    root.setProperty('--accent-dark', accent.dark)
    root.setProperty('--accent-light', accent.light)
    // Soft accent surface = preset tinted into the current background, so the
    // play button / speed-pill backgrounds track the accent in both registers.
    root.setProperty('--accent-soft', `color-mix(in oklab, ${accent.main} 16%, var(--bg))`)
  }, [accentPresetId, accentTone, isDarkMode])

  useEffect(() => {
    // The ramp is authored dim→luminous (high values glow on the dark desk). In
    // the light register that would leave high values pale on cream, so reverse
    // it there: high stays high-contrast (dark) in both modes, low recedes.
    const colors = getGradientColors(gradientPresetId)
    applyRegionShadingGradientCssVars(isDarkMode ? colors : [...colors].reverse())
  }, [gradientPresetId, isDarkMode])

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
    const startIdx = getPlaybackStartFrameIndex(schedule, currentYear)
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
        <Box className="flex h-screen w-screen items-center justify-center bg-[var(--bg)]">
          <Box className="flex items-center gap-2.5">
            <span
              className="h-4 w-2 animate-pulse bg-[var(--accent)]"
              style={{ boxShadow: '0 0 12px color-mix(in oklab, var(--accent) 55%, transparent)' }}
            />
            <span className="mono text-[12px] uppercase tracking-[0.16em] text-[var(--ink-3)]">Lanka Mapper</span>
          </Box>
        </Box>
      </ThemeProvider>
    )
  }

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <ErrorBoundary>
        <a href="#main-content" className="skip-link">Skip to main content</a>
        <Box className="app-shell relative h-[100dvh] w-screen overflow-hidden" role="main">
          <Box className="flex h-full w-full gap-2 px-2 pb-2 pt-2 sm:gap-3 sm:px-3 sm:pb-3 sm:pt-3 md:gap-3 md:px-3 md:pb-3 md:pt-3">
            <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-1.5 sm:gap-2">
              <CommandSurface
                datasetName={activeDataset?.name ?? null}
                source={currentDatasetSource}
                topName={headlineStat?.name ?? null}
                topValue={headlineStat?.value ?? null}
                unit={currentDatasetUnit}
                catalogTotal={catalogCounts.total}
                lastSyncLabel={formatSyncTime(lastCatalogSync)}
                catalogLoading={catalogLoading}
                onSync={() => void initializeCatalog(true)}
                isDark={isDarkMode}
                onToggleTheme={() => setThemeMode(isDarkMode ? 'light' : 'dark')}
                currentTab={currentTab}
                onTabChange={setCurrentTab}
                datasetManifest={datasetManifest}
                onSelectDataset={handleToolbarDatasetSelect}
                sidebarOpen={sidebarOpen}
                showRandom={currentTab === 'map' || currentTab === 'plots' || currentTab === 'table'}
                randomDisabled={randomPickDisabled}
                onRandomPick={handleRandomPick}
                showChoropleth={showChoropleth}
                onToggleChoropleth={setShowChoropleth}
              />
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: prefersReducedMotion ? 0 : 0.45 }}
                id="main-content"
                className="data-canvas relative min-h-0 min-w-0 flex-1 overflow-hidden rounded-md bg-[var(--bg)]"
                aria-label="Main content"
              >
              {currentTab === 'map' && (
                <>
                  <SriLankaMap
                    data={data || []}
                    datasetLevel={currentDatasetLevel}
                    renderLevel={renderLevel}
                    selectedDistrict={selectedDistrict}
                    selectedProvince={selectedProvince}
                    onDistrictSelect={selectDistrict}
                    onProvinceSelect={selectProvince}
                    colorScale={colorScale}
                    showTooltips={showTooltips}
                    showChoropleth={showChoropleth}
                    showCentroids={showCentroids}
                    showRivers={showRivers}
                    showPlants={showPlants}
                    showGrid={showGrid}
                    showBasins={showBasins}
                    isDarkMode={isDarkMode}
                    unit={currentDatasetUnit}
                    sidebarOpen={sidebarOpen}
                    accentColor={getAccentUiPalette(accentPresetId, accentTone, isDarkMode).main}
                    mapPlaybackActive={mapPlaybackActive}
                    prefersReducedMotion={prefersReducedMotion}
                  />

                  {data && data.length === 0 && (
                    <Box className="absolute top-1/2 left-1/2 z-[860] -translate-x-1/2 -translate-y-1/2 rounded-lg border border-[var(--border)] bg-[var(--surface)]/95 px-5 py-4 text-center shadow-[var(--shadow-lg)] backdrop-blur-md">
                      <span className="term-label">No geographic layer</span>
                      <Typography variant="body2" className="mt-1.5 text-[var(--ink-2)]">
                        This dataset isn’t mapped. Use the Plots or Table tabs.
                      </Typography>
                    </Box>
                  )}

                  {data && data.length > 0 && !rankingsHidden && (
                    <FloatingPanel
                      label="Top Regions"
                      onClose={() => setRankingsHidden(true)}
                      className="absolute left-3 top-3 z-[850] w-[min(248px,calc(100%-5rem))] md:left-4 md:top-4 md:w-[min(280px,calc(100%-1rem))] lg:w-[min(300px,calc(100%-1rem))] xl:w-[min(320px,calc(100%-1rem))]"
                    >
                      <RankingsChart
                        data={rankingsData}
                        unit={currentDatasetUnit}
                        onSelect={handleRankingsSelect}
                        playbackActive={mapPlaybackActive}
                        animationDurationMs={mapPlaybackFrameMs}
                      />
                    </FloatingPanel>
                  )}

                  {data && data.length > 0 && rankingsHidden && (
                    <button
                      type="button"
                      onClick={() => setRankingsHidden(false)}
                      className="absolute left-3 top-3 z-[850] flex items-center gap-1.5 rounded-md border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1.5 text-[var(--ink-2)] shadow-[var(--shadow-md)] transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)] md:left-4 md:top-4"
                    >
                      <span className="term-label">Top Regions</span>
                      <span aria-hidden className="text-[13px] leading-none">+</span>
                    </button>
                  )}

                  {data && data.length > 0 && showChoropleth && (
                    <MapColorLegend
                      colorScale={colorScale}
                      unit={currentDatasetUnit}
                      animateValues={mapPlaybackActive}
                      animationDurationMs={mapPlaybackFrameMs}
                    />
                  )}

                  {selectedMapItem && (
                    <Box
                      role="status"
                      aria-live="polite"
                      className="absolute right-3 top-24 z-[850] max-w-[min(18rem,calc(100%-1.5rem))] rounded-md border border-[var(--accent)] bg-[var(--surface)] px-3 py-2 shadow-[var(--shadow-md)]"
                    >
                      <span className="term-label text-[var(--accent)]">Selected {selectedMapItem.level}</span>
                      <div className="mt-0.5 truncate text-[13px] font-semibold text-[var(--ink)]">{selectedMapItem.name}</div>
                      <div className="mono mt-0.5 text-[13px] font-bold text-[var(--accent)]">
                        {formatMetricValue(selectedMapItem.value, currentDatasetUnit, 'compact')}
                      </div>
                    </Box>
                  )}

                  {showCebLive && (
                    <FloatingPanel
                      label="CEB live mix"
                      onClose={() => setShowCebLive(false)}
                      className="absolute left-1/2 top-3 z-[856] ml-[-132px]"
                    >
                      <CebLivePanel />
                    </FloatingPanel>
                  )}

                  {activeDataset && (
                    <Box
                      className={`absolute bottom-8 z-[860] md:bottom-6 xl:bottom-4 ${
                        isMobileLayout
                          ? 'left-3 right-3'
                          : sidebarOpen
                            ? 'left-4 right-auto w-[min(46rem,calc(100%-2rem))]'
                            : 'left-1/2 w-[min(46rem,calc(100%-2rem))] -translate-x-1/2'
                      }`}
                    >
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
                  isDark={isDarkMode}
                />
              )}

              {currentTab === 'table' && (
                <DataTable tableData={tableData} />
              )}

              {currentTab === 'sources' && (
                <SourcesContent
                  datasetManifest={datasetManifest}
                  onSelectDataset={handleToolbarDatasetSelect}
                />
              )}
              </motion.div>
            </div>

            {isMobileLayout && sidebarOpen && (
              <button
                type="button"
                aria-label="Close dataset inspector"
                onClick={toggleSidebar}
                className="fixed inset-0 z-[1190] cursor-default bg-[rgba(15,19,17,0.46)] backdrop-blur-[1px] md:hidden"
              />
            )}

            <Sidebar
              open={sidebarOpen}
              onClose={toggleSidebar}
              currentDataset={currentDataset}
              data={data}
              loading={loading || catalogLoading}
              selectedDistrict={selectedDistrict}
              selectedProvince={selectedProvince}
              selectedMetric={selectedMetric}
              availableMetrics={availableMetrics}
              currentDatasetLevel={currentDatasetLevel}
              years={years}
              currentDatasetSource={currentDatasetSource}
              currentDatasetSecondarySource={currentDatasetSecondarySource}
              currentDatasetUnit={currentDatasetUnit}
              currentTab={currentTab}
              showChoropleth={showChoropleth}
              showCentroids={showCentroids}
              renderLevel={renderLevel}
              availableAdminLevels={availableAdminLevels}
              onAdminLevelChange={setMapAdminLevel}
              showRivers={showRivers}
              showPlants={showPlants}
              showGrid={showGrid}
              showBasins={showBasins}
              showCebLive={showCebLive}
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
              onToggleRivers={setShowRivers}
              onTogglePlants={setShowPlants}
              onToggleGrid={setShowGrid}
              onToggleBasins={setShowBasins}
              onToggleCebLive={setShowCebLive}
              darkMode={isDarkMode}
              onToggleDarkMode={() => setThemeMode(isDarkMode ? 'light' : 'dark')}
              onViewRawData={() => setCurrentTab('table')}
              mapPlaybackActive={mapPlaybackActive}
              mapPlaybackFrameMs={mapPlaybackFrameMs}
            />
          </Box>

          {error && (
            <Box className="fixed bottom-20 left-1/2 z-[1300] -translate-x-1/2 px-3">
              <Alert severity="error" className="rounded-lg border border-red-300/50 shadow-[var(--shadow-md)]">{error}</Alert>
            </Box>
          )}

          {loading && (
            <Box className="fixed inset-0 z-[1300] flex items-center justify-center bg-[rgba(34,32,28,0.22)] backdrop-blur-sm">
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="rounded-lg border border-[var(--outline)] bg-[var(--surface)]/94 p-6 shadow-[var(--shadow-md)]"
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
