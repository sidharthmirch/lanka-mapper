'use client'

import { Box, Link, Typography } from '@mui/material'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'
import {
  CatalogProviderPills,
  type CatalogUpstreamProvider,
} from '@/components/ui/CatalogProviderPills'

const LDFLK_PORTAL = 'https://ldflk.github.io/datasets/'
const LDFLK_REPO = 'https://github.com/LDFLK/datasets'
const LDS_PORTAL = 'https://nuuuwan.github.io/lanka_data_search/'
const LDS_REPO = 'https://github.com/nuuuwan/lanka_data_timeseries'
const LDS_PAPER = 'https://arxiv.org/abs/2510.04124'

interface UpstreamSource {
  name: string
  description: string
  provider: CatalogUpstreamProvider
  /** Official agency / institution site — the "respective place" for this source. */
  url: string
}

const UPSTREAM_SOURCES: UpstreamSource[] = ([
  {
    name: 'Asian Development Bank',
    description: 'Multilateral development finance, projects, and economic indicators.',
    provider: 'lds',
    url: 'https://www.adb.org/countries/sri-lanka/main',
  },
  {
    name: 'Central Bank of Sri Lanka',
    description: 'Monetary and financial statistics, reserves, and macroeconomic series.',
    provider: 'lds',
    url: 'https://www.cbsl.gov.lk/',
  },
  {
    name: 'Department of Immigration and Emigration',
    description:
      'Immigration statistics including asylum seekers, deportations, and visa-related data.',
    provider: 'ldflk',
    url: 'https://www.immigration.gov.lk/',
  },
  {
    name: 'Department of Motor Traffic, Sri Lanka',
    description: 'Vehicle registrations and motor traffic–related administrative data.',
    provider: 'lds',
    url: 'https://dmt.gov.lk/',
  },
  {
    name: 'Government Gazette — Sri Lanka',
    description: 'Official government documents, acts, and legal notices.',
    provider: 'ldflk',
    url: 'https://documents.gov.lk/',
  },
  {
    name: 'International Monetary Fund',
    description: 'Cross-country macroeconomic and financial data relevant to Sri Lanka.',
    provider: 'lds',
    url: 'https://www.imf.org/en/Countries/LKA',
  },
  {
    name: 'Ministry of Foreign Affairs',
    description: 'Diplomatic communications, media releases, and cadre management data.',
    provider: 'ldflk',
    url: 'https://mfa.gov.lk/',
  },
  {
    name: 'Sri Lanka Bureau of Foreign Employment',
    description:
      'Foreign employment registrations, departures, remittances, and complaints data.',
    provider: 'ldflk',
    url: 'https://www.slbfe.lk/',
  },
  {
    name: 'Sri Lanka Tourism Development Authority',
    description: 'Tourism statistics, arrivals, accommodations, and revenue data.',
    provider: 'both',
    url: 'https://www.sltda.gov.lk/',
  },
  {
    name: 'World Bank',
    description: 'Development indicators and World Bank–published series.',
    provider: 'lds',
    url: 'https://www.worldbank.org/en/country/srilanka',
  },
] as UpstreamSource[]).sort((a, b) => a.name.localeCompare(b.name))

function hostLabel(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

const portalLinkSx = {
  fontWeight: 600,
  fontSize: '12.5px',
  color: 'var(--accent)',
  textDecorationColor: 'color-mix(in oklab, var(--accent) 45%, transparent)',
  '&:hover': { color: 'var(--accent-light)' },
} as const

function PortalCard({
  title,
  blurb,
  links,
}: {
  title: string
  blurb: string
  links: Array<{ label: string; href: string }>
}) {
  return (
    <Box className="rounded-md border border-[var(--border)] bg-[var(--surface-2)] p-4">
      <span className="term-label">{title}</span>
      <Typography variant="body2" className="mt-2 text-[13px] leading-relaxed text-[var(--ink-2)]">
        {blurb}
      </Typography>
      <Box className="mt-3 flex flex-wrap gap-x-4 gap-y-2">
        {links.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            target="_blank"
            rel="noopener noreferrer"
            underline="hover"
            sx={portalLinkSx}
          >
            {l.label}
          </Link>
        ))}
      </Box>
    </Box>
  )
}

export default function SourcesContent() {
  return (
    <Box
      className="h-full min-h-0 overflow-y-auto overscroll-contain px-4 py-5 sm:px-6"
      sx={{ color: 'var(--ink)' }}
    >
      <span className="term-label">DATA SOURCES</span>
      <Typography variant="body2" className="mt-2 max-w-[64ch] text-[13.5px] leading-relaxed text-[var(--ink-2)]">
        This terminal joins an open catalog from the{' '}
        <strong className="text-[var(--ink)]">Lanka Data Foundation (LDFLK)</strong> with live series from{' '}
        <strong className="text-[var(--ink)]">Lanka Data Search (LDS)</strong>, built on nuuuwan&apos;s
        timeseries work. Each upstream agency below is credited and linked to its official site; agencies may
        appear in one or both catalogs.
      </Typography>

      <Box className="mt-6 grid gap-4 lg:grid-cols-2">
        <PortalCard
          title="Lanka Data Foundation · LDFLK"
          blurb="Open datasets and documentation from the Lanka Data Foundation catalog."
          links={[
            { label: 'Browse datasets ↗', href: LDFLK_PORTAL },
            { label: 'Contribute on GitHub ↗', href: LDFLK_REPO },
          ]}
        />
        <PortalCard
          title="Lanka Data Search · LDS"
          blurb="Search and discovery over nuuuwan's consolidated Lankan data timeseries."
          links={[
            { label: 'Open Lanka Data Search ↗', href: LDS_PORTAL },
            { label: 'nuuuwan / lanka_data_timeseries ↗', href: LDS_REPO },
            { label: 'Pipeline paper · arXiv:2510.04124 ↗', href: LDS_PAPER },
          ]}
        />
      </Box>

      <Box className="mt-9 flex items-baseline justify-between gap-3">
        <span className="term-label">UPSTREAM AGENCIES &amp; INSTITUTIONS</span>
        <span className="mono text-[10px] text-[var(--ink-3)]">{UPSTREAM_SOURCES.length} sources</span>
      </Box>

      <Box className="mt-3 grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
        {UPSTREAM_SOURCES.map((row) => (
          <Box
            key={row.name}
            className="flex flex-col rounded-md border border-[var(--border)] bg-[var(--surface)] p-3 transition-colors hover:border-[var(--border-2)]"
          >
            <Box className="flex items-start justify-between gap-2">
              <Link
                href={row.url}
                target="_blank"
                rel="noopener noreferrer"
                underline="none"
                className="group min-w-0"
                aria-label={`${row.name} — official site (opens in new tab)`}
                sx={{ color: 'var(--ink)', '&:hover': { color: 'var(--accent)' } }}
              >
                <span className="inline-flex items-start gap-1 text-[13px] font-semibold leading-snug">
                  {row.name}
                  <OpenInNewIcon
                    sx={{ fontSize: 13, mt: '2px', flexShrink: 0, color: 'var(--ink-3)' }}
                    className="transition-colors group-hover:!text-[var(--accent)]"
                  />
                </span>
              </Link>
              <CatalogProviderPills provider={row.provider} />
            </Box>
            <Typography variant="body2" className="mt-2 text-[12.5px] leading-relaxed text-[var(--ink-2)]">
              {row.description}
            </Typography>
            <span className="mono mt-2.5 truncate text-[10px] text-[var(--ink-3)]">{hostLabel(row.url)}</span>
          </Box>
        ))}
      </Box>

      <Typography variant="caption" className="mt-8 block text-[11px] leading-relaxed text-[var(--ink-3)]">
        Links open official agency sites in a new tab. Catalog membership (LDFLK / LDS) is indicated per source;
        figures shown elsewhere in the terminal are sourced from the catalog noted on each dataset.
      </Typography>
    </Box>
  )
}
