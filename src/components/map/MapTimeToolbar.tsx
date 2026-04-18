'use client'

import { useMemo } from 'react'
import {
  Box,
  IconButton,
  Slider,
  ToggleButton,
  Tooltip,
  Typography,
} from '@mui/material'
import PlayArrowIcon from '@mui/icons-material/PlayArrow'
import PauseIcon from '@mui/icons-material/Pause'
import LoopIcon from '@mui/icons-material/Loop'
import RemoveIcon from '@mui/icons-material/Remove'
import AddIcon from '@mui/icons-material/Add'

export type MapPlaybackSpeed = 0.5 | 1 | 1.5 | 2

const SPEEDS: MapPlaybackSpeed[] = [0.5, 1, 1.5, 2]

/** Play, loop, and speed step buttons share this footprint (px). */
const CONTROL_SIZE_PX = 40

function speedSlower(current: MapPlaybackSpeed): MapPlaybackSpeed {
  const i = SPEEDS.indexOf(current)
  if (i <= 0) return SPEEDS[0]
  return SPEEDS[i - 1]
}

function speedFaster(current: MapPlaybackSpeed): MapPlaybackSpeed {
  const i = SPEEDS.indexOf(current)
  if (i < 0) return 1
  if (i >= SPEEDS.length - 1) return SPEEDS[SPEEDS.length - 1]
  return SPEEDS[i + 1]
}

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
  const minY = sortedYears[0] ?? currentYear
  const maxY = sortedYears[sortedYears.length - 1] ?? currentYear
  const sliderValue = scrubbing
    ? Math.min(maxY, Math.max(minY, playbackLinearYear))
    : currentYear
  /**
   * Visible CURRENT YEAR label always reads as an integer — fractional years like
   * "2021.3" flicker between digits every playback tick and read as jitter even
   * when the underlying scrubber position is continuous. Slider thumb keeps the
   * fractional `sliderValue` (smooth motion); only the text is rounded.
   */
  const headerYearText = String(Math.round(sliderValue))

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

  const hasMultipleYears = sortedYears.length > 1

  const atSlowest = playbackSpeed === SPEEDS[0]
  const atFastest = playbackSpeed === SPEEDS[SPEEDS.length - 1]

  const panelSx = {
    color: 'var(--on-surface)',
    fontFamily: 'var(--font-sans), "Avenir Next", "Segoe UI", sans-serif',
    '& .MuiTypography-root': {
      fontFamily: 'inherit',
    },
  } as const

  /** On-rail tick marks read as harsh white dots over the filled track; keep year labels only. */
  const yearSliderSx = {
    mb: 0,
    mt: 0.5,
    fontFamily: 'inherit',
    py: 0,
    /**
     * Do not set horizontal padding on the Slider root: MUI maps pointer X using the root's
     * full border-box width while thumb/track `left`/`width` percentages use the padding box.
     * Inset the control via the parent `Box` instead so the rail, thumb, and hit-testing agree.
     */
    px: 0,
    color: 'primary.main',
    overflow: 'visible',
    /**
     * MUI default `top: 30px` on mark labels aligns them with the rail so the track line cuts
     * through the year text. Place labels fully below the rail + thumb.
     */
    '&.MuiSlider-marked': {
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
      marginBottom: 0,
      paddingTop: 0,
      transform: 'translateX(-50%)',
      transformOrigin: 'top center',
      '@media (pointer: coarse)': {
        top: '52px',
      },
    },
    /** First / last labelled years: keep label box inside the rail span (no overflow past ends). */
    '& .MuiSlider-markLabel:first-of-type:not(:last-of-type)': {
      transform: 'translateX(0)',
    },
    '& .MuiSlider-markLabel:last-of-type:not(:first-of-type)': {
      transform: 'translateX(-100%)',
    },
    '& .MuiSlider-rail': {
      opacity: 1,
      height: 8,
      borderRadius: 999,
      backgroundColor: 'var(--surface-variant)',
      border: '1px solid',
      borderColor: 'color-mix(in srgb, var(--outline) 80%, transparent)',
    },
    '& .MuiSlider-track': {
      border: 'none',
      height: 8,
      borderRadius: 999,
      /* Matches active region-shading ramp (`--gradient-*` on :root). */
      background:
        'linear-gradient(90deg, var(--gradient-0) 0%, var(--gradient-2) 42%, var(--gradient-5) 100%)',
    },
    '& .MuiSlider-thumb': {
      width: 20,
      height: 20,
      background:
        'linear-gradient(145deg, color-mix(in srgb, var(--gradient-1) 55%, white) 0%, var(--gradient-1) 28%, var(--gradient-3) 55%, var(--gradient-5) 100%)',
      border: '2px solid rgba(255, 255, 255, 0.92)',
      boxShadow: '0 2px 10px rgba(15, 27, 44, 0.28), inset 0 1px 0 rgba(255, 255, 255, 0.45)',
      '&:hover, &.Mui-focusVisible': {
        boxShadow:
          '0 2px 14px color-mix(in srgb, var(--gradient-4) 45%, transparent), inset 0 1px 0 rgba(255, 255, 255, 0.5)',
      },
      '&.Mui-active': {
        boxShadow: '0 1px 8px rgba(15, 27, 44, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.4)',
      },
    },
    '& .MuiSlider-thumb.Mui-disabled': {
      background: 'var(--surface-variant)',
      borderColor: 'var(--outline)',
      boxShadow: 'none',
    },
  } as const

  /** Matches sidebar: outlined controls, surface-variant hover (see Sidebar close IconButton & section cards). */
  const sidebarControlButtonSx = {
    border: '1px solid',
    borderColor: 'var(--outline)',
    borderRadius: '10px',
    backgroundColor: 'color-mix(in srgb, var(--surface) 70%, transparent)',
    color: 'var(--primary)',
    width: CONTROL_SIZE_PX,
    height: CONTROL_SIZE_PX,
    minWidth: CONTROL_SIZE_PX,
    minHeight: CONTROL_SIZE_PX,
    padding: 0,
    boxSizing: 'border-box' as const,
    flexShrink: 0,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    '&:hover': {
      backgroundColor: 'var(--surface-variant)',
      borderColor: 'var(--outline)',
    },
    '&.Mui-disabled': {
      borderColor: 'var(--outline)',
      color: 'var(--on-surface-variant)',
      opacity: 0.5,
      backgroundColor: 'var(--surface-variant)',
    },
  } as const

  const loopToggleSx = {
    border: '1px solid',
    borderColor: 'var(--outline)',
    borderRadius: '10px',
    textTransform: 'none' as const,
    width: CONTROL_SIZE_PX,
    height: CONTROL_SIZE_PX,
    minWidth: CONTROL_SIZE_PX,
    minHeight: CONTROL_SIZE_PX,
    padding: 0,
    boxSizing: 'border-box' as const,
    flexShrink: 0,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'var(--on-surface)',
    backgroundColor: 'color-mix(in srgb, var(--surface) 70%, transparent)',
    '&:hover': {
      backgroundColor: 'var(--surface-variant)',
    },
    '&.Mui-selected': {
      color: 'var(--primary)',
      backgroundColor: 'color-mix(in srgb, var(--primary) 12%, transparent)',
      borderColor: 'color-mix(in srgb, var(--primary) 45%, var(--outline) 55%)',
    },
    '&.Mui-disabled': {
      opacity: 0.45,
      borderColor: 'var(--outline)',
    },
  } as const

  const speedStepButtonSx = {
    ...sidebarControlButtonSx,
  } as const

  /**
   * Single-year datasets have no timeline to scrub, no playback to drive, and no
   * speed/loop controls to show. Collapse the toolbar to a compact read-only
   * card that just surfaces the current year and a short explanatory note.
   */
  if (!hasMultipleYears) {
    return (
      <Box
        className="rounded-2xl border border-[var(--outline)] bg-[var(--surface)]/95 px-5 py-3 shadow-[0_12px_30px_rgba(0,0,0,0.14)] backdrop-blur-xl"
        sx={panelSx}
      >
        <Box className="flex items-center gap-3">
          <Typography
            variant="subtitle2"
            className="font-semibold uppercase tracking-[0.12em] text-[10px] text-[var(--on-surface-variant)]"
          >
            CURRENT YEAR
          </Typography>
          <Typography
            variant="subtitle2"
            className="font-semibold tabular-nums"
            sx={{ color: 'var(--gradient-4)' }}
          >
            {String(currentYear)}
          </Typography>
          <Typography
            variant="caption"
            className="ml-auto opacity-70"
            sx={{ fontStyle: 'italic' }}
          >
            Single year in this dataset
          </Typography>
        </Box>
      </Box>
    )
  }

  return (
    <Box
      className="rounded-2xl border border-[var(--outline)] bg-[var(--surface)]/95 px-5 py-4 shadow-[0_12px_30px_rgba(0,0,0,0.14)] backdrop-blur-xl sm:px-6 sm:py-4"
      sx={panelSx}
    >
      <Box className="w-[min(100vw-2.5rem,392px)] max-w-full">
        <Box className="mb-2 flex items-center justify-between gap-2">
          <Typography
            variant="subtitle2"
            className="font-semibold uppercase tracking-[0.12em] text-[10px] text-[var(--on-surface-variant)]"
          >
            CURRENT YEAR
          </Typography>
          <Typography
            variant="subtitle2"
            className="font-semibold tabular-nums"
            sx={{ color: 'var(--gradient-4)' }}
          >
            {headerYearText}
          </Typography>
        </Box>

        <Box className="px-5 pb-3 pt-1 sm:px-6">
          <Slider
            value={sliderValue}
            min={minY}
            max={maxY}
            marks={sliderMarks}
            step={scrubbing ? 0.01 : null}
            disabled={loading || playbackActive}
            size="small"
            onChange={(_, value) => {
              if (typeof value === 'number' && !playbackActive) {
                onYearChange(value)
              }
            }}
            sx={yearSliderSx}
          />
        </Box>

        <Box className="mt-6 flex flex-wrap items-center justify-between gap-2 border-t border-[var(--outline)]/80 pt-4">
          <Box className="flex items-center gap-1.5">
            <Tooltip title={playbackActive ? 'Pause' : 'Play'}>
              <span>
                <IconButton
                  onClick={onTogglePlayback}
                  disabled={!canPlayback || loading || !hasMultipleYears}
                  aria-label={playbackActive ? 'Pause map time animation' : 'Play map time animation'}
                  size="small"
                  sx={sidebarControlButtonSx}
                >
                  {playbackActive ? <PauseIcon fontSize="small" /> : <PlayArrowIcon fontSize="small" />}
                </IconButton>
              </span>
            </Tooltip>
            <Tooltip title={loopEnabled ? 'Loop on' : 'Loop off'}>
              <ToggleButton
                value="loop"
                size="small"
                selected={loopEnabled}
                disabled={!hasMultipleYears || loading}
                onClick={() => onLoopChange(!loopEnabled)}
                aria-label={loopEnabled ? 'Disable looping' : 'Enable looping'}
                sx={loopToggleSx}
              >
                <LoopIcon fontSize="small" />
              </ToggleButton>
            </Tooltip>
          </Box>

          <Box className="flex h-10 items-center gap-1 px-0.5">
            <Tooltip title="Slower">
              <span>
                <IconButton
                  size="small"
                  aria-label="Slower playback"
                  disabled={loading || atSlowest}
                  onClick={() => onPlaybackSpeedChange(speedSlower(playbackSpeed))}
                  sx={speedStepButtonSx}
                >
                  <RemoveIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
            <Typography
              variant="body2"
              component="span"
              className="min-w-[2.75rem] select-none text-center font-semibold tabular-nums text-[var(--on-surface)]"
            >
              {`${playbackSpeed}×`}
            </Typography>
            <Tooltip title="Faster">
              <span>
                <IconButton
                  size="small"
                  aria-label="Faster playback"
                  disabled={loading || atFastest}
                  onClick={() => onPlaybackSpeedChange(speedFaster(playbackSpeed))}
                  sx={speedStepButtonSx}
                >
                  <AddIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
          </Box>
        </Box>
      </Box>
    </Box>
  )
}
