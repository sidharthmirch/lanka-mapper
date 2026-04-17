'use client'

import { motion, AnimatePresence } from 'framer-motion'
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
} from '@mui/material'
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft'
import { DATASET_MANIFEST } from '@/services/dataService'
import type { MapData } from '@/types'

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
  onDatasetChange: (dataset: string) => void
  onMetricChange: (metric: string) => void
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
  onDatasetChange,
  onMetricChange,
}: SidebarProps) {
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
          initial={{ x: 320, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 320, opacity: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 200 }}
          className="fixed right-0 top-0 h-full w-full sm:w-80 bg-white/95 backdrop-blur-xl shadow-[-8px_0_32px_rgba(0,0,0,0.08)] z-[1000] flex flex-col border-l border-white/40"
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
              <FormControl fullWidth size="small" variant="outlined">
                <InputLabel className="bg-white px-1">Dataset</InputLabel>
                <Select
                  value={currentDataset || ''}
                  label="Dataset"
                  onChange={(e) => onDatasetChange(e.target.value)}
                  className="rounded-xl bg-white/50"
                  sx={{ '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(0,0,0,0.1)' } }}
                >
                  {DATASET_MANIFEST.map(dataset => (
                    <MenuItem key={dataset.id} value={dataset.id} className="rounded-lg mx-1 my-0.5">
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, width: '100%', justifyContent: 'space-between' }}>
                        <Typography variant="body2" className="font-medium">{dataset.name}</Typography>
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
                        {currentDatasetLevel === 'province' ? 'Highest Region' : 'Highest District'}
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
            <Typography variant="caption" className="text-gray-400 font-medium block text-center text-[10px] uppercase tracking-wider">
              Data from Lanka Data Foundation
            </Typography>
          </Box>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
