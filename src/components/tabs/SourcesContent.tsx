'use client'

import { useMemo, useState } from 'react'
import { Box, Link, Typography } from '@mui/material'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import {
  CatalogProviderPills,
  type CatalogUpstreamProvider,
} from '@/components/ui/CatalogProviderPills'
import NadaArchive from './NadaArchive'
import type { DatasetManifestEntry } from '@/types'

const LDFLK_PORTAL = 'https://ldflk.github.io/datasets/'
const LDFLK_REPO = 'https://github.com/LDFLK/datasets'
const LDS_PORTAL = 'https://nuuuwan.github.io/lanka_data_search/'
const LDS_REPO = 'https://github.com/nuuuwan/lanka_data_timeseries'
const LDS_PAPER = 'https://arxiv.org/abs/2510.04124'

interface UpstreamSource {
  name: string
  description: string
  provider: CatalogUpstreamProvider
  /** Official agency / institution site. */
  url: string
  /**
   * How catalog datasets are linked back to this agency:
   * `sourceIds` matches nuuuwan/LDS `secondarySource` (the source_id, e.g. CBSL,
   * IMF); `keywords` matches LDFLK dataset names (which encode the agency).
   */
  sourceIds?: string[]
  keywords?: string[]
}

const UPSTREAM_SOURCES: UpstreamSource[] = ([
  {
    name: 'Asian Development Bank',
    description: 'Multilateral development finance, projects, and economic indicators.',
    provider: 'lds',
    url: 'https://www.adb.org/countries/sri-lanka/main',
    sourceIds: ['adb'],
  },
  {
    name: 'Central Bank of Sri Lanka',
    description: 'Monetary and financial statistics, reserves, and macroeconomic series.',
    provider: 'lds',
    url: 'https://www.cbsl.gov.lk/',
    sourceIds: ['cbsl'],
  },
  {
    name: 'Department of Immigration and Emigration',
    description:
      'Immigration statistics including asylum seekers, deportations, and visa-related data.',
    provider: 'ldflk',
    url: 'https://www.immigration.gov.lk/',
    keywords: ['asylum', 'deportation', 'refugee', 'refused entry', 'immigration', 'emigration'],
  },
  {
    name: 'Department of Motor Traffic, Sri Lanka',
    description: 'Vehicle registrations and motor traffic–related administrative data.',
    provider: 'lds',
    url: 'https://dmt.gov.lk/',
    sourceIds: ['dmtlk', 'dmt'],
    keywords: ['motor traffic', 'vehicle'],
  },
  {
    name: 'Government Gazette — Sri Lanka',
    description: 'Official government documents, acts, and legal notices.',
    provider: 'ldflk',
    url: 'https://documents.gov.lk/',
    keywords: ['gazette'],
  },
  {
    name: 'International Monetary Fund',
    description: 'Cross-country macroeconomic and financial data relevant to Sri Lanka.',
    provider: 'lds',
    url: 'https://www.imf.org/en/Countries/LKA',
    sourceIds: ['imf'],
  },
  {
    name: 'Ministry of Foreign Affairs',
    description: 'Diplomatic communications, media releases, and cadre management data.',
    provider: 'ldflk',
    url: 'https://mfa.gov.lk/',
    keywords: ['ministry', 'mission', 'foreign affairs', 'cadre', 'legal division', 'staff of', 'president ', 'prime minister', 'news from other'],
  },
  {
    name: 'Sri Lanka Bureau of Foreign Employment',
    description:
      'Foreign employment registrations, departures, remittances, and complaints data.',
    provider: 'ldflk',
    url: 'https://www.slbfe.lk/',
    keywords: ['slbfe', 'remittance', 'foreign exchange earnings', 'complaints'],
  },
  {
    name: 'Sri Lanka Tourism Development Authority',
    description: 'Tourism statistics, arrivals, accommodations, and revenue data.',
    provider: 'both',
    url: 'https://www.sltda.gov.lk/',
    sourceIds: ['sltda'],
    keywords: ['accommodation', 'tourist', 'tourism', 'occupancy', 'arrival', 'resort', 'source market', 'receipts', 'attraction', 'visitors'],
  },
  {
    name: 'World Bank',
    description: 'Development indicators and World Bank–published series.',
    provider: 'lds',
    url: 'https://www.worldbank.org/en/country/srilanka',
    sourceIds: ['world_bank', 'worldbank', 'wb'],
  },
] as UpstreamSource[]).sort((a, b) => a.name.localeCompare(b.name))

function hostLabel(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

/** Datasets in the catalog attributable to this agency. */
function datasetsForAgency(manifest: DatasetManifestEntry[], agency: UpstreamSource): DatasetManifestEntry[] {
  return manifest.filter((d) => {
    if (d.secondarySource && agency.sourceIds?.includes(d.secondarySource.toLowerCase())) return true
    if (agency.keywords && d.source === 'ldflk') {
      const hay = `${d.name} ${d.description ?? ''} ${d.path}`.toLowerCase()
      if (agency.keywords.some((k) => hay.includes(k))) return true
    }
    return false
  })
}

function yearLabel(years: number[]): string {
  if (years.length === 0) return ''
  if (years.length === 1) return `${years[0]}`
  return `${years[0]}–${years[years.length - 1]}`
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
          <Link key={l.href} href={l.href} target="_blank" rel="noopener noreferrer" underline="hover" sx={portalLinkSx}>
            {l.label}
          </Link>
        ))}
      </Box>
    </Box>
  )
}

interface SourcesContentProps {
  datasetManifest: DatasetManifestEntry[]
  onSelectDataset: (dataset: DatasetManifestEntry) => void
}

export default function SourcesContent({ datasetManifest, onSelectDataset }: SourcesContentProps) {
  const [expanded, setExpanded] = useState<string | null>(null)

  const connectedByAgency = useMemo(() => {
    const map = new Map<string, DatasetManifestEntry[]>()
    for (const agency of UPSTREAM_SOURCES) {
      map.set(
        agency.name,
        datasetsForAgency(datasetManifest, agency).sort((a, b) => a.name.localeCompare(b.name)),
      )
    }
    return map
  }, [datasetManifest])

  return (
    <Box className="h-full min-h-0 overflow-y-auto overscroll-contain px-4 py-5 sm:px-6" sx={{ color: 'var(--ink)' }}>
      <span className="term-label">DATA SOURCES</span>
      <Typography variant="body2" className="mt-2 max-w-[64ch] text-[13.5px] leading-relaxed text-[var(--ink-2)]">
        This terminal joins an open catalog from the{' '}
        <strong className="text-[var(--ink)]">Lanka Data Foundation (LDFLK)</strong> with live series from{' '}
        <strong className="text-[var(--ink)]">Lanka Data Search (LDS)</strong>, built on nuuuwan&apos;s timeseries
        work. Expand any agency to see the catalog datasets it feeds — click one to open it.
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
        {UPSTREAM_SOURCES.map((row) => {
          const connected = connectedByAgency.get(row.name) ?? []
          const isOpen = expanded === row.name
          return (
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

              <Box className="mt-2.5 flex items-center justify-between gap-2">
                <span className="mono truncate text-[10px] text-[var(--ink-3)]">{hostLabel(row.url)}</span>
                {connected.length > 0 ? (
                  <button
                    type="button"
                    onClick={() => setExpanded(isOpen ? null : row.name)}
                    aria-expanded={isOpen}
                    className="flex shrink-0 items-center gap-1 rounded-[5px] border border-[var(--border-2)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--ink-2)] transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)]"
                  >
                    <span className="mono tabular-nums">{connected.length}</span>
                    <span>{connected.length === 1 ? 'dataset' : 'datasets'}</span>
                    <ExpandMoreIcon sx={{ fontSize: 14, transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s ease' }} />
                  </button>
                ) : (
                  <span className="mono shrink-0 text-[9px] text-[var(--ink-3)]">no catalog datasets</span>
                )}
              </Box>

              {isOpen && connected.length > 0 && (
                <ul className="mt-2 max-h-[220px] space-y-0.5 overflow-y-auto overscroll-contain border-t border-[var(--border)] pt-2">
                  {connected.map((d) => (
                    <li key={d.id}>
                      <button
                        type="button"
                        onClick={() => onSelectDataset(d)}
                        className="group flex w-full items-center gap-2 rounded-[5px] px-1.5 py-1 text-left transition-colors hover:bg-[var(--surface-2)]"
                      >
                        <span className="min-w-0 flex-1 truncate text-[12px] text-[var(--ink)] group-hover:text-[var(--accent)]">
                          {d.name}
                        </span>
                        <span className="mono shrink-0 text-[9px] uppercase tracking-[0.06em] text-[var(--ink-3)]">{d.level}</span>
                        {d.years.length > 0 && (
                          <span className="mono shrink-0 text-[9px] tabular-nums text-[var(--ink-3)]">{yearLabel(d.years)}</span>
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </Box>
          )
        })}
      </Box>

      <NadaArchive />

      <Typography variant="caption" className="mt-8 block text-[11px] leading-relaxed text-[var(--ink-3)]">
        Links open official agency sites in a new tab. Dataset attribution is inferred from each catalog&apos;s
        source tags and dataset names; click a listed dataset to open it on the map, plots, or table.
      </Typography>
    </Box>
  )
}
