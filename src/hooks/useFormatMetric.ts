'use client'

import { useCallback } from 'react'
import { useAppStore } from '@/store'
import {
  type FormatMetricDensity,
  type FormatMetricOptions,
  formatMetricValue,
} from '@/lib/formatDataValue'

/**
 * `formatMetricValue` bound to persisted number-format preferences.
 */
export function useFormatMetric() {
  const useGrouping = useAppStore((s) => s.numberUseGrouping)
  const maxSigFigs = useAppStore((s) => s.numberMaxSigFigs)

  return useCallback(
    (value: number, unit: string | null, density: FormatMetricDensity = 'comfortable') => {
      const opts: FormatMetricOptions = {
        useGrouping,
        maxSignificantDigits: maxSigFigs > 0 ? maxSigFigs : undefined,
      }
      return formatMetricValue(value, unit, density, opts)
    },
    [useGrouping, maxSigFigs],
  )
}
