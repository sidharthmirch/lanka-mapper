'use client'

import { useMemo } from 'react'
import { Box, IconButton, Slider, Tooltip } from '@mui/material'
import PlayArrowIcon from '@mui/icons-material/PlayArrow'
import PauseIcon from '@mui/icons-material/Pause'
import LoopIcon from '@mui/icons-material/Loop'
import SkipPreviousIcon from '@mui/icons-material/SkipPrevious'
import SkipNextIcon from '@mui/icons-material/SkipNext'
import RemoveIcon from '@mui/icons-material/Remove'
import AddIcon from '@mui/icons-material/Add'
import {
  getTimelinePositionForYear,
  getTimelineYearFromPosition,
} from '@/lib/mapPlaybackSchedule'

export type MapPlaybackSpeed = 0.5 | 1 | 1.5 | 2

const SPEEDS: MapPlaybackSpeed[] = [0.5, 1, 1.5, 2]

interface MapTimeToolbarProps {
  currentYear: number
  /** Fractional calendar year while map playback is running (thumb + label track interpolated time). */
  playbackLinearYear?: number | null
  years: number[]
  loading: boolean
  canPlayback: boolean
  playbackActive: boolean
  onTogglePlayback: () => void
  playbackSpeed: MapPlaybackSpeed
  onPlaybackSpeedChange: (speed: MapPlaybackSpeed) => void
  loopEnabled: boolean
  onLoopChange: (enabled: boolean) => void
  onYearChange: (year: number) => void
}

/** Square transport button — hairline terminal control. */
const transportButtonSx = {
  width: 34,
  height: 34,
  minWidth: 34,
  padding: 0,
  borderRadius: '6px',
  border: '1px solid var(--border-2)',
  backgroundColor: 'var(--surface-2)',
  color: 'var(--ink)',
  '&:hover': { backgroundColor: 'var(--surface-3)', borderColor: 'var(--ink-3)' },
  '&:active': { transform: 'translateY(1px)' },
  '&.Mui-disabled': { color: 'var(--ink-3)', opacity: 0.4, borderColor: 'var(--border)' },
} as const

export default function MapTimeToolbar({
  currentYear,
  playbackLinearYear = null,
  years,
  loading,
  canPlayback,
  playbackActive,
  onTogglePlayback,
  playbackSpeed,
  onPlaybackSpeedChange,
  loopEnabled,
  onLoopChange,
  onYearChange,
}: MapTimeToolbarProps) {
  const sortedYears = useMemo(() => [...years].sort((a, b) => a - b), [years])
  const scrubbing = playbackActive && playbackLinearYear != null
  const sliderMax = Math.max(0, sortedYears.length - 1)
  const liveYear = scrubbing ? (playbackLinearYear as number) : currentYear
  const sliderValue = getTimelinePositionForYear(sortedYears, liveYear)
  /** Integer display year — fractional playback time would flicker digits. */
  const headerYearText = String(Math.round(liveYear))

  const hasMultipleYears = sortedYears.length > 1
  const currentIndex = useMemo(() => {
    if (sortedYears.length === 0) return 0
    // Nearest data year to the live (possibly fractional) position.
    let best = 0
    let bestD = Infinity
    sortedYears.forEach((y, i) => {
      const d = Math.abs(y - liveYear)
      if (d < bestD) {
        bestD = d
        best = i
      }
    })
    return best
  }, [sortedYears, liveYear])

  const atFirst = currentIndex <= 0
  const atLast = currentIndex >= sortedYears.length - 1
  const stepDisabled = loading || playbackActive
  const speedIndex = SPEEDS.indexOf(playbackSpeed)
  const canSlowDown = speedIndex > 0
  const canSpeedUp = speedIndex < SPEEDS.length - 1

  const sliderMarks = useMemo(() => {
    const labelled = new Set<number>()
    if (sortedYears.length <= 7) {
      sortedYears.forEach((y) => labelled.add(y))
    } else if (sortedYears.length > 0) {
      labelled.add(sortedYears[0])
      labelled.add(sortedYears[sortedYears.length - 1])
      // Keep intermediate labels ≥2 indices clear of both ends so they never
      // collide with the first/last label on a narrow (mobile) rail.
      const step = Math.max(2, Math.floor(sortedYears.length / 4))
      for (let i = step; i < sortedYears.length - 2; i += step) labelled.add(sortedYears[i])
    }
    return sortedYears.map((year, index) => ({
      value: index,
      label: labelled.has(year) ? `${year}` : undefined,
    }))
  }, [sortedYears])

  /** Terminal scrubber rail: thin track, accent fill, square playhead, mono ticks below. */
  const railSx = {
    py: 0,
    color: 'var(--accent)',
    overflow: 'visible',
    '&.MuiSlider-marked': { marginBottom: '24px' },
    '& .MuiSlider-rail': {
      opacity: 1,
      height: 4,
      borderRadius: 2,
      backgroundColor: 'var(--border-2)',
    },
    '& .MuiSlider-track': {
      border: 'none',
      height: 4,
      borderRadius: 2,
      backgroundColor: 'var(--accent)',
    },
    '& .MuiSlider-thumb': {
      width: 12,
      height: 12,
      borderRadius: '3px',
      backgroundColor: 'var(--accent)',
      border: '2px solid var(--surface)',
      boxShadow: '0 0 0 1px var(--accent), 0 0 12px color-mix(in oklab, var(--accent) 50%, transparent)',
      transition: 'box-shadow 160ms ease',
      '&:hover, &.Mui-focusVisible': {
        boxShadow: '0 0 0 1px var(--accent), 0 0 0 6px color-mix(in oklab, var(--accent) 22%, transparent)',
      },
      '&.Mui-active': { boxShadow: '0 0 0 1px var(--accent), 0 0 0 8px color-mix(in oklab, var(--accent) 26%, transparent)' },
    },
    '& .MuiSlider-thumb.Mui-disabled': {
      width: 12,
      height: 12,
      backgroundColor: 'var(--accent)',
      border: '2px solid var(--surface)',
      boxShadow: '0 0 0 1px var(--accent)',
    },
    '& .MuiSlider-mark': { display: 'none' },
    '& .MuiSlider-markLabel': {
      fontFamily: 'var(--font-mono), ui-monospace, monospace',
      fontSize: 9.5,
      letterSpacing: '0.04em',
      color: 'var(--ink-3)',
      whiteSpace: 'nowrap',
      top: '20px',
      transform: 'translateX(-50%)',
    },
    '& .MuiSlider-markLabel[data-index="0"]': { transform: 'translateX(0)' },
    [`& .MuiSlider-markLabel[data-index="${sliderMax}"]`]: { transform: 'translateX(-100%)' },
  } as const

  // Single-year datasets: collapse to a compact readout — nothing to scrub.
  if (!hasMultipleYears) {
    return (
      <Box
        className="rounded-md border border-[var(--border)]/85 bg-[var(--surface)]/94 px-4 py-2 shadow-[var(--shadow-md)] backdrop-blur-sm"
        style={{ fontFamily: 'var(--font-mono), ui-monospace, monospace' }}
      >
        <Box className="flex items-center gap-3">
          <span className="term-label">YEAR</span>
          <span className="tabular-nums text-[15px] font-semibold text-[var(--accent)]">{currentYear}</span>
          <span className="ml-auto text-[10px] tracking-[0.06em] text-[var(--ink-3)]">SINGLE FRAME · NO TIMELINE</span>
        </Box>
      </Box>
    )
  }

  return (
    <Box
      data-testid="map-time-toolbar"
      className="w-full rounded-md border border-[var(--border)]/85 bg-[var(--surface)]/94 px-3 py-2.5 shadow-[var(--shadow-md)] backdrop-blur-sm sm:px-3.5 sm:py-3"
      style={{ fontFamily: 'var(--font-mono), ui-monospace, SFMono-Regular, Menlo, monospace' }}
    >
      {/* Control row */}
      <Box className="flex flex-wrap items-center gap-x-3 gap-y-2.5">
        {/* Year readout */}
        <Box className="flex items-baseline gap-2">
          <span className="tabular-nums text-[22px] font-semibold leading-none text-[var(--accent)]">
            {headerYearText}
          </span>
          <span className="hidden text-[10px] tracking-[0.06em] text-[var(--ink-3)] sm:inline">
            {sortedYears[0]}–{sortedYears[sortedYears.length - 1]}
          </span>
        </Box>

        {/* Transport */}
        <Box className="flex items-center gap-1.5">
          <Tooltip title="Previous year">
            <span>
              <IconButton
                size="small"
                aria-label="Previous year"
                disabled={stepDisabled || atFirst}
                onClick={() => onYearChange(sortedYears[Math.max(0, currentIndex - 1)])}
                sx={transportButtonSx}
              >
                <SkipPreviousIcon sx={{ fontSize: 18 }} />
              </IconButton>
            </span>
          </Tooltip>

          <Tooltip title={playbackActive ? 'Pause' : 'Play'}>
            <span>
              <IconButton
                onClick={onTogglePlayback}
                disabled={!canPlayback || loading}
                aria-label={playbackActive ? 'Pause map time animation' : 'Play map time animation'}
                sx={{
                  width: 40,
                  height: 40,
                  borderRadius: '7px',
                  border: '1px solid var(--accent)',
                  backgroundColor: playbackActive ? 'var(--accent)' : 'var(--accent-soft)',
                  color: playbackActive ? 'var(--bg)' : 'var(--accent)',
                  '&:hover': {
                    backgroundColor: 'var(--accent)',
                    color: 'var(--bg)',
                  },
                  '&:active': { transform: 'translateY(1px)' },
                  '&.Mui-disabled': {
                    color: 'var(--ink-3)',
                    opacity: 0.4,
                    borderColor: 'var(--border)',
                    backgroundColor: 'var(--surface-2)',
                  },
                }}
              >
                {playbackActive ? <PauseIcon sx={{ fontSize: 22 }} /> : <PlayArrowIcon sx={{ fontSize: 22 }} />}
              </IconButton>
            </span>
          </Tooltip>

          <Tooltip title="Next year">
            <span>
              <IconButton
                size="small"
                aria-label="Next year"
                disabled={stepDisabled || atLast}
                onClick={() => onYearChange(sortedYears[Math.min(sortedYears.length - 1, currentIndex + 1)])}
                sx={transportButtonSx}
              >
                <SkipNextIcon sx={{ fontSize: 18 }} />
              </IconButton>
            </span>
          </Tooltip>

          <Tooltip title={loopEnabled ? 'Loop on' : 'Loop off'}>
            <span>
              <IconButton
                size="small"
                aria-label={loopEnabled ? 'Disable looping' : 'Enable looping'}
                disabled={loading}
                onClick={() => onLoopChange(!loopEnabled)}
                sx={{
                  ...transportButtonSx,
                  color: loopEnabled ? 'var(--accent)' : 'var(--ink-2)',
                  borderColor: loopEnabled ? 'var(--accent)' : 'var(--border-2)',
                  backgroundColor: loopEnabled ? 'var(--accent-soft)' : 'var(--surface-2)',
                }}
              >
                <LoopIcon sx={{ fontSize: 17 }} />
              </IconButton>
            </span>
          </Tooltip>
        </Box>

        {/* Step speed control: less visual noise than a row of four presets. */}
        <Box className="ml-auto flex items-center gap-2.5">
          <Box
            role="group"
            aria-label="Playback speed"
            className="flex items-center overflow-hidden rounded-md border border-[var(--border-2)] bg-[var(--surface-2)]"
          >
            <Tooltip title="Slower playback">
              <span>
                <IconButton
                  size="small"
                  aria-label="Slower playback"
                  disabled={loading || !canSlowDown}
                  onClick={() => onPlaybackSpeedChange(SPEEDS[speedIndex - 1])}
                  sx={{ ...transportButtonSx, width: 30, height: 30, minWidth: 30, border: 'none', borderRadius: 0 }}
                >
                  <RemoveIcon sx={{ fontSize: 16 }} />
                </IconButton>
              </span>
            </Tooltip>
            <span className="min-w-9 px-1 text-center tabular-nums text-[11px] font-semibold text-[var(--accent)]">
              {playbackSpeed}×
            </span>
            <Tooltip title="Faster playback">
              <span>
                <IconButton
                  size="small"
                  aria-label="Faster playback"
                  disabled={loading || !canSpeedUp}
                  onClick={() => onPlaybackSpeedChange(SPEEDS[speedIndex + 1])}
                  sx={{ ...transportButtonSx, width: 30, height: 30, minWidth: 30, border: 'none', borderRadius: 0 }}
                >
                  <AddIcon sx={{ fontSize: 16 }} />
                </IconButton>
              </span>
            </Tooltip>
          </Box>
          <span className="hidden tabular-nums text-[10px] tracking-[0.06em] text-[var(--ink-3)] min-[440px]:inline">
            {String(currentIndex + 1).padStart(2, '0')}/{String(sortedYears.length).padStart(2, '0')}
          </span>
        </Box>
      </Box>

      {/* Scrubber rail */}
      <Box className="mt-2.5 px-1">
        <Slider
          value={sliderValue}
          min={0}
          max={sliderMax}
          marks={sliderMarks}
          step={scrubbing ? 0.01 : 1}
          disabled={loading || playbackActive}
          size="small"
          aria-label="Timeline year scrubber"
          getAriaValueText={(value) => String(getTimelineYearFromPosition(sortedYears, value))}
          onChange={(_, value) => {
            if (typeof value === 'number' && !playbackActive) {
              onYearChange(getTimelineYearFromPosition(sortedYears, value))
            }
          }}
          sx={railSx}
        />
      </Box>
    </Box>
  )
}
