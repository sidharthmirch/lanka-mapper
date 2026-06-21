'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Box } from '@mui/material'
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
  rank,
  name,
  value,
  unit,
  maxAnimated,
  playbackActive,
  durationMs,
  onSelect,
}: {
  rank: number
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
      className="group w-full rounded-md border border-transparent px-2 py-1.5 text-left transition-colors hover:border-[var(--border-2)] hover:bg-[var(--surface-2)] focus-visible:border-[var(--accent)]"
    >
      <div className="mb-1 flex items-center gap-2 text-[12px]">
        <span className="mono shrink-0 text-[10px] tabular-nums text-[var(--ink-3)]">
          {String(rank).padStart(2, '0')}
        </span>
        <span className="min-w-0 flex-1 truncate font-semibold text-[var(--ink)]" title={name}>
          {name}
        </span>
        <span className="mono shrink-0 tabular-nums text-[var(--accent)]">
          {formatMetricValue(animated, unit)}
        </span>
      </div>
      <div className="ml-[1.6rem] h-[5px] overflow-hidden rounded-sm bg-[var(--surface-3)]">
        <div
          className="h-full rounded-sm"
          style={{
            width: `${pct}%`,
            background: 'linear-gradient(90deg, var(--gradient-2), var(--gradient-4) 60%, var(--gradient-5))',
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
  const [autoCollapsed, setAutoCollapsed] = useState(false)
  const [manualExpandOverride, setManualExpandOverride] = useState(false)
  const rootRef = useRef<HTMLDivElement | null>(null)
  const listRef = useRef<HTMLDivElement | null>(null)
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
  const effectiveCollapsed = collapsed || (autoCollapsed && !manualExpandOverride)

  useEffect(() => {
    const updateOverflowState = () => {
      const constrainedViewport = window.matchMedia('(max-width: 767px), (max-height: 720px)').matches
      if (!constrainedViewport) {
        setAutoCollapsed(false)
        setManualExpandOverride(false)
        return
      }

      const list = listRef.current
      if (!list) return

      const overflowing = list.scrollHeight > list.clientHeight + 1
      setAutoCollapsed(overflowing)
      if (!overflowing) {
        setManualExpandOverride(false)
      }
    }

    updateOverflowState()

    const observer = new ResizeObserver(updateOverflowState)
    if (rootRef.current) observer.observe(rootRef.current)
    if (listRef.current) observer.observe(listRef.current)
    window.addEventListener('resize', updateOverflowState)

    return () => {
      observer.disconnect()
      window.removeEventListener('resize', updateOverflowState)
    }
  }, [rows.length])

  const handleToggleCollapsed = () => {
    if (effectiveCollapsed) {
      setCollapsed(false)
      setManualExpandOverride(true)
      return
    }
    setCollapsed(true)
    setManualExpandOverride(false)
  }

  return (
    <Box
      ref={rootRef}
      className="flex max-h-[min(320px,calc(100dvh-16rem))] flex-col overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface)]/95 p-2.5 shadow-[var(--shadow-lg)] backdrop-blur-md sm:max-h-[min(380px,calc(100dvh-15rem))] xl:max-h-[calc(100dvh-11rem)]"
      sx={{
        color: 'var(--on-surface)',
        fontFamily: 'var(--font-sans), "Avenir Next", "Segoe UI", sans-serif',
        '& .MuiTypography-root': { fontFamily: 'inherit' },
      }}
    >
      <button
        type="button"
        className="mb-1.5 flex w-full items-center justify-between rounded-md px-2 py-1 text-left hover:bg-[var(--surface-2)]"
        onClick={handleToggleCollapsed}
        aria-expanded={!effectiveCollapsed}
      >
        <span className="flex items-baseline gap-2">
          <span className="term-label">Top Regions</span>
          <span className="mono text-[10px] text-[var(--ink-3)]">{rows.length}</span>
        </span>
        {effectiveCollapsed ? (
          <KeyboardArrowDownIcon fontSize="small" sx={{ color: 'var(--ink-3)' }} />
        ) : (
          <KeyboardArrowUpIcon fontSize="small" sx={{ color: 'var(--ink-3)' }} />
        )}
      </button>
      {!effectiveCollapsed && (
        <Box ref={listRef} className="min-h-0 flex-1 space-y-0.5 overflow-y-auto">
          {rows.map((row, i) => (
            <RankingRow
              key={row.name}
              rank={i + 1}
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
