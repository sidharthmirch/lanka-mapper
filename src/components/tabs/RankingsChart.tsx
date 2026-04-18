'use client'

import { useMemo, useState } from 'react'
import { Box, Typography } from '@mui/material'
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown'
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp'
import type { MapData } from '@/types'
import { formatMetricValue } from '@/lib/formatDataValue'
import { useAnimatedScalar } from '@/hooks/useAnimatedScalar'

interface RankingsChartProps {
  data: MapData[]
  unit: string | null
  onSelect: (name: string) => void
  /** Ease value text and bar width between playback frames. */
  playbackActive?: boolean
  /** Should match map playback frame interval for smooth overlap. */
  animationDurationMs?: number
}

function RankingRow({
  name,
  value,
  unit,
  maxAnimated,
  playbackActive,
  durationMs,
  onSelect,
}: {
  name: string
  value: number
  unit: string | null
  maxAnimated: number
  playbackActive: boolean
  durationMs: number
  onSelect: (name: string) => void
}) {
  /**
   * Integer rounding while playback is active — fractional ranking values
   * read as jitter in the text readout. Bar width uses the same rounded
   * number (visually indistinguishable from fractional at ranking bar scale).
   */
  const animated = useAnimatedScalar(value, playbackActive, durationMs, {
    roundWhileActive: true,
  })
  const pct = maxAnimated > 0 ? Math.max(2, (animated / maxAnimated) * 100) : 2

  return (
    <button
      type="button"
      onClick={() => onSelect(name)}
      className="w-full rounded-xl border border-[var(--outline)]/70 bg-[var(--surface)]/70 px-3 py-2 text-left transition-colors hover:bg-[color-mix(in_srgb,var(--gradient-3)_12%,var(--surface))]"
    >
      <div className="mb-1 flex items-center justify-between text-xs font-semibold opacity-85">
        <span>{name}</span>
        <span className="tabular-nums text-[var(--gradient-4)]">{formatMetricValue(animated, unit)}</span>
      </div>
      <div className="h-2 rounded-full bg-[var(--surface-variant)]">
        <div
          className="h-2 rounded-full"
          style={{
            width: `${pct}%`,
            background:
              'linear-gradient(90deg, var(--gradient-0), var(--gradient-2) 55%, var(--gradient-5))',
          }}
        />
      </div>
    </button>
  )
}

export default function RankingsChart({
  data,
  unit,
  onSelect,
  playbackActive = false,
  animationDurationMs = 400,
}: RankingsChartProps) {
  const [collapsed, setCollapsed] = useState(false)
  // `data` identity changes on every playback frame (~12 fps); memoize
  // the sort so we're not re-allocating this array on every tick.
  const rows = useMemo(
    () => [...data].sort((a, b) => b.value - a.value).slice(0, 12),
    [data],
  )

  const maxValue = rows.length > 0 ? rows[0].value : 1
  const maxAnimated = useAnimatedScalar(maxValue, playbackActive, animationDurationMs, {
    roundWhileActive: true,
  })

  return (
    <Box
      className="max-h-[calc(100vh-11rem)] overflow-hidden rounded-2xl border border-[var(--outline)] bg-[var(--surface)]/95 p-3 shadow-[0_12px_30px_rgba(0,0,0,0.14)] backdrop-blur-xl"
      sx={{
        color: 'var(--on-surface)',
        fontFamily: 'var(--font-sans), "Avenir Next", "Segoe UI", sans-serif',
        '& .MuiTypography-root': { fontFamily: 'inherit' },
      }}
    >
      <button
        type="button"
        className="mb-2 flex w-full items-center justify-between rounded-xl px-2 py-1 text-left hover:bg-[var(--surface-variant)]/55"
        onClick={() => setCollapsed((prev) => !prev)}
      >
        <Typography variant="subtitle2" className="font-semibold">Top Regions</Typography>
        {collapsed ? <KeyboardArrowDownIcon fontSize="small" /> : <KeyboardArrowUpIcon fontSize="small" />}
      </button>
      {!collapsed && (
        <Box className="max-h-[calc(100vh-16rem)] space-y-2 overflow-y-auto">
          {rows.map((row) => (
            <RankingRow
              key={row.name}
              name={row.name}
              value={row.value}
              unit={unit}
              maxAnimated={maxAnimated}
              playbackActive={playbackActive}
              durationMs={animationDurationMs}
              onSelect={onSelect}
            />
          ))}
        </Box>
      )}
    </Box>
  )
}
