'use client'

import { Box, Link, Typography } from '@mui/material'
import {
  CatalogProviderPills,
  type CatalogUpstreamProvider,
} from '@/components/ui/CatalogProviderPills'

const LDFLK_PORTAL = 'https://ldflk.github.io/datasets/'
const LDFLK_REPO = 'https://github.com/LDFLK/datasets'
const LDS_PORTAL = 'https://nuuuwan.github.io/lanka_data_search/'
const LDS_REPO = 'https://github.com/nuuuwan/lanka_data_timeseries'

const UPSTREAM_SOURCES = [
  {
    name: 'Asian Development Bank',
    description: 'Multilateral development finance, projects, and economic indicators.',
    provider: 'lds',
  },
  {
    name: 'Central Bank of Sri Lanka',
    description: 'Monetary and financial statistics, reserves, and macroeconomic series.',
    provider: 'lds',
  },
  {
    name: 'Department of Immigration and Emigration',
    description:
      'Immigration statistics including asylum seekers, deportations, and visa-related data.',
    provider: 'ldflk',
  },
  {
    name: 'Department of Motor Traffic, Sri Lanka',
    description: 'Vehicle registrations and motor traffic–related administrative data.',
    provider: 'lds',
  },
  {
    name: 'Government Gazette — Sri Lanka',
    description: 'Official government documents, acts, and legal notices.',
    provider: 'ldflk',
  },
  {
    name: 'International Monetary Fund',
    description: 'Cross-country macroeconomic and financial data relevant to Sri Lanka.',
    provider: 'lds',
  },
  {
    name: 'Ministry of Foreign Affairs',
    description: 'Diplomatic communications, media releases, and cadre management data.',
    provider: 'ldflk',
  },
  {
    name: 'Sri Lanka Bureau of Foreign Employment',
    description:
      'Foreign employment registrations, departures, remittances, and complaints data.',
    provider: 'ldflk',
  },
  {
    name: 'Sri Lanka Tourism Development Authority',
    description: 'Tourism statistics, arrivals, accommodations, and revenue data.',
    provider: 'both',
  },
  {
    name: 'World Bank',
    description: 'Development indicators and World Bank–published series.',
    provider: 'lds',
  },
]
  .sort((a, b) => a.name.localeCompare(b.name)) as Array<{
  name: string
  description: string
  provider: CatalogUpstreamProvider
}>

export default function SourcesContent() {
  return (
    <Box
      className="h-full min-h-0 overflow-y-auto overscroll-contain px-4 py-5 sm:px-6"
      sx={{ color: 'var(--on-surface)' }}
    >
      <Typography variant="h5" className="font-semibold tracking-tight">
        Data sources
      </Typography>
      <Typography variant="body2" className="mt-2 max-w-[52rem] opacity-80">
        This app combines an open catalog from the{' '}
        <strong>Lanka Data Foundation (LDFLK)</strong> with live series from{' '}
        <strong>Lanka Data Search (LDS)</strong>, built on nuuuwan&apos;s timeseries work. Individual
        upstream agencies credited below may appear in one or both catalogs.
      </Typography>

      <Box className="mt-8 grid gap-6 lg:grid-cols-2">
        <Box className="rounded-2xl border border-[var(--outline)] bg-[var(--surface-variant)]/35 p-4">
          <Typography variant="subtitle2" className="font-semibold">
            Lanka Data Foundation (LDFLK)
          </Typography>
          <Typography variant="body2" className="mt-2 opacity-85">
            Open datasets and documentation from the Lanka Data Foundation catalog.
          </Typography>
          <Box className="mt-3 flex flex-wrap gap-x-4 gap-y-2">
            <Link href={LDFLK_PORTAL} target="_blank" rel="noopener noreferrer" variant="body2" fontWeight={600}>
              Browse datasets
            </Link>
            <Link href={LDFLK_REPO} target="_blank" rel="noopener noreferrer" variant="body2" fontWeight={600}>
              Contribute on GitHub
            </Link>
          </Box>
        </Box>

        <Box className="rounded-2xl border border-[var(--outline)] bg-[var(--surface-variant)]/35 p-4">
          <Typography variant="subtitle2" className="font-semibold">
            Lanka Data Search (LDS)
          </Typography>
          <Typography variant="body2" className="mt-2 opacity-85">
            Search and discovery UI for nuuuwan&apos;s consolidated Lankan data timeseries.
          </Typography>
          <Box className="mt-3 flex flex-wrap gap-x-4 gap-y-2">
            <Link href={LDS_PORTAL} target="_blank" rel="noopener noreferrer" variant="body2" fontWeight={600}>
              Open Lanka Data Search
            </Link>
            <Link href={LDS_REPO} target="_blank" rel="noopener noreferrer" variant="body2" fontWeight={600}>
              nuuuwan / lanka_data_timeseries
            </Link>
            <Link href="https://arxiv.org/abs/2510.04124" target="_blank" rel="noopener noreferrer" variant="body2" fontWeight={600}>
              Pipeline paper (arXiv:2510.04124)
            </Link>
          </Box>
        </Box>
      </Box>

      <Typography variant="subtitle2" className="mt-10 font-semibold">
        Upstream agencies & institutions
      </Typography>

      <Box className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {UPSTREAM_SOURCES.map((row) => (
          <Box
            key={row.name}
            className="flex flex-col rounded-xl border border-[var(--outline)]/90 bg-[var(--surface)]/50 p-3"
          >
            <Box className="flex items-start justify-between gap-2">
              <Typography variant="subtitle2" className="font-semibold leading-snug">
                {row.name}
              </Typography>
              <CatalogProviderPills provider={row.provider} />
            </Box>
            <Typography variant="body2" className="mt-2 text-[13px] leading-relaxed opacity-80">
              {row.description}
            </Typography>
          </Box>
        ))}
      </Box>
    </Box>
  )
}
