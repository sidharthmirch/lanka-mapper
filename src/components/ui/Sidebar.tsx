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
import { DATASET_MANIFEST } from '@/services/dataService'
import type { AppTab, ColorScale, MapData, VisualizationMode } from '@/types'

interface SidebarProps {
  open: boolean
  onClose: () => void
  currentDataset: string | null
  data: MapData[] | null
  loading: boolean
  selectedDistrict: string | null
  selectedMetric: string | null
  availableMetrics: string[]
  currentDatasetLevel: 'district' | 'province' | null
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
  onDatasetChange: (dataset: string) => void
  onMetricChange: (metric: string) => void
  onYearChange: (year: number) => void
  onToggleDarkMode: () => void
  onVisualizationModeChange: (mode: VisualizationMode) => void
  onToggleChoropleth: (show: boolean) => void
  onToggleCentroids: (show: boolean) => void
  onViewRawData: () => void
}

const formatValue = (val: number) => {
  if (val >= 1000000) return `${(val / 1000000).toFixed(1)}M`
  if (val >= 1000) return `${(val / 1000).toFixed(1)}K`
  return val.toLocaleString()
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
    () =>
      new Fuse(DATASET_MANIFEST, {
        keys: ['name', 'description', 'level', 'metrics'],
        threshold: 0.35,
      }),
    [],
  )

  const filteredDatasets = useMemo(() => {
    const results = datasetQuery.trim()
      ? fuse.search(datasetQuery).map((result) => result.item)
      : DATASET_MANIFEST

    if (currentDataset && !results.some((dataset) => dataset.id === currentDataset)) {
      const active = DATASET_MANIFEST.find((dataset) => dataset.id === currentDataset)
      if (active) {
        return [active, ...results]
      }
    }
    return results
  }, [currentDataset, datasetQuery, fuse])

  const sortedYears = useMemo(() => [...years].sort((a, b) => a - b), [years])
  const sliderMarks = useMemo(() => {
    const labelledYears = new Set<number>()
    if (sortedYears.length <= 8) {
      sortedYears.forEach((year) => labelledYears.add(year))
    } else if (sortedYears.length > 0) {
      labelledYears.add(sortedYears[0])
      labelledYears.add(sortedYears[sortedYears.length - 1])
      const step = Math.max(1, Math.floor(sortedYears.length / 5))
      for (let i = step; i < sortedYears.length - 1; i += step) {
        labelledYears.add(sortedYears[i])
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
  
  const stats = statsData && statsData.length > 0 ? {
    total: statsData.reduce((sum, d) => sum + d.value, 0),
    max: Math.max(...statsData.map(d => d.value)),
    min: Math.min(...statsData.map(d => d.value)),
    avg: statsData.reduce((sum, d) => sum + d.value, 0) / statsData.length,
    count: statsData.length,
  } : null
  
  const maxItem = statsData && statsData.length > 0 
    ? statsData.reduce((max, d) => d.value > max.value ? d : max, statsData[0])
    : null

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ x: 24, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 24, opacity: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 200 }}
          className="relative z-[900] h-full w-full sm:w-80 flex flex-col shadow-[-8px_0_32px_rgba(0,0,0,0.08)] backdrop-blur-xl"
          style={{
            borderLeftColor: 'var(--outline)',
            background: 'color-mix(in srgb, var(--surface) 94%, transparent)',
            color: 'var(--on-surface)',
          }}
        >
          <Box className="flex items-center justify-between p-5 border-b border-gray-100">
            <Typography variant="h6" className="font-bold text-gray-900 tracking-tight">
              Data Explorer
            </Typography>
            <IconButton onClick={onClose} size="small" className="bg-gray-50 hover:bg-gray-100 transition-colors">
              <ChevronLeftIcon />
            </IconButton>
          </Box>

          <Box className="flex-1 overflow-y-auto p-5 space-y-6">
            <Box className="space-y-4">
              <TextField
                size="small"
                placeholder="Search datasets"
                value={datasetQuery}
                onChange={(event) => setDatasetQuery(event.target.value)}
                fullWidth
              />
              <FormControl fullWidth size="small" variant="outlined">
                <InputLabel className="bg-white px-1">Dataset</InputLabel>
                <Select
                  value={currentDataset || ''}
                  label="Dataset"
                  onChange={(e) => onDatasetChange(e.target.value)}
                  className="rounded-xl bg-white/50"
                  sx={{ '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(0,0,0,0.1)' } }}
                >
                  {filteredDatasets.map(dataset => (
                    <MenuItem key={dataset.id} value={dataset.id} className="rounded-lg mx-1 my-0.5">
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, width: '100%', justifyContent: 'space-between' }}>
                        <Box>
                          <Typography variant="body2" className="font-medium">{dataset.name}</Typography>
                          <Typography variant="caption" className="text-gray-500">
                            {dataset.source === 'ldflk' ? 'LDFLK' : 'nuuuwan / CBSL'} - {dataset.years[0]} to {dataset.years[dataset.years.length - 1]}
                          </Typography>
                        </Box>
                        <Chip
                          label={dataset.level === 'district' ? 'District' : 'Province'}
                          size="small" 
                          className={dataset.level === 'district' ? 'bg-blue-50 text-blue-700 font-medium' : 'bg-purple-50 text-purple-700 font-medium'}
                          sx={{ height: 20, fontSize: '0.65rem', borderRadius: '6px' }}
                        />
                      </Box>
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              {availableMetrics.length > 1 && (
                <FormControl fullWidth size="small" variant="outlined">
                  <InputLabel className="bg-white px-1">Metric</InputLabel>
                  <Select
                    value={selectedMetric || ''}
                    label="Metric"
                    onChange={(e) => onMetricChange(e.target.value)}
                    className="rounded-xl bg-white/50"
                    sx={{ '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(0,0,0,0.1)' } }}
                  >
                    {availableMetrics.map(metric => (
                      <MenuItem key={metric} value={metric} className="rounded-lg mx-1 my-0.5">
                        <Typography variant="body2" className="font-medium">{metric}</Typography>
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              )}

              {years.length > 1 && (
                <Box className="rounded-xl border border-gray-100 bg-white/70 px-3 py-2">
                  <Box className="mb-1 flex items-center justify-between">
                    <Typography variant="caption" className="font-semibold uppercase tracking-wider text-gray-500">Year</Typography>
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

              <Box className="text-xs text-gray-500">
                Source: <span className="font-semibold text-gray-700">{currentDatasetSource === 'ldflk' ? 'Lanka Data Foundation (LDFLK)' : currentDatasetSource === 'nuuuwan' ? 'nuuuwan / CBSL' : 'N/A'}</span>
                <br />
                Department: <span className="font-semibold text-gray-700">{currentDatasetSecondarySource || 'N/A'}</span>
                <br />
                Unit: <span className="font-semibold text-gray-700">{currentDatasetUnit ?? 'N/A'}</span>
              </Box>

              {currentTab === 'map' && (
                <Box className="rounded-xl border border-gray-100 bg-white/70 p-3">
                  <Typography variant="caption" className="mb-2 block font-semibold uppercase tracking-wider text-gray-500">
                    Map rendering
                  </Typography>
                  <Box className="mt-2 flex items-center justify-between rounded-lg bg-white/80 px-2 py-1">
                    <Box className="flex items-center gap-1">
                      <Typography variant="caption" className="font-medium text-gray-600">
                        Choropleth layer
                      </Typography>
                      <Tooltip title="Choropleth shades districts using selected metric and year values.">
                        <InfoOutlinedIcon sx={{ fontSize: 14, color: 'var(--on-surface-variant)' }} />
                      </Tooltip>
                    </Box>
                    <Switch
                      size="small"
                      checked={showChoropleth}
                      onChange={(_, checked) => onToggleChoropleth(checked)}
                    />
                  </Box>
                  <Box className="mt-2 flex items-center justify-between rounded-lg bg-white/80 px-2 py-1">
                    <Typography variant="caption" className="font-medium text-gray-600">
                      Heatmap layer
                    </Typography>
                    <Switch
                      size="small"
                      checked={visualizationMode === 'heatmap'}
                      onChange={(_, checked) => onVisualizationModeChange(checked ? 'heatmap' : 'choropleth')}
                    />
                  </Box>
                  <Box className="mt-2 flex items-center justify-between rounded-lg bg-white/80 px-2 py-1">
                    <Typography variant="caption" className="font-medium text-gray-600">
                      Show centroid points
                    </Typography>
                    <Switch size="small" checked={showCentroids} onChange={(_, checked) => onToggleCentroids(checked)} />
                  </Box>
                  <Box className="mt-3">
                    <Box className="mb-1 flex items-center justify-between text-[10px] font-semibold uppercase tracking-wider text-gray-500">
                      <span>{Math.round(colorScale.min).toLocaleString()}</span>
                      <span>{Math.round(colorScale.max).toLocaleString()}</span>
                    </Box>
                    <Box
                      className="h-2 w-full rounded-full"
                      style={{
                        background: `linear-gradient(90deg, ${colorScale.colors.join(', ')})`,
                      }}
                    />
                  </Box>
                  <Typography variant="caption" className="mt-2 block text-orange-600">
                    Heatmap using infrared scale by dataset value intensity.
                  </Typography>
                </Box>
              )}

              <Button variant="outlined" fullWidth onClick={onViewRawData}>
                View Raw Data
              </Button>
            </Box>

            <Divider className="border-gray-100" />

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
                <Card className="shadow-none border border-gray-100 rounded-2xl bg-gradient-to-br from-blue-50/50 to-transparent">
                  <CardContent className="p-4">
                    <Typography variant="caption" className="text-gray-500 font-medium uppercase tracking-wider text-[10px] mb-1 block">
                      Total Value
                    </Typography>
                    <Typography variant="h4" className="font-bold text-primary tracking-tight">
                      {formatValue(stats.total)}
                    </Typography>
                  </CardContent>
                </Card>

                <Box className="grid grid-cols-2 gap-3">
                  <Card className="shadow-none border border-gray-100 rounded-2xl bg-white">
                    <CardContent className="p-4">
                      <Typography variant="caption" className="text-gray-500 font-medium uppercase tracking-wider text-[10px] mb-1 block">
                        Maximum
                      </Typography>
                      <Typography variant="h6" className="font-bold text-gray-800">
                        {formatValue(stats.max)}
                      </Typography>
                    </CardContent>
                  </Card>
                  <Card className="shadow-none border border-gray-100 rounded-2xl bg-white">
                    <CardContent className="p-4">
                      <Typography variant="caption" className="text-gray-500 font-medium uppercase tracking-wider text-[10px] mb-1 block">
                        Average
                      </Typography>
                      <Typography variant="h6" className="font-bold text-gray-800">
                        {formatValue(Math.round(stats.avg))}
                      </Typography>
                    </CardContent>
                  </Card>
                </Box>

                {maxItem && (
                  <Card className="shadow-none border border-blue-100 rounded-2xl bg-blue-50/30">
                    <CardContent className="p-4">
                      <Typography variant="caption" className="text-blue-600/80 font-medium uppercase tracking-wider text-[10px] mb-2 block">
                        {currentDatasetLevel === 'province' ? 'Highest Province' : 'Highest District'}
                      </Typography>
                      <Box className="flex items-center justify-between">
                        <Typography variant="body1" className="font-bold text-gray-900">
                          {currentDatasetLevel === 'province' ? (maxItem.originalName || maxItem.name) : maxItem.name}
                        </Typography>
                        <Chip 
                          label={formatValue(maxItem.value)} 
                          size="small" 
                          className="bg-blue-100 text-blue-800 font-bold"
                          sx={{ borderRadius: '8px' }}
                        />
                      </Box>
                    </CardContent>
                  </Card>
                )}

                <Box className="flex items-center justify-between text-[11px] font-medium text-gray-400 uppercase tracking-wider pt-2">
                  <span>{stats.count} {currentDatasetLevel === 'province' ? 'provinces' : 'districts'}</span>
                  <span>Range: {formatValue(stats.min)} - {formatValue(stats.max)}</span>
                </Box>
              </Box>
            ) : (
              <Box className="text-center py-12 text-gray-400">
                <Typography variant="body2" className="font-medium">
                  Select a dataset to view statistics
                </Typography>
              </Box>
            )}

            {selectedDistrict && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                <Divider className="border-gray-100 mb-4" />
                <Card className="shadow-[0_4px_20px_rgba(25,118,210,0.08)] border border-blue-100 rounded-2xl relative overflow-hidden">
                  <Box className="absolute left-0 top-0 bottom-0 w-1.5 bg-primary" />
                  <CardContent className="p-4 pl-5">
                    <Typography variant="caption" className="text-primary font-medium uppercase tracking-wider text-[10px] mb-1 block">
                      Selected District
                    </Typography>
                    <Typography variant="h6" className="font-bold text-gray-900">
                      {selectedDistrict}
                    </Typography>
                    {data && (
                      <Typography variant="body2" className="text-gray-600 mt-1 font-medium">
                        Value: <span className="text-gray-900 font-bold">{formatValue(
                          data.find(d => 
                            d.name?.toLowerCase() === selectedDistrict.toLowerCase()
                          )?.value || 0
                        )}</span>
                      </Typography>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </Box>

          <Box className="p-4 border-t border-gray-100 bg-gray-50/50">
            <Box className="mb-2 flex items-center justify-between">
              <Typography variant="caption" className="text-gray-500 font-medium text-[10px] uppercase tracking-wider">
                Dark mode
              </Typography>
              <Switch checked={darkMode} onChange={onToggleDarkMode} size="small" />
            </Box>
            <Typography variant="caption" className="text-gray-400 font-medium block text-center text-[10px] uppercase tracking-wider">
              Data from Lanka Data Foundation and nuuuwan / CBSL
            </Typography>
          </Box>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
