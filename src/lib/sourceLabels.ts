import type { DatasetSource } from '@/types'

/** Short pill label for a dataset's catalog source. */
export function sourceShortLabel(source: DatasetSource): string {
  if (source === 'ldflk') return 'LDFLK'
  if (source === 'local') return 'GOV.LK'
  return 'LDS'
}

/** Full label for the sidebar / chart source line. */
export function sourceFullLabel(source: DatasetSource | null): string {
  if (source === 'ldflk') return 'Lanka Data Foundation (LDFLK)'
  if (source === 'nuuuwan') return 'Lanka Data Search (LDS)'
  if (source === 'local') return 'data.gov.lk / CBSL (curated)'
  return 'N/A'
}
