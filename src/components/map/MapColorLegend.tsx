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
      className="pointer-events-none absolute right-3 top-3 z-[855] hidden rounded-lg border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-md)] min-[480px]:right-20 min-[480px]:block md:hidden lg:right-4 lg:top-4 lg:block"
      sx={{
        width: { xs: 'min(220px, calc(100vw - 24px))', lg: 240, xl: 272 },
        px: 1.5,
        py: 1.25,
      }}
    >
      <Typography variant="caption" className="mb-1.5 block text-[10px] font-semibold opacity-70">
        Scale
      </Typography>
      <Box className="mb-2 h-2 w-full rounded-full" style={{ background: REGION_SHADING_GRADIENT_CSS }} />
      <Box className="grid grid-cols-3 gap-x-2 text-[11px] font-semibold tabular-nums leading-snug text-[var(--on-surface)] opacity-90">
        <span className="min-w-0 truncate text-left">{fmt(animMin, unit, 'compact')}</span>
        <span className="min-w-0 truncate text-center">{fmt(mid, unit, 'compact')}</span>
        <span className="min-w-0 truncate text-right">{fmt(animMax, unit, 'compact')}</span>
      </Box>
    </Box>
  )
}
