'use client'

import { useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Fuse from 'fuse.js'
import {
  Box,
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
} from '@mui/material'
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft'
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined'
import type { AppTab, ColorScale, DatasetManifestEntry, MapData, VisualizationMode } from '@/types'

interface SidebarProps {
  open: boolean
  onClose: () => void
  currentDataset: string | null
  data: MapData[] | null
  loading: boolean
  selectedDistrict: string | null
  selectedMetric: string | null
  availableMetrics: string[]
  currentDatasetLevel: 'district' | 'province' | 'national' | null
  currentYear: number
  years: number[]
  currentDatasetSource: 'ldflk' | 'nuuuwan' | null
  currentDatasetSecondarySource: string | null
  currentDatasetUnit: string | null
  darkMode: boolean
  currentTab: AppTab
  visualizationMode: VisualizationMode
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
  onDatasetChange: (dataset: string) => void
  onMetricChange: (metric: string) => void
  onYearChange: (year: number) => void
  onToggleDarkMode: () => void
  onVisualizationModeChange: (mode: VisualizationMode) => void
  onToggleChoropleth: (show: boolean) => void
  onToggleCentroids: (show: boolean) => void
  onViewRawData: () => void
}

const formatValue = (value: number) => {
  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`
  if (value >= 1000) return `${(value / 1000).toFixed(1)}K`
  return value.toLocaleString()
}

const MAX_DEFAULT_DATASET_OPTIONS = 180
const MAX_SEARCH_DATASET_OPTIONS = 280

function getSourceLabel(source: 'ldflk' | 'nuuuwan' | null): string {
  if (source === 'ldflk') return 'Lanka Data Foundation (LDFLK)'
  if (source === 'nuuuwan') return 'nuuuwan'
  return 'N/A'
}

function getLevelChipStyles(level: 'district' | 'province' | 'national') {
  if (level === 'district') return { label: 'District', className: 'bg-sky-100 text-sky-800' }
  if (level === 'province') return { label: 'Province', className: 'bg-amber-100 text-amber-800' }
  return { label: 'National', className: 'bg-slate-200 text-slate-700' }
}

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
  currentYear,
  years,
  currentDatasetSource,
  currentDatasetSecondarySource,
  currentDatasetUnit,
  darkMode,
  currentTab,
  visualizationMode,
  showChoropleth,
  showCentroids,
  colorScale,
  datasetManifest,
  totalDatasets,
  catalogCounts,
  lastCatalogSyncLabel,
  onDatasetChange,
  onMetricChange,
  onYearChange,
  onToggleDarkMode,
  onVisualizationModeChange,
  onToggleChoropleth,
  onToggleCentroids,
  onViewRawData,
}: SidebarProps) {
  const [datasetQuery, setDatasetQuery] = useState('')

  const fuse = useMemo(
    () => new Fuse(datasetManifest, {
      keys: ['name', 'description', 'path', 'tags'],
      threshold: 0.3,
      ignoreLocation: true,
    }),
    [datasetManifest],
  )

  const filteredDatasets = useMemo(() => {
    const trimmed = datasetQuery.trim()
    const maxResults = trimmed ? MAX_SEARCH_DATASET_OPTIONS : MAX_DEFAULT_DATASET_OPTIONS

    const results = trimmed
      ? fuse.search(trimmed).map((result) => result.item)
      : datasetManifest

    const active = currentDataset ? datasetManifest.find((dataset) => dataset.id === currentDataset) : null
    const deduped = active
      ? [active, ...results.filter((dataset) => dataset.id !== active.id)]
      : results

    return deduped.slice(0, maxResults)
  }, [currentDataset, datasetManifest, datasetQuery, fuse])

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

  const statsData = currentDatasetLevel === 'province' && data
    ? Array.from(new Map(data.map((item) => [item.originalName || item.name, item])).values())
    : data

  const stats = statsData && statsData.length > 0
    ? {
      total: statsData.reduce((sum, item) => sum + item.value, 0),
      max: Math.max(...statsData.map((item) => item.value)),
      min: Math.min(...statsData.map((item) => item.value)),
      avg: statsData.reduce((sum, item) => sum + item.value, 0) / statsData.length,
      count: statsData.length,
    }
    : null

  const maxItem = statsData && statsData.length > 0
    ? statsData.reduce((max, item) => (item.value > max.value ? item : max), statsData[0])
    : null

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ x: 20, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 20, opacity: 0 }}
          transition={{ type: 'spring', damping: 24, stiffness: 200 }}
          className="relative z-[900] h-full w-full sm:w-[380px] flex flex-col rounded-[20px] border border-[var(--outline)] bg-[var(--surface)]/88 shadow-[0_20px_36px_rgba(0,0,0,0.14)] backdrop-blur-xl"
          style={{ color: 'var(--on-surface)' }}
        >
          <Box className="flex items-center justify-between p-5 border-b border-[var(--outline)]/80">
            <Box>
              <Typography variant="h6" className="font-semibold tracking-tight">
                Data Explorer
              </Typography>
              <Typography variant="caption" className="opacity-70">
                {totalDatasets.toLocaleString()} datasets live · Synced {lastCatalogSyncLabel}
              </Typography>
            </Box>
            <IconButton onClick={onClose} size="small" className="bg-[var(--surface-variant)]/70 hover:bg-[var(--surface-variant)]">
              <ChevronLeftIcon />
            </IconButton>
          </Box>

          <Box className="flex-1 overflow-y-auto p-5 space-y-6">
            <Box className="rounded-2xl border border-[var(--outline)]/80 bg-[var(--surface-variant)]/45 p-3">
              <Typography variant="caption" className="font-semibold uppercase tracking-[0.12em] opacity-65 text-[10px]">
                Source Breakdown
              </Typography>
              <Box className="mt-2 flex items-center gap-2 flex-wrap">
                <Chip label={`LDFLK ${catalogCounts.ldflk}`} size="small" className="bg-sky-100 text-sky-800 font-semibold" />
                <Chip label={`nuuuwan ${catalogCounts.nuuuwan}`} size="small" className="bg-amber-100 text-amber-800 font-semibold" />
              </Box>
            </Box>

            <Box className="space-y-3">
              <TextField
                size="small"
                placeholder="Search 150+ datasets"
                value={datasetQuery}
                onChange={(event) => setDatasetQuery(event.target.value)}
                fullWidth
              />

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
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, width: '100%', justifyContent: 'space-between' }}>
                          <Box sx={{ minWidth: 0 }}>
                            <Typography variant="body2" className="font-semibold truncate">{dataset.name}</Typography>
                            <Typography variant="caption" className="opacity-65 truncate block">
                              {dataset.source === 'ldflk' ? 'LDFLK' : 'nuuuwan'} · {dataset.years[0]} to {dataset.years[dataset.years.length - 1]}
                            </Typography>
                          </Box>
                          <Chip
                            label={levelChip.label}
                            size="small"
                            className={`${levelChip.className} font-semibold`}
                            sx={{ height: 20, fontSize: '0.65rem', borderRadius: '8px' }}
                          />
                        </Box>
                      </MenuItem>
                    )
                  })}
                </Select>
              </FormControl>

              <Typography variant="caption" className="opacity-60">
                Showing {filteredDatasets.length.toLocaleString()} result(s). {datasetQuery.trim() ? 'Refine search to narrow further.' : 'Use search to browse the full catalog.'}
              </Typography>

              {availableMetrics.length > 1 && (
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

              {years.length > 1 && (
                <Box className="rounded-xl border border-[var(--outline)]/80 bg-[var(--surface)]/50 px-3 py-2">
                  <Box className="mb-1 flex items-center justify-between">
                    <Typography variant="caption" className="font-semibold uppercase tracking-[0.12em] opacity-65 text-[10px]">Year</Typography>
                    <Typography variant="body2" className="font-semibold text-primary">{currentYear}</Typography>
                  </Box>
                  <Slider
                    value={currentYear}
                    min={sortedYears[0]}
                    max={sortedYears[sortedYears.length - 1]}
                    marks={sliderMarks}
                    step={null}
                    onChange={(_, value) => {
                      if (typeof value === 'number') {
                        onYearChange(value)
                      }
                    }}
                  />
                </Box>
              )}

              <Box className="rounded-xl border border-[var(--outline)]/80 bg-[var(--surface)]/50 p-3 text-xs">
                <div>
                  Source: <span className="font-semibold">{getSourceLabel(currentDatasetSource)}</span>
                </div>
                <div>
                  Department: <span className="font-semibold">{currentDatasetSecondarySource || 'N/A'}</span>
                </div>
                <div>
                  Unit: <span className="font-semibold">{currentDatasetUnit ?? 'N/A'}</span>
                </div>
              </Box>

              {currentTab === 'map' && (
                <Box className="rounded-xl border border-[var(--outline)]/80 bg-[var(--surface)]/55 p-3">
                  <Typography variant="caption" className="mb-2 block font-semibold uppercase tracking-[0.12em] opacity-65 text-[10px]">
                    Map Rendering
                  </Typography>
                  <Box className="mt-2 flex items-center justify-between rounded-lg bg-[var(--surface)]/60 px-2 py-1">
                    <Box className="flex items-center gap-1">
                      <Typography variant="caption" className="font-semibold opacity-80">
                        Choropleth layer
                      </Typography>
                      <Tooltip title="Choropleth shades regions using selected metric and year values.">
                        <InfoOutlinedIcon sx={{ fontSize: 14, color: 'var(--on-surface-variant)' }} />
                      </Tooltip>
                    </Box>
                    <Switch
                      size="small"
                      checked={showChoropleth}
                      onChange={(_, checked) => onToggleChoropleth(checked)}
                    />
                  </Box>

                  <Box className="mt-2 flex items-center justify-between rounded-lg bg-[var(--surface)]/60 px-2 py-1">
                    <Typography variant="caption" className="font-semibold opacity-80">
                      Heatmap layer
                    </Typography>
                    <Switch
                      size="small"
                      checked={visualizationMode === 'heatmap'}
                      onChange={(_, checked) => onVisualizationModeChange(checked ? 'heatmap' : 'choropleth')}
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
                      <span>{Math.round(colorScale.min).toLocaleString()}</span>
                      <span>{Math.round(colorScale.max).toLocaleString()}</span>
                    </Box>
                    <Box
                      className="h-2 w-full rounded-full"
                      style={{ background: `linear-gradient(90deg, ${colorScale.colors.join(', ')})` }}
                    />
                  </Box>

                  {currentDatasetLevel === 'national' && (
                    <Typography variant="caption" className="mt-2 block text-amber-600">
                      This dataset is not geographic. Map overlays may appear sparse.
                    </Typography>
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
                <Skeleton variant="rectangular" height={110} className="rounded-2xl" />
                <Box className="grid grid-cols-2 gap-3">
                  <Skeleton variant="rectangular" height={80} className="rounded-2xl" />
                  <Skeleton variant="rectangular" height={80} className="rounded-2xl" />
                </Box>
              </Box>
            ) : stats ? (
              <Box className="space-y-4">
                <Card className="shadow-none border border-[var(--outline)] rounded-2xl bg-[var(--surface-variant)]/45">
                  <CardContent className="p-4">
                    <Typography variant="caption" className="font-semibold uppercase tracking-[0.12em] text-[10px] opacity-65 mb-1 block">
                      Total Value
                    </Typography>
                    <Typography variant="h4" className="font-bold tracking-tight text-primary">
                      {formatValue(stats.total)}
                    </Typography>
                  </CardContent>
                </Card>

                <Box className="grid grid-cols-2 gap-3">
                  <Card className="shadow-none border border-[var(--outline)] rounded-2xl bg-[var(--surface)]/70">
                    <CardContent className="p-4">
                      <Typography variant="caption" className="font-semibold uppercase tracking-[0.12em] text-[10px] opacity-65 mb-1 block">
                        Maximum
                      </Typography>
                      <Typography variant="h6" className="font-bold">
                        {formatValue(stats.max)}
                      </Typography>
                    </CardContent>
                  </Card>
                  <Card className="shadow-none border border-[var(--outline)] rounded-2xl bg-[var(--surface)]/70">
                    <CardContent className="p-4">
                      <Typography variant="caption" className="font-semibold uppercase tracking-[0.12em] text-[10px] opacity-65 mb-1 block">
                        Average
                      </Typography>
                      <Typography variant="h6" className="font-bold">
                        {formatValue(Math.round(stats.avg))}
                      </Typography>
                    </CardContent>
                  </Card>
                </Box>

                {maxItem && (
                  <Card className="shadow-none border border-sky-200 rounded-2xl bg-sky-50/70">
                    <CardContent className="p-4">
                      <Typography variant="caption" className="font-semibold uppercase tracking-[0.12em] text-[10px] text-sky-700 mb-2 block">
                        {currentDatasetLevel === 'province' ? 'Highest Province' : currentDatasetLevel === 'district' ? 'Highest District' : 'Top Entry'}
                      </Typography>
                      <Box className="flex items-center justify-between gap-2">
                        <Typography variant="body1" className="font-bold">
                          {currentDatasetLevel === 'province' ? (maxItem.originalName || maxItem.name) : maxItem.name}
                        </Typography>
                        <Chip
                          label={formatValue(maxItem.value)}
                          size="small"
                          className="bg-sky-100 text-sky-800 font-bold"
                          sx={{ borderRadius: '8px' }}
                        />
                      </Box>
                    </CardContent>
                  </Card>
                )}

                <Box className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-[0.1em] opacity-60 pt-2">
                  <span>{stats.count} entries</span>
                  <span>Range: {formatValue(stats.min)} - {formatValue(stats.max)}</span>
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
                        Value: <span className="font-bold">{formatValue(
                          data.find((item) => item.name?.toLowerCase() === selectedDistrict.toLowerCase())?.value || 0,
                        )}</span>
                      </Typography>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </Box>

          <Box className="p-4 border-t border-[var(--outline)]/80 bg-[var(--surface-variant)]/55">
            <Box className="mb-2 flex items-center justify-between">
              <Typography variant="caption" className="font-semibold uppercase tracking-[0.12em] text-[10px] opacity-65">
                Dark Mode
              </Typography>
              <Switch checked={darkMode} onChange={onToggleDarkMode} size="small" />
            </Box>
            <Typography variant="caption" className="opacity-60 font-semibold block text-center text-[10px] uppercase tracking-[0.1em]">
              Live feed from LDFLK + nuuuwan
            </Typography>
          </Box>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
