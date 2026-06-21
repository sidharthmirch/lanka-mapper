'use client'

import { useEffect, useMemo, useState } from 'react'
import { Box, Link, Typography } from '@mui/material'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'

const NADA_BASE = 'https://nada.statistics.gov.lk/index.php'
const NADA_API = `${NADA_BASE}/api/catalog/search?ps=500`
const NADA_PORTAL = `${NADA_BASE}/home`
const PUBLIC_BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? ''

interface NadaStudy {
  id: string
  idno: string
  title: string
  authoring_entity: string | null
  year_start: string | null
  year_end: string | null
  url?: string
  total_downloads?: number
}

function studyUrl(s: NadaStudy): string {
  return s.url && /^https?:/.test(s.url) ? s.url : `${NADA_BASE}/catalog/${s.id}`
}

function yearSpan(s: NadaStudy): string {
  const a = s.year_start
  const b = s.year_end
  if (a && b) return a === b ? a : `${a}–${b}`
  return a || b || ''
}

/**
 * Department of Census & Statistics National Data Archive (NADA). These are
 * survey / census studies (DDI microdata + reports), not the district/year
 * timeseries the map renders — so we list them live (the NADA API is CORS-open)
 * and link each to its NADA study page where the data lives. Multi-agency:
 * DCS hosts surveys from Customs, Labour, Police, Registrar General, etc.
 */
export default function NadaArchive() {
  const [studies, setStudies] = useState<NadaStudy[] | null>(null)
  const [failed, setFailed] = useState(false)
  const [query, setQuery] = useState('')

  useEffect(() => {
    let cancelled = false
    const setRows = (rows: NadaStudy[]) => {
      if (!cancelled) setStudies(rows)
    }
    // Primary: the baked db we serve (built server-side). Fallback: live NADA
    // (its API is CORS-open) if the snapshot is missing.
    void fetch(`${PUBLIC_BASE_PATH}/data/nada-catalog.json`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('no baked'))))
      .then((d) => setRows(d?.studies ?? []))
      .catch(() =>
        fetch(NADA_API, { headers: { Accept: 'application/json' } })
          .then((r) => (r.ok ? r.json() : Promise.reject(new Error('nada'))))
          .then((j) => setRows(j?.result?.rows ?? j?.rows ?? []))
          .catch(() => {
            if (!cancelled) setFailed(true)
          }),
      )
    return () => {
      cancelled = true
    }
  }, [])

  const sorted = useMemo(
    () => (studies ? [...studies].sort((a, b) => Number(b.year_end ?? 0) - Number(a.year_end ?? 0)) : []),
    [studies],
  )
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return sorted
    return sorted.filter((s) => `${s.title} ${s.authoring_entity ?? ''} ${s.idno}`.toLowerCase().includes(q))
  }, [sorted, query])

  const header = (
    <Box className="flex items-baseline justify-between gap-3">
      <span className="term-label">National Data Archive · DCS</span>
      <Link href={NADA_PORTAL} target="_blank" rel="noopener noreferrer" underline="hover" sx={{ color: 'var(--accent)', fontSize: '11px', fontWeight: 600 }}>
        Open NADA ↗
      </Link>
    </Box>
  )

  if (failed) {
    return (
      <Box className="mt-9">
        {header}
        <Box className="mt-3 rounded-md border border-[var(--border)] bg-[var(--surface)] p-4">
          <Typography variant="body2" className="text-[12.5px] text-[var(--ink-2)]">
            The Department of Census &amp; Statistics archive (surveys &amp; censuses) couldn&apos;t be reached just now.
            Browse it directly on{' '}
            <Link href={NADA_PORTAL} target="_blank" rel="noopener noreferrer" underline="hover" sx={{ color: 'var(--accent)', fontWeight: 600 }}>
              nada.statistics.gov.lk ↗
            </Link>.
          </Typography>
        </Box>
      </Box>
    )
  }

  return (
    <Box className="mt-9">
      {header}
      <Typography variant="body2" className="mt-2 max-w-[64ch] text-[12.5px] leading-relaxed text-[var(--ink-2)]">
        Survey and census studies from the DCS National Data Archive — multi-agency (Census &amp; Statistics, Customs,
        Labour, Police, Registrar General, and more). These are microdata / report studies; each opens on NADA where the
        data and documentation live.
      </Typography>

      <Box className="mt-3 overflow-hidden rounded-md border border-[var(--border)] bg-[var(--surface-2)]">
        <Box className="flex items-center justify-between gap-2 border-b border-[var(--border)] p-2">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter studies — title, agency, ID…"
            aria-label="Filter NADA studies"
            className="min-w-0 flex-1 rounded-[5px] border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1.5 text-[13px] text-[var(--ink)] outline-none placeholder:text-[var(--ink-3)] focus:border-[var(--accent)]"
          />
          <span className="mono shrink-0 px-1 text-[10px] text-[var(--ink-3)]">
            {studies == null ? '…' : `${filtered.length}/${studies.length}`}
          </span>
        </Box>

        {studies == null ? (
          <Box className="px-3 py-8 text-center">
            <span className="mono text-[11px] uppercase tracking-[0.14em] text-[var(--ink-3)]">Loading archive…</span>
          </Box>
        ) : filtered.length === 0 ? (
          <Box className="px-3 py-8 text-center text-[12px] text-[var(--ink-3)]">No studies match “{query}”.</Box>
        ) : (
          <ul className="max-h-[360px] divide-y divide-[var(--border)]/60 overflow-y-auto overscroll-contain">
            {filtered.map((s) => (
              <li key={s.id}>
                <Link
                  href={studyUrl(s)}
                  target="_blank"
                  rel="noopener noreferrer"
                  underline="none"
                  className="group flex items-start gap-2 px-3 py-2 transition-colors hover:bg-[var(--surface)]"
                  sx={{ color: 'var(--ink)' }}
                >
                  <Box className="min-w-0 flex-1">
                    <span className="block truncate text-[12.5px] font-semibold group-hover:text-[var(--accent)]">
                      {s.title}
                    </span>
                    {s.authoring_entity && (
                      <span className="mono block truncate text-[10px] text-[var(--ink-3)]">{s.authoring_entity}</span>
                    )}
                  </Box>
                  {yearSpan(s) && (
                    <span className="mono shrink-0 pt-0.5 text-[10px] tabular-nums text-[var(--ink-3)]">{yearSpan(s)}</span>
                  )}
                  <OpenInNewIcon sx={{ fontSize: 12, mt: '3px', flexShrink: 0, color: 'var(--ink-3)' }} className="transition-colors group-hover:!text-[var(--accent)]" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Box>
    </Box>
  )
}
