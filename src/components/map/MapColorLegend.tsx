'use client'

import { Box, Typography } from '@mui/material'
import type { ColorScale } from '@/types'
import { useFormatMetric } from '@/hooks/useFormatMetric'
import { useAnimatedScalar } from '@/hooks/useAnimatedScalar'
import { REGION_SHADING_GRADIENT_CSS } from '@/lib/uiThemePresets'

interface MapColorLegendProps {
  colorScale: ColorScale
  unit: string | null
  /** When true, min/max labels ease between frames during map playback. */
  animateValues?: boolean
  /** Duration for one easing step (match playback frame interval for smooth overlap). */
  animationDurationMs?: number
}

export default function MapColorLegend({
  colorScale,
  unit,
  animateValues = false,
  animationDurationMs = 400,
}: MapColorLegendProps) {
  const fmt = useFormatMetric()
  /**
   * `roundWhileActive`: during playback, legend min/max count in whole steps so
   * the three label cells don't churn in the last digit. When playback stops,
   * the hook snaps to the exact colorScale.min/max and full precision returns.
   */
  const animMin = useAnimatedScalar(colorScale.min, animateValues, animationDurationMs, {
    roundWhileActive: true,
  })
  const animMax = useAnimatedScalar(colorScale.max, animateValues, animationDurationMs, {
    roundWhileActive: true,
  })
  const mid = (animMin + animMax) / 2

  return (
    <Box
      className="pointer-events-none absolute right-4 top-4 z-[855] rounded-xl border border-[var(--outline)] bg-[var(--surface)]/92 shadow-[0_8px_24px_rgba(0,0,0,0.12)] backdrop-blur-md"
      sx={{
        minWidth: 200,
        maxWidth: 300,
        px: 2.25,
        py: 2,
      }}
    >
      <Typography variant="caption" className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.12em] opacity-65">
        Scale
      </Typography>
      <Box className="mb-2 h-2 w-full rounded-full" style={{ background: REGION_SHADING_GRADIENT_CSS }} />
      <Box className="grid grid-cols-3 gap-x-2 text-[11px] font-semibold tabular-nums leading-snug text-[var(--on-surface)] opacity-90">
        <span className="min-w-0 break-words text-left [overflow-wrap:anywhere]">{fmt(animMin, unit, 'compact')}</span>
        <span className="min-w-0 text-center [overflow-wrap:anywhere]">{fmt(mid, unit, 'compact')}</span>
        <span className="min-w-0 break-words text-right [overflow-wrap:anywhere]">{fmt(animMax, unit, 'compact')}</span>
      </Box>
    </Box>
  )
}
