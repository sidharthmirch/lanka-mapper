'use client'

import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import {
  Box,
  ButtonBase,
  Collapse,
  Typography,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Card,
  CardContent,
  Chip,
  Skeleton,
  IconButton,
  Divider,
  Slider,
  Switch,
  Button,
  Tooltip,
  Link,
  CircularProgress,
} from '@mui/material'
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined'
import SyncIcon from '@mui/icons-material/Sync'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import ShuffleIcon from '@mui/icons-material/Shuffle'
import type { AppTab, ColorScale, DatasetManifestEntry, DatasetSource, MapAdminLevel, MapData } from '@/types'
import { formatMetricValue, isDisplayableUnit, isAdditiveUnit } from '@/lib/formatDataValue'
import { sourceShortLabel, sourceFullLabel } from '@/lib/sourceLabels'
import { useAppStore } from '@/store'
import { useAnimatedScalar } from '@/hooks/useAnimatedScalar'
import { ACCENT_PRESETS, GRADIENT_PRESETS, REGION_SHADING_GRADIENT_CSS } from '@/lib/uiThemePresets'
import PlotSeriesPicker from '@/components/tabs/PlotSeriesPicker'

interface SidebarProps {
  /** Expanded (full panel) vs collapsed (narrow rail). */
  open: boolean
  /** Toggles expanded/collapsed; used for header close and rail expand. */
  onClose: () => void
  currentDataset: string | null
  data: MapData[] | null
  loading: boolean
  selectedDistrict: string | null
  selectedMetric: string | null
  availableMetrics: string[]
  currentDatasetLevel: 'district' | 'province' | 'national' | null
  years: number[]
  currentDatasetSource: DatasetSource | null
  currentDatasetSecondarySource: string | null
  currentDatasetUnit: string | null
  currentTab: AppTab
  showChoropleth: boolean
  showBasins: boolean
  /** Active choropleth boundary granularity. */
  renderLevel: MapAdminLevel
  /** Levels offered for the current dataset (native + finer). */
  availableAdminLevels: MapAdminLevel[]
  onAdminLevelChange: (level: MapAdminLevel) => void
  showRivers: boolean
  showPlants: boolean
  showGrid: boolean
  showCebLive: boolean
  colorScale: ColorScale
  datasetManifest: DatasetManifestEntry[]
  totalDatasets: number
  catalogCounts: {
    total: number
    ldflk: number
    nuuuwan: number
  }
  lastCatalogSyncLabel: string
  catalogLoading: boolean
  onCatalogSync: () => void
  onRandomPick?: () => void
  randomDisabled?: boolean
  seriesData: Record<string, Record<number, number>>
  plotYearRange: [number, number] | null
  onPlotYearRangeChange: (range: [number, number]) => void
  plotSeriesSelection: string[]
  onPlotSeriesSelectionChange: (names: string[]) => void
  onDatasetChange: (dataset: string) => void
  onMetricChange: (metric: string) => void
  onToggleChoropleth: (show: boolean) => void
  onToggleRivers: (show: boolean) => void
  onTogglePlants: (show: boolean) => void
  onToggleGrid: (show: boolean) => void
  onToggleBasins: (show: boolean) => void
  onToggleCebLive: (show: boolean) => void
  onViewRawData: () => void
  /** Light/dark theme toggle (warm-neutral light ↔ warm dark). */
  darkMode: boolean
  onToggleDarkMode: () => void
  /**
   * Map playback is driving `data` via per-frame interpolation. Stat cards
   * (max/avg/total/range/selected) ease between playback frames and round to
   * integers during play — matches the legend/rankings/tooltip policy.
   */
  mapPlaybackActive?: boolean
  /** Frame interval (ms) at current playback speed; drives ease time-constant. */
  mapPlaybackFrameMs?: number
}

/**
 * Drop-in `formatMetricValue` that eases the numeric input between playback
 * frames. When `playbackActive` is false the hook returns the exact target and
 * rendering matches the pre-animation behavior.
 */
function AnimatedMetricText({
  value,
  unit,
  playbackActive,
  durationMs,
}: {
  value: number
  unit: string | null
  playbackActive: boolean
  durationMs: number
}) {
  const animated = useAnimatedScalar(value, playbackActive, durationMs, {
    roundWhileActive: true,
  })
  // Every figure on the desk renders mono + tabular so columns of numbers align.
  return <span className="mono">{formatMetricValue(animated, unit)}</span>
}

const MAX_SIDEBAR_DATASET_OPTIONS = 180

const LDFLK_REPO_URL = 'https://github.com/LDFLK/datasets'
const LDS_PORTAL_URL = 'https://nuuuwan.github.io/lanka_data_search/'

function getLevelChipStyles(level: 'district' | 'province' | 'national') {
  if (level === 'district') return { label: 'District', className: 'bg-[var(--surface-2)] text-[var(--ink)]' }
  if (level === 'province') return { label: 'Province', className: 'bg-[var(--surface-2)] text-[var(--ink)]' }
  return { label: 'National', className: 'bg-[var(--surface-2)] text-[var(--ink)]' }
}

/** Match MapTimeToolbar: default MUI mark `top` aligns labels with the rail; sit labels below the track. */
const plotYearRangeSliderSx = {
  mt: 0.5,
  px: { xs: 0.5, sm: 1 },
  boxSizing: 'border-box',
  overflow: 'visible',
  '& .MuiSlider-root.MuiSlider-marked': {
    marginBottom: '30px',
  },
  '& .MuiSlider-mark': {
    display: 'none',
  },
  '& .MuiSlider-markLabel': {
    fontSize: 11,
    fontFamily: 'inherit',
    color: 'var(--ink-2)',
    whiteSpace: 'nowrap',
    lineHeight: 1.35,
    top: '46px',
    transform: 'translateX(-50%)',
    transformOrigin: 'top center',
    '@media (pointer: coarse)': {
      top: '52px',
    },
  },
  '& .MuiSlider-markLabel:first-of-type:not(:last-of-type)': {
    transform: 'translateX(0)',
  },
  '& .MuiSlider-markLabel:last-of-type:not(:first-of-type)': {
    transform: 'translateX(-100%)',
  },
} as const

export default function Sidebar({
  open,
  onClose,
  currentDataset,
  data,
  loading,
  selectedDistrict,
  selectedMetric,
  availableMetrics,
  currentDatasetLevel,
  years,
  currentDatasetSource,
  currentDatasetSecondarySource,
  currentDatasetUnit,
  currentTab,
  showChoropleth,
  showBasins,
  renderLevel,
  availableAdminLevels,
  onAdminLevelChange,
  showRivers,
  showPlants,
  showGrid,
  showCebLive,
  colorScale,
  datasetManifest,
  totalDatasets,
  catalogCounts,
  lastCatalogSyncLabel,
  catalogLoading,
  onCatalogSync,
  onRandomPick,
  randomDisabled = false,
  seriesData,
  plotYearRange,
  onPlotYearRangeChange,
  plotSeriesSelection,
  onPlotSeriesSelectionChange,
  onDatasetChange,
  onMetricChange,
  onToggleChoropleth,
  onToggleRivers,
  onTogglePlants,
  onToggleGrid,
  onToggleBasins,
  onToggleCebLive,
  onViewRawData,
  darkMode,
  onToggleDarkMode,
  mapPlaybackActive = false,
  mapPlaybackFrameMs = 450,
}: SidebarProps) {
  const accentPresetId = useAppStore((s) => s.accentPresetId)
  const accentTone = useAppStore((s) => s.accentTone)
  const gradientPresetId = useAppStore((s) => s.gradientPresetId)
  const setAccentPresetId = useAppStore((s) => s.setAccentPresetId)
  const setAccentTone = useAppStore((s) => s.setAccentTone)
  const setGradientPresetId = useAppStore((s) => s.setGradientPresetId)
  const [themeSectionOpen, setThemeSectionOpen] = useState(false)

  const filteredDatasets = useMemo(() => {
    const tabFiltered = currentTab === 'map'
      ? datasetManifest.filter((d) => d.hasGeo)
      : currentTab === 'plots'
        ? [...datasetManifest].sort((a, b) => {
            if (a.hasTime !== b.hasTime) return a.hasTime ? -1 : 1
            return a.name.localeCompare(b.name)
          })
        : datasetManifest

    const active = currentDataset ? datasetManifest.find((dataset) => dataset.id === currentDataset) : null
    const deduped = active
      ? [active, ...tabFiltered.filter((dataset) => dataset.id !== active.id)]
      : tabFiltered

    return deduped.slice(0, MAX_SIDEBAR_DATASET_OPTIONS)
  }, [currentDataset, currentTab, datasetManifest])

  const sortedYears = useMemo(() => [...years].sort((a, b) => a - b), [years])

  const sliderMarks = useMemo(() => {
    const labelledYears = new Set<number>()
    if (sortedYears.length <= 8) {
      sortedYears.forEach((year) => labelledYears.add(year))
    } else if (sortedYears.length > 0) {
      labelledYears.add(sortedYears[0])
      labelledYears.add(sortedYears[sortedYears.length - 1])
      const step = Math.max(1, Math.floor(sortedYears.length / 5))
      for (let index = step; index < sortedYears.length - 1; index += step) {
        labelledYears.add(sortedYears[index])
      }
    }

    return sortedYears.map((year) => ({
      value: year,
      label: labelledYears.has(year) ? `${year}` : undefined,
    }))
  }, [sortedYears])

  const plotRangeValue: [number, number] = plotYearRange && sortedYears.length > 0
    ? [
        Math.max(sortedYears[0], Math.min(plotYearRange[0], plotYearRange[1])),
        Math.min(sortedYears[sortedYears.length - 1], Math.max(plotYearRange[0], plotYearRange[1])),
      ]
    : sortedYears.length > 0
      ? [sortedYears[0], sortedYears[sortedYears.length - 1]]
      : [new Date().getFullYear(), new Date().getFullYear()]

  const seriesNames = useMemo(
    () => Object.keys(seriesData).sort((a, b) => a.localeCompare(b)),
    [seriesData],
  )

  // `data` identity changes on every playback frame; without memoization
  // the stats + maxItem reductions (and the province-dedupe Map build) run
  // on every tick alongside the downstream Card renders.
  const statsData = useMemo(
    () => (currentDatasetLevel === 'province' && data
      ? Array.from(new Map(data.map((item) => [item.originalName || item.name, item])).values())
      : data),
    [currentDatasetLevel, data],
  )

  const stats = useMemo(() => {
    if (!statsData || statsData.length === 0) return null

    // Reducer form avoids the spread-into-Math.min/max call pattern, which
    // can blow the argument stack on very large series (e.g. a national
    // view spanning every municipality). Sri Lanka districts never hit
    // that limit today, but this is cheap insurance.
    let total = 0
    let max = -Infinity
    let min = Infinity
    for (const item of statsData) {
      total += item.value
      if (item.value > max) max = item.value
      if (item.value < min) min = item.value
    }
    return {
      total,
      max,
      min,
      avg: total / statsData.length,
      count: statsData.length,
    }
  }, [statsData])

  const maxItem = useMemo(() => {
    if (!statsData || statsData.length === 0) return null
    return statsData.reduce((m, item) => (item.value > m.value ? item : m), statsData[0])
  }, [statsData])

  // Summing percentages / rates / indices across regions is meaningless (the
  // "340%" bug). For non-additive units, lead the readout with the mean instead
  // of a nonsense total.
  const additive = isAdditiveUnit(currentDatasetUnit)
  const aggregateLabel = useMemo(() => {
    const scope = currentDatasetLevel === 'district'
      ? ', all districts'
      : currentDatasetLevel === 'province'
        ? ', all provinces'
        : currentDatasetLevel === 'national'
          ? ', national'
          : ''
    return `${additive ? 'Total' : 'Average'}${scope}`
  }, [currentDatasetLevel, additive])

  const showRandom = currentTab !== 'sources' && onRandomPick

  return (
    <motion.div
      layout
      initial={false}
      animate={{ opacity: 1 }}
      transition={{
        layout: { type: 'tween', duration: 0.34, ease: [0.22, 1, 0.36, 1] },
      }}
      className={`fixed z-[1200] flex flex-col overflow-hidden rounded-md border border-[var(--border)] bg-[var(--surface)]/95 shadow-[var(--shadow-sm)] backdrop-blur-sm md:relative md:h-full md:shrink-0 ${open ? 'inset-x-2 bottom-[max(0.5rem,env(safe-area-inset-bottom))] top-[max(0.5rem,env(safe-area-inset-top))] min-w-0 md:inset-auto md:w-[288px] lg:w-[320px] xl:w-[360px]' : 'right-2 top-[var(--command-rail-top,7rem)] h-auto max-h-[calc(100dvh-var(--command-rail-top,7rem)-1rem)] w-[52px] md:inset-auto md:h-full md:w-[52px]'}`}
      style={{ color: 'var(--ink)' }}
    >
      {!open ? (
        <Box className="flex h-full min-h-0 flex-col items-center gap-2 px-1 py-2.5">
          <Tooltip title="Expand sidebar">
            <IconButton
              onClick={onClose}
              size="small"
              aria-label="Expand sidebar"
              className="bg-[var(--surface-2)] hover:bg-[var(--surface-3)]"
              sx={{ width: { xs: 38, sm: 34 }, height: { xs: 38, sm: 34 } }}
            >
              <ChevronRightIcon fontSize="small" />
            </IconButton>
          </Tooltip>

          {showRandom && onRandomPick && (
            <Tooltip title="Random dataset">
              <span>
                <IconButton
                  type="button"
                  size="small"
                  onClick={onRandomPick}
                  disabled={randomDisabled}
                  aria-label="Random dataset"
                  className="bg-[var(--surface-2)] hover:bg-[var(--surface-3)]"
                  sx={{ width: { xs: 38, sm: 34 }, height: { xs: 38, sm: 34 } }}
                >
                  <ShuffleIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
          )}

          {currentTab === 'map' && (
            <Tooltip title="Region shading">
              <Switch
                size="small"
                checked={showChoropleth}
                onChange={(_, checked) => onToggleChoropleth(checked)}
                inputProps={{ 'aria-label': 'Region shading' }}
                sx={{ transform: 'scale(0.85)' }}
              />
            </Tooltip>
          )}
        </Box>
      ) : (
        <>
          <Box className="flex items-start justify-between gap-2 border-b border-[var(--border)]/90 px-4 pb-3 pt-3.5">
            <Box className="min-w-0 flex-1">
              <Box className="flex items-center gap-2">
                <span aria-hidden className="h-2 w-2 shrink-0 rounded-[2px] bg-[var(--accent)]" />
                <Typography variant="h6" component="h2" className="font-serif-identity text-balance text-[14px] font-semibold tracking-[0.01em]">
                  Inspector
                </Typography>
              </Box>
              <span className="mono mt-1 block text-[10px] tracking-[0.04em] text-[var(--ink-3)]">
                {totalDatasets.toLocaleString()} sets · sync {lastCatalogSyncLabel}
              </span>
            </Box>
            <IconButton onClick={onClose} size="small" aria-label="Collapse sidebar" className="shrink-0 bg-[var(--surface-2)] hover:bg-[var(--surface-3)]">
              <ChevronLeftIcon />
            </IconButton>
          </Box>

          <Box className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
            <Box className="space-y-2 border-b border-[var(--border)]/70 pb-4">
              <span className="term-label">Sources</span>
              <Box className="mt-2 flex items-center justify-between gap-3">
                <Box className="flex min-w-0 flex-1 items-center gap-2 flex-wrap">
                  <Chip
                    component={Link}
                    href={LDFLK_REPO_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    clickable
                    label={`LDFLK ${catalogCounts.ldflk}`}
                    size="small"
                    className="bg-[var(--surface)] text-[var(--ink)] font-semibold"
                  />
                  <Chip
                    component={Link}
                    href={LDS_PORTAL_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    clickable
                    label={`LDS ${catalogCounts.nuuuwan}`}
                    size="small"
                    className="bg-[var(--surface)] text-[var(--ink)] font-semibold"
                  />
                </Box>
                {showRandom && (
                  <Button
                    type="button"
                    size="small"
                    variant="outlined"
                    color="secondary"
                    onClick={onRandomPick}
                    disabled={randomDisabled}
                    sx={{
                      flexShrink: 0,
                      minHeight: 28,
                      py: 0,
                      px: 1.3,
                      fontSize: '0.7rem',
                      fontWeight: 650,
                      borderRadius: '8px',
                    }}
                  >
                    Random pick
                  </Button>
                )}
              </Box>
            </Box>

            <Box className="space-y-3">
              <FormControl fullWidth size="small" variant="outlined">
                <InputLabel className="px-1">Dataset</InputLabel>
                <Select
                  value={currentDataset || ''}
                  label="Dataset"
                  onChange={(event) => onDatasetChange(event.target.value)}
                  sx={{
                    borderRadius: '8px',
                    '& .MuiOutlinedInput-notchedOutline': { borderColor: 'var(--border)' },
                  }}
                >
                  {filteredDatasets.map((dataset) => {
                    const levelChip = getLevelChipStyles(dataset.level)
                    return (
                      <MenuItem key={dataset.id} value={dataset.id} className="rounded-lg mx-1 my-0.5">
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%', justifyContent: 'space-between' }}>
                          <Box sx={{ minWidth: 0, flex: 1 }}>
                            <Typography variant="body2" className="font-semibold truncate">{dataset.name}</Typography>
                            <Typography variant="caption" className="opacity-65 truncate block">
                              {sourceShortLabel(dataset.source)} · {dataset.years[0]}{dataset.years.length > 1 ? ` to ${dataset.years[dataset.years.length - 1]}` : ''}
                            </Typography>
                          </Box>
                          <Box sx={{ display: 'flex', gap: 0.5, flexShrink: 0 }}>
                            {dataset.hasGeo && (
                              <Chip
                                label="Geo"
                                size="small"
                                className="bg-[var(--surface-2)] text-[var(--ink)] font-semibold"
                                sx={{ height: 18, fontSize: '0.58rem', borderRadius: '6px', minWidth: 0, px: 0.5 }}
                              />
                            )}
                            {dataset.hasTime && (
                              <Chip
                                label="Time"
                                size="small"
                                className="bg-[var(--surface-2)] text-[var(--ink)] font-semibold"
                                sx={{ height: 18, fontSize: '0.58rem', borderRadius: '6px', minWidth: 0, px: 0.5 }}
                              />
                            )}
                            <Chip
                              label={levelChip.label}
                              size="small"
                              className={`${levelChip.className} font-semibold`}
                              sx={{ height: 20, fontSize: '0.65rem', borderRadius: '8px' }}
                            />
                          </Box>
                        </Box>
                      </MenuItem>
                    )
                  })}
                </Select>
              </FormControl>

              <Typography variant="caption" className="opacity-60">
                Showing {filteredDatasets.length.toLocaleString()} dataset(s) for this tab. Use the top search to find any dataset.
              </Typography>

              {availableMetrics.length > 1 && currentTab !== 'map' && currentTab !== 'sources' && (
                <FormControl fullWidth size="small" variant="outlined">
                  <InputLabel className="px-1">Metric</InputLabel>
                  <Select
                    value={selectedMetric || ''}
                    label="Metric"
                    onChange={(event) => onMetricChange(event.target.value)}
                    sx={{
                      borderRadius: '8px',
                      '& .MuiOutlinedInput-notchedOutline': { borderColor: 'var(--border)' },
                    }}
                  >
                    {availableMetrics.map((metric) => (
                      <MenuItem key={metric} value={metric} className="rounded-lg mx-1 my-0.5">
                        <Typography variant="body2" className="font-semibold">{metric}</Typography>
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              )}

              {currentTab === 'plots' && sortedYears.length > 1 && (
                <Box className="rounded-lg border border-[var(--border)] bg-[var(--surface)]/58 px-4 py-3 pb-4">
                  <Box className="mb-2 flex items-center justify-between gap-2">
                    <Typography variant="caption" className="text-[10px] font-semibold opacity-72">
                      Plot year range
                    </Typography>
                    <Typography variant="body2" className="shrink-0 font-semibold text-primary text-sm">
                      {plotRangeValue[0]} — {plotRangeValue[1]}
                    </Typography>
                  </Box>
                  <Box className="pb-1 pt-0.5">
                    <Slider
                      value={plotRangeValue}
                      min={sortedYears[0]}
                      max={sortedYears[sortedYears.length - 1]}
                      marks={sliderMarks}
                      step={null}
                      onChange={(_, value) => {
                        if (Array.isArray(value) && value.length === 2) {
                          onPlotYearRangeChange([value[0], value[1]])
                        }
                      }}
                      valueLabelDisplay="auto"
                      size="small"
                      sx={plotYearRangeSliderSx}
                    />
                  </Box>
                </Box>
              )}

              {currentTab === 'plots' && seriesNames.length > 0 && (
                <PlotSeriesPicker
                  seriesNames={seriesNames}
                  selected={plotSeriesSelection.filter((n) => seriesNames.includes(n))}
                  seriesData={seriesData}
                  onChange={onPlotSeriesSelectionChange}
                  isDark={darkMode}
                />
              )}

              <Box className="space-y-1 rounded-md bg-[var(--surface-2)]/50 px-3 py-2.5 text-xs">
                <div>
                  Source: <span className="font-semibold">{sourceFullLabel(currentDatasetSource)}</span>
                </div>
                <div>
                  Department: <span className="font-semibold">{currentDatasetSecondarySource || 'N/A'}</span>
                </div>
                <div>
                  Unit:{' '}
                  <span className="font-semibold">
                    {isDisplayableUnit(currentDatasetUnit) ? currentDatasetUnit!.trim() : '—'}
                  </span>
                </div>
                {(() => {
                  const activeDs = currentDataset ? datasetManifest.find((d) => d.id === currentDataset) : null
                  if (!activeDs) return null
                  return (
                    <>
                      {activeDs.category && (
                        <div>Category: <span className="font-semibold">{activeDs.category}</span></div>
                      )}
                      {activeDs.originalName && activeDs.originalName !== activeDs.name && (
                        <div className="opacity-70">
                          Catalog name: <span className="font-semibold break-words">{activeDs.originalName}</span>
                        </div>
                      )}
                    </>
                  )
                })()}
                {(() => {
                  const activeDs = currentDataset ? datasetManifest.find((d) => d.id === currentDataset) : null
                  if (!activeDs?.citation) return null
                  return (
                    <div className="pt-1 opacity-70">
                      Citation:{' '}
                      <a
                        href={activeDs.citationUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline font-semibold hover:opacity-100"
                      >
                        {activeDs.citation}
                      </a>
                    </div>
                  )
                })()}
              </Box>

              {currentTab === 'map' && (
                <Box className="space-y-1 border-t border-[var(--border)]/70 pt-3">
                  <span className="term-label">Layers</span>

                  {availableAdminLevels.length > 1 && (
                    <Box className="mt-2">
                      <Box className="mb-1.5 flex items-center gap-1.5 px-0.5">
                        <span className="term-label">Heat level</span>
                        <Tooltip title="Boundary granularity the heatmap paints at. Finer levels inherit each region's value from its parent (cities = Municipal / Urban Councils & Pradeshiya Sabhas).">
                          <InfoOutlinedIcon sx={{ fontSize: 13, color: 'var(--ink-3)' }} />
                        </Tooltip>
                      </Box>
                      <Box
                        role="group"
                        aria-label="Heatmap boundary level"
                        className="flex gap-1 rounded-md border border-[var(--border)] bg-[var(--surface)] p-0.5"
                      >
                        {availableAdminLevels.map((level) => {
                          const active = renderLevel === level
                          return (
                            <ButtonBase
                              key={level}
                              type="button"
                              onClick={() => onAdminLevelChange(level)}
                              aria-pressed={active}
                              className="flex-1 rounded-[5px] px-1 py-1 text-[11px] font-semibold capitalize transition-colors"
                              sx={{
                                color: active ? 'var(--on-accent, #fff)' : 'var(--ink-2)',
                                backgroundColor: active ? 'var(--accent)' : 'transparent',
                                '&:hover': { backgroundColor: active ? 'var(--accent)' : 'var(--surface-2)' },
                              }}
                            >
                              {level === 'city' ? 'Cities' : level}
                            </ButtonBase>
                          )
                        })}
                      </Box>
                    </Box>
                  )}

                  <Box className="mt-2 flex items-center justify-between rounded-md px-2 py-1.5 transition-colors hover:bg-[var(--surface)]/60">
                    <Box className="flex min-w-0 items-center gap-2">
                      <span className="h-3 w-4 shrink-0 rounded-[3px] border border-[var(--border-2)]" style={{ background: REGION_SHADING_GRADIENT_CSS }} />
                      <Typography variant="caption" className="font-semibold opacity-85">Region shading</Typography>
                      <Tooltip title="Shades regions by value for the selected metric and year.">
                        <InfoOutlinedIcon sx={{ fontSize: 13, color: 'var(--ink-3)' }} />
                      </Tooltip>
                    </Box>
                    <Switch size="small" checked={showChoropleth} onChange={(_, checked) => onToggleChoropleth(checked)} inputProps={{ 'aria-label': 'Region shading' }} />
                  </Box>

                  <Box className="flex items-center justify-between rounded-md px-2 py-1.5 transition-colors hover:bg-[var(--surface)]/60">
                    <Box className="flex items-center gap-2">
                      <span className="h-[3px] w-4 shrink-0 rounded-full" style={{ background: darkMode ? '#5fa8d3' : '#2e6f9e' }} />
                      <Typography variant="caption" className="font-semibold opacity-85">Rivers</Typography>
                    </Box>
                    <Switch size="small" checked={showRivers} onChange={(_, checked) => onToggleRivers(checked)} inputProps={{ 'aria-label': 'Rivers' }} />
                  </Box>

                  <Box className="flex items-center justify-between rounded-md px-2 py-1.5 transition-colors hover:bg-[var(--surface)]/60">
                    <Box className="flex items-center gap-2">
                      <span className="h-3 w-4 shrink-0 rounded-[3px] border border-dashed" style={{ borderColor: darkMode ? '#6fc2b4' : '#2c7a6e' }} />
                      <Typography variant="caption" className="font-semibold opacity-85">River basins</Typography>
                      <Tooltip title="Watershed boundaries (HydroSHEDS HydroBASINS), named by their dominant river. Hover a basin for its name and area.">
                        <InfoOutlinedIcon sx={{ fontSize: 13, color: 'var(--ink-3)' }} />
                      </Tooltip>
                    </Box>
                    <Switch size="small" checked={showBasins} onChange={(_, checked) => onToggleBasins(checked)} inputProps={{ 'aria-label': 'River basins' }} />
                  </Box>

                  <Box className="flex items-center justify-between rounded-md px-2 py-1.5 transition-colors hover:bg-[var(--surface)]/60">
                    <Box className="flex items-center gap-2">
                      <span className="flex shrink-0 items-center gap-0.5">
                        <span className="h-2 w-2 rounded-full" style={{ background: '#4ea3d1' }} />
                        <span className="h-2 w-2 rounded-full" style={{ background: '#f2c14e' }} />
                        <span className="h-2 w-2 rounded-full" style={{ background: '#6fcf97' }} />
                      </span>
                      <Typography variant="caption" className="font-semibold opacity-85">Power plants</Typography>
                      <Tooltip title="CSE-listed hydro, solar and wind plants, sized by capacity.">
                        <InfoOutlinedIcon sx={{ fontSize: 13, color: 'var(--ink-3)' }} />
                      </Tooltip>
                    </Box>
                    <Switch size="small" checked={showPlants} onChange={(_, checked) => onTogglePlants(checked)} inputProps={{ 'aria-label': 'Power plants' }} />
                  </Box>

                  <Box className="flex items-center justify-between rounded-md px-2 py-1.5 transition-colors hover:bg-[var(--surface)]/60">
                    <Box className="flex items-center gap-2">
                      <span className="h-0 w-4 shrink-0 border-t-2 border-dashed" style={{ borderColor: darkMode ? '#cf9b46' : '#9a6a24' }} />
                      <Typography variant="caption" className="font-semibold opacity-85">CEB grid</Typography>
                      <Tooltip title="Transmission lines (220 / 132 / 33 / 11 kV) from OpenStreetMap.">
                        <InfoOutlinedIcon sx={{ fontSize: 13, color: 'var(--ink-3)' }} />
                      </Tooltip>
                    </Box>
                    <Switch size="small" checked={showGrid} onChange={(_, checked) => onToggleGrid(checked)} inputProps={{ 'aria-label': 'CEB grid' }} />
                  </Box>

                  <Box className="flex items-center justify-between rounded-md px-2 py-1.5 transition-colors hover:bg-[var(--surface)]/60">
                    <Box className="flex items-center gap-2">
                      <span className="live-dot shrink-0" />
                      <Typography variant="caption" className="font-semibold opacity-85">CEB live mix</Typography>
                      <Tooltip title="Live national generation mix by source from the CEB Generation Summary (snapshot, refreshed periodically).">
                        <InfoOutlinedIcon sx={{ fontSize: 13, color: 'var(--ink-3)' }} />
                      </Tooltip>
                    </Box>
                    <Switch size="small" checked={showCebLive} onChange={(_, checked) => onToggleCebLive(checked)} inputProps={{ 'aria-label': 'CEB live mix' }} />
                  </Box>

                  <Box className="mt-3">
                    <Box className="mb-1 flex items-center justify-between text-[10px] font-semibold opacity-65">
                      <span>
                        <AnimatedMetricText
                          value={Math.round(colorScale.min)}
                          unit={currentDatasetUnit}
                          playbackActive={mapPlaybackActive}
                          durationMs={mapPlaybackFrameMs}
                        />
                      </span>
                      <span>
                        <AnimatedMetricText
                          value={Math.round(colorScale.max)}
                          unit={currentDatasetUnit}
                          playbackActive={mapPlaybackActive}
                          durationMs={mapPlaybackFrameMs}
                        />
                      </span>
                    </Box>
                    <Box
                      className="h-2 w-full rounded-full"
                      style={{ background: REGION_SHADING_GRADIENT_CSS }}
                    />
                  </Box>

                  {currentDatasetLevel === 'national' && (
                    <Typography variant="caption" className="mt-2 block text-amber-600">
                      This dataset is not geographic. Map overlays may appear sparse.
                    </Typography>
                  )}

                  {availableMetrics.length > 1 && (
                    <Box className="mt-3">
                      <span className="term-label mb-1.5 block">Metric Layers</span>
                      <Box className="flex flex-wrap gap-1.5">
                        {availableMetrics.map((metric) => (
                          <Chip
                            key={metric}
                            label={metric}
                            size="small"
                            variant={selectedMetric === metric ? 'filled' : 'outlined'}
                            color={selectedMetric === metric ? 'primary' : 'default'}
                            onClick={() => onMetricChange(metric)}
                            sx={{ fontSize: '0.7rem', fontWeight: 600, borderRadius: '8px', cursor: 'pointer' }}
                          />
                        ))}
                      </Box>
                    </Box>
                  )}
                </Box>
              )}

              <Button
                variant="outlined"
                fullWidth
                onClick={onViewRawData}
                sx={{
                  borderRadius: '8px',
                  fontWeight: 620,
                  borderColor: 'var(--border)',
                  backgroundColor: 'var(--surface)',
                  '&:hover': {
                    borderColor: 'var(--border)',
                    backgroundColor: 'var(--surface-2)',
                  },
                }}
              >
                View Raw Table
              </Button>
            </Box>

            <Divider className="border-[var(--border)]" />

            {loading ? (
              <Box className="space-y-3">
                <Skeleton variant="rectangular" height={88} className="rounded-lg" />
                <Box className="grid grid-cols-2 gap-3">
                  <Skeleton variant="rectangular" height={80} className="rounded-lg" />
                  <Skeleton variant="rectangular" height={80} className="rounded-lg" />
                </Box>
                <Skeleton variant="rectangular" height={110} className="rounded-lg" />
              </Box>
            ) : stats ? (
              <Box className="overflow-hidden rounded-md bg-[var(--surface-2)]/45">
                {/* Focal total — one big number anchors the readout; supporting stats sit below, hairline-separated (instrument panel, not a card grid). */}
                <Box className="border-b border-[var(--border)] px-4 py-3">
                  <Box className="flex items-baseline justify-between gap-2">
                    <span className="term-label">{aggregateLabel}</span>
                    <span className="mono text-[10px] text-[var(--ink-3)]">
                      <span className="text-[var(--ink-2)]">{stats.count.toLocaleString()}</span> entries
                    </span>
                  </Box>
                  <Box className="mono mt-1.5 flex items-baseline gap-1.5 break-all leading-none text-[var(--accent)]">
                    <span className="text-[26px] font-bold">
                      <AnimatedMetricText
                        value={additive ? stats.total : stats.avg}
                        unit={null}
                        playbackActive={mapPlaybackActive}
                        durationMs={mapPlaybackFrameMs}
                      />
                    </span>
                    {isDisplayableUnit(currentDatasetUnit) && (
                      <span className="text-[11px] font-semibold text-[var(--ink-3)]">{currentDatasetUnit!.trim()}</span>
                    )}
                  </Box>
                </Box>

                <Box className="grid grid-cols-3 divide-x divide-[var(--border)]">
                  {((additive
                    ? [['Max', stats.max], ['Avg', stats.avg], ['Min', stats.min]]
                    : [['Max', stats.max], ['Min', stats.min], ['n', stats.count]]) as Array<[string, number]>).map(([label, value]) => (
                    <Box key={label} className="px-3 py-2.5">
                      <span className="term-label">{label}</span>
                      <div className="mono mt-1 break-all text-[15px] font-semibold leading-none text-[var(--ink)]">
                        <AnimatedMetricText
                          value={value}
                          unit={null}
                          playbackActive={mapPlaybackActive}
                          durationMs={mapPlaybackFrameMs}
                        />
                      </div>
                    </Box>
                  ))}
                </Box>

                {maxItem && (
                  <Box className="flex items-center justify-between gap-3 border-t border-[var(--border)] px-4 py-2.5">
                    <Box className="min-w-0">
                      <span className="term-label" style={{ color: 'var(--accent)' }}>
                        {currentDatasetLevel === 'province' ? 'Top province' : currentDatasetLevel === 'district' ? 'Top district' : 'Top entry'}
                      </span>
                      <div className="truncate text-[13px] font-semibold text-[var(--ink)]">
                        {currentDatasetLevel === 'province' ? (maxItem.originalName || maxItem.name) : maxItem.name}
                      </div>
                    </Box>
                    <span className="mono shrink-0 text-[13px] font-bold text-[var(--accent)]">
                      <AnimatedMetricText
                        value={maxItem.value}
                        unit={null}
                        playbackActive={mapPlaybackActive}
                        durationMs={mapPlaybackFrameMs}
                      />
                    </span>
                  </Box>
                )}
              </Box>
            ) : (
              <Box className="text-center py-12 opacity-60">
                <Typography variant="body2" className="font-semibold">
                  Select a dataset to view statistics.
                </Typography>
              </Box>
            )}

            {selectedDistrict && (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                <Divider className="border-[var(--border)] mb-4" />
                <Card className="rounded-md border border-[var(--accent)] bg-[var(--accent-soft)] shadow-none">
                  <CardContent className="p-4">
                    <span className="term-label" style={{ color: 'var(--accent)' }}>
                      Selected District
                    </span>
                    <Typography variant="h6" className="mt-1.5 font-bold">
                      {selectedDistrict}
                    </Typography>
                    {data && (
                      <Typography variant="body2" className="mt-1 font-semibold opacity-80">
                        Value:{' '}
                        <span className="font-bold">
                          <AnimatedMetricText
                            value={
                              data.find((item) => item.name?.toLowerCase() === selectedDistrict.toLowerCase())?.value || 0
                            }
                            unit={currentDatasetUnit}
                            playbackActive={mapPlaybackActive}
                            durationMs={mapPlaybackFrameMs}
                          />
                        </span>
                      </Typography>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </Box>

          <Box className="border-t border-[var(--border)] bg-[var(--surface-2)] p-4">
            <Box className="mb-3 overflow-hidden rounded-lg border border-[var(--border)]">
              <ButtonBase
                type="button"
                className="flex w-full items-center justify-between px-2.5 py-2 text-left"
                onClick={() => setThemeSectionOpen((open) => !open)}
                aria-expanded={themeSectionOpen}
                sx={{ color: 'var(--ink)' }}
              >
                <Typography variant="caption" className="text-[10px] font-semibold opacity-82">
                  Theme
                </Typography>
                <ExpandMoreIcon
                  sx={{
                    fontSize: 20,
                    transition: 'transform 0.2s ease',
                    transform: themeSectionOpen ? 'none' : 'rotate(180deg)',
                  }}
                />
              </ButtonBase>
              <Collapse in={themeSectionOpen}>
                <Box className="space-y-3 border-t border-[var(--border)] px-2.5 pb-3 pt-2">
                  <Box className="flex items-center justify-between">
                    <Typography variant="caption" className="text-[11px] font-semibold" sx={{ color: 'var(--ink)' }}>
                      Dark mode
                    </Typography>
                    <Switch
                      size="small"
                      checked={darkMode}
                      onChange={onToggleDarkMode}
                      inputProps={{ 'aria-label': 'Toggle dark mode' }}
                    />
                  </Box>
                  <Box>
                    <Typography variant="caption" className="mb-1.5 block text-[10px] font-semibold opacity-72">
                      Accent
                    </Typography>
                    <Box className="flex flex-wrap gap-1.5">
                      {ACCENT_PRESETS.map((preset) => (
                        <button
                          key={preset.id}
                          type="button"
                          title={`${preset.label} (bold)`}
                          onClick={() => {
                            setAccentPresetId(preset.id)
                            setAccentTone('main')
                          }}
                          className="h-7 w-7 shrink-0 rounded-full border-2 border-transparent transition-shadow focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface-2)]"
                          style={{
                            backgroundColor: preset.main,
                            boxShadow:
                              accentPresetId === preset.id && accentTone === 'main'
                                ? '0 0 0 2px var(--primary), 0 0 0 4px var(--surface-2)'
                                : undefined,
                          }}
                        />
                      ))}
                    </Box>
                    <Typography variant="caption" className="mb-1.5 mt-2 block text-[10px] font-semibold opacity-72">
                      Soft accent
                    </Typography>
                    <Typography variant="caption" className="mb-1.5 block text-[9px] leading-snug opacity-55">
                      Grey-tinted primary — calmer on dark maps and dark mode.
                    </Typography>
                    <Box className="flex flex-wrap gap-1.5">
                      {ACCENT_PRESETS.map((preset) => (
                        <button
                          key={`${preset.id}-soft`}
                          type="button"
                          title={`${preset.label} (soft)`}
                          onClick={() => {
                            setAccentPresetId(preset.id)
                            setAccentTone('soft')
                          }}
                          className="h-7 w-7 shrink-0 rounded-full border-2 border-[var(--border)] transition-shadow focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface-2)]"
                          style={{
                            backgroundColor: preset.soft,
                            boxShadow:
                              accentPresetId === preset.id && accentTone === 'soft'
                                ? '0 0 0 2px var(--primary), 0 0 0 4px var(--surface-2)'
                                : undefined,
                          }}
                        />
                      ))}
                    </Box>
                  </Box>
                  <Box>
                    <Typography variant="caption" className="mb-1.5 block text-[10px] font-semibold opacity-72">
                      Region shading ramp
                    </Typography>
                    <Box className="flex flex-wrap gap-1.5">
                      {GRADIENT_PRESETS.map((preset) => (
                        <button
                          key={preset.id}
                          type="button"
                          title={preset.label}
                          onClick={() => setGradientPresetId(preset.id)}
                          className="h-6 w-[4.25rem] shrink-0 overflow-hidden rounded-md border-2 transition-shadow focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface-2)]"
                          style={{
                            background: `linear-gradient(90deg, ${preset.colors.join(', ')})`,
                            borderColor:
                              gradientPresetId === preset.id ? 'var(--primary)' : 'transparent',
                            boxShadow:
                              gradientPresetId === preset.id
                                ? '0 0 0 1px var(--primary)'
                                : undefined,
                          }}
                        />
                      ))}
                    </Box>
                  </Box>
                </Box>
              </Collapse>
            </Box>

            <Box className="flex items-center gap-2">
              <Typography
                variant="caption"
                className="min-w-0 flex-1 leading-snug opacity-60 font-semibold text-[10px]"
              >
                Last synced at {lastCatalogSyncLabel}
              </Typography>
              <Button
                type="button"
                size="small"
                variant="outlined"
                color="primary"
                onClick={onCatalogSync}
                disabled={catalogLoading}
                sx={{
                  minHeight: 26,
                  maxHeight: 28,
                  py: 0,
                  px: 0.85,
                  fontSize: '0.65rem',
                  borderRadius: '8px',
                  flexShrink: 0,
                }}
                startIcon={catalogLoading ? <CircularProgress size={11} /> : <SyncIcon sx={{ fontSize: 13 }} />}
              >
                Sync
              </Button>
            </Box>
          </Box>
        </>
      )}
    </motion.div>
  )
}
