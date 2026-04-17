'use client'

import { motion } from 'framer-motion'
import { Box, Slider, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material'
import MapIcon from '@mui/icons-material/Map'
import WhatshotIcon from '@mui/icons-material/Whatshot'
import LocationOnIcon from '@mui/icons-material/LocationOn'
import type { VisualizationMode } from '@/types'

interface MapToolbarProps {
  currentYear: number
  years: number[]
  visualizationMode: VisualizationMode
  onYearChange: (year: number) => void
  onVisualizationModeChange: (mode: VisualizationMode) => void
}

export default function MapToolbar({
  currentYear,
  years,
  visualizationMode,
  onYearChange,
  onVisualizationModeChange,
}: MapToolbarProps) {
  const sortedYears = [...years].sort((a, b) => a - b)
  const hasMultipleYears = sortedYears.length > 1

  const labelledYearSet = new Set<number>()
  if (sortedYears.length <= 8) {
    sortedYears.forEach((y) => labelledYearSet.add(y))
  } else {
    labelledYearSet.add(sortedYears[0])
    labelledYearSet.add(sortedYears[sortedYears.length - 1])
    const step = Math.max(1, Math.floor(sortedYears.length / 5))
    for (let i = step; i < sortedYears.length - 1; i += step) {
      labelledYearSet.add(sortedYears[i])
    }
  }

  const sliderMarks = sortedYears.map((year) => ({
    value: year,
    label: labelledYearSet.has(year) ? `${year}` : undefined,
  }))

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: 'easeOut', delay: 0.15 }}
      className="fixed bottom-6 left-1/2 z-[900] w-[min(calc(100vw-7rem),32rem)] -translate-x-1/2 px-2"
    >
      <Box className="pointer-events-auto flex items-center gap-4 rounded-3xl border border-white/40 bg-white/70 px-5 py-3 shadow-[0_8px_32px_rgba(0,0,0,0.08)] backdrop-blur-xl transition-all hover:bg-white/80 hover:shadow-[0_8px_32px_rgba(0,0,0,0.12)]">
        <ToggleButtonGroup
          value={visualizationMode}
          exclusive
          size="small"
          onChange={(_, mode: VisualizationMode | null) => {
            if (mode) {
              onVisualizationModeChange(mode)
            }
          }}
          aria-label="Visualization mode"
          className="shrink-0 bg-white/50 p-1 rounded-2xl shadow-inner"
          sx={{
            '& .MuiToggleButton-root': {
              border: 'none',
              borderRadius: '12px !important',
              margin: '0 2px',
              padding: '6px 12px',
              color: 'var(--on-surface-variant)',
              transition: 'all 0.2s ease',
              '&.Mui-selected': {
                backgroundColor: 'var(--primary)',
                color: 'white',
                boxShadow: '0 2px 8px rgba(25, 118, 210, 0.4)',
                '&:hover': {
                  backgroundColor: 'var(--primary-dark)',
                }
              },
              '&:hover:not(.Mui-selected)': {
                backgroundColor: 'rgba(25, 118, 210, 0.08)',
                color: 'var(--primary)',
              }
            }
          }}
        >
          <ToggleButton value="choropleth" aria-label="Choropleth view">
            <MapIcon fontSize="small" />
          </ToggleButton>
          <ToggleButton value="heatmap" aria-label="Heatmap view">
            <WhatshotIcon fontSize="small" />
          </ToggleButton>
          <ToggleButton value="points" aria-label="Points view">
            <LocationOnIcon fontSize="small" />
          </ToggleButton>
        </ToggleButtonGroup>

        {hasMultipleYears && (
          <Box className="min-w-0 flex-1 px-2">
            <Box className="mb-1 flex items-center justify-between gap-2">
              <Typography variant="caption" className="font-medium text-gray-500 uppercase tracking-wider text-[10px]">
                Year
              </Typography>
              <Typography variant="body2" className="font-bold text-primary">
                {currentYear}
              </Typography>
            </Box>
            <Slider
              value={currentYear}
              min={sortedYears[0]}
              max={sortedYears[sortedYears.length - 1]}
              marks={sliderMarks}
              step={null}
              size="small"
              onChange={(_, value) => {
                if (typeof value === 'number') {
                  onYearChange(value)
                }
              }}
              aria-label="Dataset year"
              sx={{
                color: 'var(--primary)',
                height: 6,
                padding: '8px 0',
                '& .MuiSlider-thumb': {
                  height: 16,
                  width: 16,
                  backgroundColor: '#fff',
                  border: '2px solid currentColor',
                  boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
                  '&:focus, &:hover, &.Mui-active, &.Mui-focusVisible': {
                    boxShadow: '0 0 0 6px rgba(25, 118, 210, 0.16)',
                  },
                },
                '& .MuiSlider-track': {
                  border: 'none',
                  borderRadius: 3,
                },
                '& .MuiSlider-rail': {
                  opacity: 0.2,
                  backgroundColor: 'currentColor',
                  borderRadius: 3,
                },
                '& .MuiSlider-mark': {
                  backgroundColor: 'currentColor',
                  height: 4,
                  width: 4,
                  borderRadius: '50%',
                  opacity: 0.5,
                  '&.MuiSlider-markActive': {
                    opacity: 1,
                    backgroundColor: '#fff',
                  },
                },
                '& .MuiSlider-markLabel': {
                  fontSize: '0.65rem',
                  color: 'var(--on-surface-variant)',
                  fontWeight: 500,
                  marginTop: '4px',
                  opacity: 0.7,
                  transition: 'opacity 0.2s',
                  '&.MuiSlider-markLabelActive': {
                    color: 'var(--primary)',
                    fontWeight: 700,
                    opacity: 1,
                  }
                }
              }}
            />
          </Box>
        )}
      </Box>
    </motion.div>
  )
}
