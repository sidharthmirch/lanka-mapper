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
  TextField,
  Button,
  Tooltip,
  Autocomplete,
  Link,
  CircularProgress,
} from '@mui/material'
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import ShuffleIcon from '@mui/icons-material/Shuffle'
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined'
import SyncIcon from '@mui/icons-material/Sync'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import type { AppTab, ColorScale, DatasetManifestEntry, MapData } from '@/types'
import { formatMetricValue, isDisplayableUnit } from '@/lib/formatDataValue'
import { useAppStore } from '@/store'
import { useAnimatedScalar } from '@/hooks/useAnimatedScalar'
import { ACCENT_PRESETS, GRADIENT_PRESETS, REGION_SHADING_GRADIENT_CSS } from '@/lib/uiThemePresets'

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
  currentDatasetSource: 'ldflk' | 'nuuuwan' | null
  currentDatasetSecondarySource: string | null
  currentDatasetUnit: string | null
  darkMode: boolean
  currentTab: AppTab
  showChoropleth: boolean
  showCentroids: boolean
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
  onToggleDarkMode: () => void
  onToggleChoropleth: (show: boolean) => void
  onToggleCentroids: (show: boolean) => void
  onViewRawData: () => void
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
  return <>{formatMetricValue(animated, unit)}</>
}

const MAX_SIDEBAR_DATASET_OPTIONS = 180

const LDFLK_REPO_URL = 'https://github.com/LDFLK/datasets'
const LDS_PORTAL_URL = 'https://nuuuwan.github.io/lanka_data_search/'

function getSourceLabel(source: 'ldflk' | 'nuuuwan' | null): string {
  if (source === 'ldflk') return 'Lanka Data Foundation (LDFLK)'
  if (source === 'nuuuwan') return 'Lanka Data Search (LDS)'
  return 'N/A'
}

function getLevelChipStyles(level: 'district' | 'province' | 'national') {
  if (level === 'district') return { label: 'DISTRICT', className: 'bg-sky-100 text-sky-800' }
  if (level === 'province') return { label: 'PROVINCE', className: 'bg-amber-100 text-amber-800' }
  return { label: 'NATIONAL', className: 'bg-slate-200 text-slate-700' }
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
    color: 'var(--on-surface-variant)',
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
  darkMode,
  currentTab,
  showChoropleth,
  showCentroids,
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
  onToggleDarkMode,
  onToggleChoropleth,
  onToggleCentroids,
  onViewRawData,
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

  const allSeriesSelected = seriesNames.length > 0
    && plotSeriesSelection.length === seriesNames.length
    && seriesNames.every((n) => plotSeriesSelection.includes(n))

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

  const totalAggregateLabel = useMemo(() => {
    switch (currentDatasetLevel) {
      case 'district':
        return 'Total, all districts'
      case 'province':
        return 'Total, all provinces'
      case 'national':
        return 'Total, national'
      default:
        return 'Total'
    }
  }, [currentDatasetLevel])

  const showRandom = (currentTab === 'map' || currentTab === 'plots') && onRandomPick

  return (
    <motion.div
      layout
      initial={false}
      animate={{ opacity: 1 }}
      transition={{
        layout: { type: 'tween', duration: 0.34, ease: [0.22, 1, 0.36, 1] },
      }}
      className={`relative z-[900] h-full shrink-0 flex flex-col overflow-hidden rounded-[20px] border border-[var(--outline)] bg-[var(--surface)]/88 shadow-[0_20px_36px_rgba(0,0,0,0.14)] backdrop-blur-2xl ${open ? 'w-full min-w-0 sm:w-[380px]' : 'w-[52px]'}`}
      style={{ color: 'var(--on-surface)' }}
    >
      {!open ? (
        <Box className="flex h-full min-h-0 flex-col items-center gap-2 py-3 px-1">
          <Tooltip title="Expand sidebar">
            <IconButton
              onClick={onClose}
              size="small"
              aria-label="Expand sidebar"
              className="bg-[var(--surface-variant)]/70 hover:bg-[var(--surface-variant)]"
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
                  color="secondary"
                  onClick={onRandomPick}
                  disabled={randomDisabled}
                  aria-label="Random dataset"
                >
                  <ShuffleIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
          )}

          {currentTab === 'map' && (
            <Box className="mt-1 flex w-full flex-col items-center gap-2.5 border-t border-[var(--outline)]/80 pt-3">
              <Tooltip title="Region shading">
                <Box className="flex flex-col items-center gap-0.5">
                  <Switch
                    size="small"
                    checked={showChoropleth}
                    onChange={(_, checked) => onToggleChoropleth(checked)}
                    inputProps={{ 'aria-label': 'Region shading' }}
                  />
                  <Typography variant="caption" className="max-w-[3.25rem] text-center text-[7px] font-semibold uppercase leading-tight tracking-tight opacity-70">
                    SHADING
                  </Typography>
                </Box>
              </Tooltip>
              <Tooltip title="Show centroid points">
                <Box className="flex flex-col items-center gap-0.5">
                  <Switch
                    size="small"
                    checked={showCentroids}
                    onChange={(_, checked) => onToggleCentroids(checked)}
                    inputProps={{ 'aria-label': 'Show centroid points' }}
                  />
                  <Typography variant="caption" className="max-w-[3rem] text-center text-[8px] font-semibold uppercase leading-tight tracking-tight opacity-70">
                    Points
                  </Typography>
                </Box>
              </Tooltip>
            </Box>
          )}
        </Box>
      ) : (
        <>
          <Box className="flex items-start justify-between gap-2 p-5 border-b border-[var(--outline)]/80">
            <Box className="min-w-0 flex-1">
              <Typography variant="h6" className="font-semibold tracking-tight">
                Data Explorer
              </Typography>
              <Typography variant="caption" className="mt-1 block opacity-70">
                {totalDatasets.toLocaleString()} datasets · Last synced {lastCatalogSyncLabel}
              </Typography>
            </Box>
            <IconButton onClick={onClose} size="small" className="bg-[var(--surface-variant)]/70 hover:bg-[var(--surface-variant)] shrink-0">
              <ChevronLeftIcon />
            </IconButton>
          </Box>

          <Box className="flex-1 overflow-y-auto p-5 space-y-6">
            <Box className="rounded-2xl border border-[var(--outline)]/80 bg-[var(--surface-variant)]/45 p-3">
              <Typography variant="caption" className="font-semibold uppercase tracking-[0.12em] opacity-65 text-[10px]">
                Source Breakdown
              </Typography>
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
                    className="bg-sky-100 text-sky-800 font-semibold"
                  />
                  <Chip
                    component={Link}
                    href={LDS_PORTAL_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    clickable
                    label={`LDS ${catalogCounts.nuuuwan}`}
                    size="small"
                    className="bg-amber-100 text-amber-800 font-semibold"
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
                      px: 1.25,
                      fontSize: '0.65rem',
                      fontWeight: 700,
                      letterSpacing: '0.08em',
                      borderRadius: '10px',
                    }}
                  >
                    RANDOM
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
                    borderRadius: '12px',
                    '& .MuiOutlinedInput-notchedOutline': { borderColor: 'var(--outline)' },
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
                              {dataset.source === 'ldflk' ? 'LDFLK' : 'LDS'} · {dataset.years[0]}{dataset.years.length > 1 ? ` to ${dataset.years[dataset.years.length - 1]}` : ''}
                            </Typography>
                          </Box>
                          <Box sx={{ display: 'flex', gap: 0.5, flexShrink: 0 }}>
                            {dataset.hasGeo && (
                              <Chip
                                label="GEO"
                                size="small"
                                className="bg-emerald-100 text-emerald-800 font-bold"
                                sx={{ height: 18, fontSize: '0.58rem', borderRadius: '6px', minWidth: 0, px: 0.5 }}
                              />
                            )}
                            {dataset.hasTime && (
                              <Chip
                                label="TIME"
                                size="small"
                                className="bg-violet-100 text-violet-800 font-bold"
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
                      borderRadius: '12px',
                      '& .MuiOutlinedInput-notchedOutline': { borderColor: 'var(--outline)' },
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
                <Box className="rounded-xl border border-[var(--outline)]/80 bg-[var(--surface)]/50 px-4 py-3 pb-4">
                  <Box className="mb-2 flex items-center justify-between gap-2">
                    <Typography variant="caption" className="font-semibold uppercase tracking-[0.12em] opacity-65 text-[10px]">
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
                <Box className="space-y-2 rounded-xl border border-[var(--outline)]/80 bg-[var(--surface)]/50 px-3 py-2">
                  <Autocomplete
                    multiple
                    size="small"
                    options={seriesNames}
                    value={plotSeriesSelection.filter((n) => seriesNames.includes(n))}
                    onChange={(_, value) => {
                      onPlotSeriesSelectionChange(value)
                    }}
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        label="Series on plot"
                        placeholder="Search series…"
                      />
                    )}
                  />
                  <Box className="flex items-center justify-between gap-2">
                    <Typography variant="caption" className="font-semibold opacity-80">
                      All series
                    </Typography>
                    <Switch
                      size="small"
                      checked={allSeriesSelected}
                      onChange={(_, checked) => {
                        if (checked) {
                          onPlotSeriesSelectionChange(seriesNames)
                        } else {
                          onPlotSeriesSelectionChange([])
                        }
                      }}
                    />
                  </Box>
                  <Typography variant="caption" className="opacity-60 block">
                    Off hides all lines; on includes every series. Use the field above for a subset.
                  </Typography>
                </Box>
              )}

              <Box className="rounded-xl border border-[var(--outline)]/80 bg-[var(--surface)]/50 p-3 text-xs space-y-0.5">
                <div>
                  Source: <span className="font-semibold">{getSourceLabel(currentDatasetSource)}</span>
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
                  if (!activeDs?.citation) return null
                  return (
                    <div className="pt-1 opacity-70">
                      🎓 Cite as{' '}
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
                <Box className="rounded-xl border border-[var(--outline)]/80 bg-[var(--surface)]/55 p-3">
                  <Typography variant="caption" className="mb-2 block font-semibold uppercase tracking-[0.12em] opacity-65 text-[10px]">
                    Map Rendering
                  </Typography>
                  <Box className="mt-2 flex items-center justify-between rounded-lg bg-[var(--surface)]/60 px-2 py-1">
                    <Box className="flex items-center gap-1">
                      <Typography variant="caption" className="font-semibold opacity-80">
                        Region shading
                      </Typography>
                      <Tooltip title="Shades regions by value for the selected metric and year.">
                        <InfoOutlinedIcon sx={{ fontSize: 14, color: 'var(--on-surface-variant)' }} />
                      </Tooltip>
                    </Box>
                    <Switch
                      size="small"
                      checked={showChoropleth}
                      onChange={(_, checked) => onToggleChoropleth(checked)}
                      inputProps={{ 'aria-label': 'Region shading' }}
                    />
                  </Box>

                  <Box className="mt-2 flex items-center justify-between rounded-lg bg-[var(--surface)]/60 px-2 py-1">
                    <Typography variant="caption" className="font-semibold opacity-80">
                      Show centroid points
                    </Typography>
                    <Switch size="small" checked={showCentroids} onChange={(_, checked) => onToggleCentroids(checked)} />
                  </Box>

                  <Box className="mt-3">
                    <Box className="mb-1 flex items-center justify-between text-[10px] font-semibold uppercase tracking-[0.12em] opacity-65">
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
                      <Typography variant="caption" className="mb-1.5 block font-semibold uppercase tracking-[0.12em] opacity-65 text-[10px]">
                        Metric Layers
                      </Typography>
                      <Box className="flex flex-wrap gap-1.5">
                        {availableMetrics.map((metric) => (
                          <Chip
                            key={metric}
                            label={metric}
                            size="small"
                            variant={selectedMetric === metric ? 'filled' : 'outlined'}
                            color={selectedMetric === metric ? 'primary' : 'default'}
                            onClick={() => onMetricChange(metric)}
                            sx={{ fontSize: '0.7rem', fontWeight: 600, borderRadius: '10px', cursor: 'pointer' }}
                          />
                        ))}
                      </Box>
                    </Box>
                  )}
                </Box>
              )}

              <Button variant="outlined" fullWidth onClick={onViewRawData}>
                View Raw Table
              </Button>
            </Box>

            <Divider className="border-[var(--outline)]/80" />

            {loading ? (
              <Box className="space-y-3">
                <Skeleton variant="rectangular" height={88} className="rounded-2xl" />
                <Box className="grid grid-cols-2 gap-3">
                  <Skeleton variant="rectangular" height={80} className="rounded-2xl" />
                  <Skeleton variant="rectangular" height={80} className="rounded-2xl" />
                </Box>
                <Skeleton variant="rectangular" height={110} className="rounded-2xl" />
              </Box>
            ) : stats ? (
              <Box className="space-y-4">
                {maxItem && (
                  <Card className="shadow-none border border-sky-200 rounded-2xl bg-sky-50/70 transition-all duration-300 hover:scale-[1.02] hover:bg-sky-50/90 cursor-default">
                    <CardContent className="p-4">
                      <Typography variant="caption" className="font-semibold uppercase tracking-[0.12em] text-[10px] text-sky-700 mb-2 block">
                        {currentDatasetLevel === 'province' ? 'Province with highest value' : currentDatasetLevel === 'district' ? 'District with highest value' : 'Top Entry'}
                      </Typography>
                      <Box className="flex items-center justify-between gap-2">
                        <Typography variant="body1" className="font-bold">
                          {currentDatasetLevel === 'province' ? (maxItem.originalName || maxItem.name) : maxItem.name}
                        </Typography>
                        <Chip
                          label={(
                            <AnimatedMetricText
                              value={maxItem.value}
                              unit={currentDatasetUnit}
                              playbackActive={mapPlaybackActive}
                              durationMs={mapPlaybackFrameMs}
                            />
                          )}
                          size="small"
                          className="bg-sky-100 text-sky-800 font-bold"
                          sx={{ borderRadius: '8px' }}
                        />
                      </Box>
                    </CardContent>
                  </Card>
                )}

                <Box className="grid grid-cols-2 gap-3">
                  <Card className="shadow-none border border-[var(--outline)] rounded-2xl bg-[var(--surface)]/70 transition-all duration-300 hover:scale-[1.02] hover:bg-[var(--surface)]/85 cursor-default">
                    <CardContent className="p-4">
                      <Typography variant="caption" className="font-semibold uppercase tracking-[0.12em] text-[10px] opacity-65 mb-1 block">
                        Maximum
                      </Typography>
                      <Typography variant="h6" className="font-bold">
                        <AnimatedMetricText
                          value={stats.max}
                          unit={currentDatasetUnit}
                          playbackActive={mapPlaybackActive}
                          durationMs={mapPlaybackFrameMs}
                        />
                      </Typography>
                    </CardContent>
                  </Card>
                  <Card className="shadow-none border border-[var(--outline)] rounded-2xl bg-[var(--surface)]/70 transition-all duration-300 hover:scale-[1.02] hover:bg-[var(--surface)]/85 cursor-default">
                    <CardContent className="p-4">
                      <Typography variant="caption" className="font-semibold uppercase tracking-[0.12em] text-[10px] opacity-65 mb-1 block">
                        Average
                      </Typography>
                      <Typography variant="h6" className="font-bold">
                        <AnimatedMetricText
                          value={stats.avg}
                          unit={currentDatasetUnit}
                          playbackActive={mapPlaybackActive}
                          durationMs={mapPlaybackFrameMs}
                        />
                      </Typography>
                    </CardContent>
                  </Card>
                </Box>

                <Card className="shadow-none border border-[var(--outline)] rounded-2xl bg-[var(--surface-variant)]/45 transition-all duration-300 hover:scale-[1.02] hover:bg-[var(--surface-variant)]/60 cursor-default">
                  <CardContent className="p-4">
                    <Typography variant="caption" className="font-semibold uppercase tracking-[0.12em] text-[10px] opacity-65 mb-1 block">
                      {totalAggregateLabel}
                    </Typography>
                    <Typography variant="h4" className="font-bold tracking-tight text-primary">
                      <AnimatedMetricText
                        value={stats.total}
                        unit={currentDatasetUnit}
                        playbackActive={mapPlaybackActive}
                        durationMs={mapPlaybackFrameMs}
                      />
                    </Typography>
                  </CardContent>
                </Card>

                <Box className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-[0.1em] opacity-60 pt-2">
                  <span>{stats.count} entries</span>
                  <span>
                    Range:{' '}
                    <AnimatedMetricText
                      value={stats.min}
                      unit={currentDatasetUnit}
                      playbackActive={mapPlaybackActive}
                      durationMs={mapPlaybackFrameMs}
                    />
                    {' — '}
                    <AnimatedMetricText
                      value={stats.max}
                      unit={currentDatasetUnit}
                      playbackActive={mapPlaybackActive}
                      durationMs={mapPlaybackFrameMs}
                    />
                  </span>
                </Box>
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
                <Divider className="border-[var(--outline)]/80 mb-4" />
                <Card className="shadow-[0_6px_20px_rgba(47,143,205,0.16)] border border-sky-200 rounded-2xl relative overflow-hidden">
                  <Box className="absolute left-0 top-0 bottom-0 w-1.5 bg-primary" />
                  <CardContent className="p-4 pl-5">
                    <Typography variant="caption" className="text-primary font-semibold uppercase tracking-[0.12em] text-[10px] mb-1 block">
                      Selected District
                    </Typography>
                    <Typography variant="h6" className="font-bold">
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

          <Box className="border-t border-[var(--outline)]/80 bg-[var(--surface-variant)]/55 p-4">
            <Box className="mb-2 flex items-center justify-between">
              <Typography variant="caption" className="font-semibold uppercase tracking-[0.12em] text-[10px] opacity-65">
                Dark Mode
              </Typography>
              <Switch checked={darkMode} onChange={onToggleDarkMode} size="small" />
            </Box>

            <Box className="mb-3 overflow-hidden rounded-xl border border-[var(--outline)]/70">
              <ButtonBase
                type="button"
                className="flex w-full items-center justify-between px-2.5 py-2 text-left"
                onClick={() => setThemeSectionOpen((open) => !open)}
                aria-expanded={themeSectionOpen}
                sx={{ color: 'var(--on-surface)' }}
              >
                <Typography variant="caption" className="font-semibold uppercase tracking-[0.12em] text-[10px] opacity-80">
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
                <Box className="space-y-3 border-t border-[var(--outline)]/60 px-2.5 pb-3 pt-2">
                  <Box>
                    <Typography variant="caption" className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.12em] opacity-65">
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
                          className="h-7 w-7 shrink-0 rounded-full border-2 border-transparent transition-shadow focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface-variant)]"
                          style={{
                            backgroundColor: preset.main,
                            boxShadow:
                              accentPresetId === preset.id && accentTone === 'main'
                                ? '0 0 0 2px var(--primary), 0 0 0 4px var(--surface-variant)'
                                : undefined,
                          }}
                        />
                      ))}
                    </Box>
                    <Typography variant="caption" className="mb-1.5 mt-2 block text-[10px] font-semibold uppercase tracking-[0.12em] opacity-65">
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
                          className="h-7 w-7 shrink-0 rounded-full border-2 border-[var(--outline)]/60 transition-shadow focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface-variant)]"
                          style={{
                            backgroundColor: preset.soft,
                            boxShadow:
                              accentPresetId === preset.id && accentTone === 'soft'
                                ? '0 0 0 2px var(--primary), 0 0 0 4px var(--surface-variant)'
                                : undefined,
                          }}
                        />
                      ))}
                    </Box>
                  </Box>
                  <Box>
                    <Typography variant="caption" className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.12em] opacity-65">
                      Region shading ramp
                    </Typography>
                    <Box className="flex flex-wrap gap-1.5">
                      {GRADIENT_PRESETS.map((preset) => (
                        <button
                          key={preset.id}
                          type="button"
                          title={preset.label}
                          onClick={() => setGradientPresetId(preset.id)}
                          className="h-6 w-[4.25rem] shrink-0 overflow-hidden rounded-md border-2 transition-shadow focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface-variant)]"
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
                className="min-w-0 flex-1 leading-snug opacity-60 font-semibold text-[10px] uppercase tracking-[0.08em]"
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
                  borderRadius: '10px',
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
