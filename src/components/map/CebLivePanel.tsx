'use client'

import { useEffect, useState } from 'react'

const PUBLIC_BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? ''

interface CebSource {
  name: string
  label: string
  color: string
  clean: boolean
  mw: number
  pct: number
}

interface CebData {
  fetchedAt: string
  asOf: string
  source: string
  totalMW: number
  cleanPct: number
  sources: CebSource[]
}

function formatAsOf(asOf: string): string {
  // "2026-06-20 23:45:00" (Sri Lanka local) → "20 Jun 23:45"
  const [date, time] = asOf.split(' ')
  if (!date || !time) return asOf
  const [, m, d] = date.split('-')
  const months = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return `${Number(d)} ${months[Number(m)] ?? m} ${time.slice(0, 5)}`
}

/**
 * Live(ish) Sri Lanka generation mix from the CEB Generation Summary, baked into
 * a static JSON by a scheduled job (a static site can't fetch CEB directly — no
 * CORS). National aggregate, so it floats as a compact map panel rather than a
 * geographic layer.
 */
export default function CebLivePanel() {
  const [data, setData] = useState<CebData | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    void fetch(`${PUBLIC_BASE_PATH}/data/ceb-generation.json`, { cache: 'no-store' })
      .then((r) => (r.ok ? (r.json() as Promise<CebData>) : Promise.reject(new Error('no data'))))
      .then((d) => {
        if (!cancelled) setData(d)
      })
      .catch(() => {
        if (!cancelled) setFailed(true)
      })
    return () => {
      cancelled = true
    }
  }, [])

  if (failed || !data) return null

  const top = data.sources.filter((s) => s.mw > 0).slice(0, 6)

  return (
    <div
      className="pointer-events-auto w-[min(264px,calc(100vw-1.5rem))] rounded-lg border border-[var(--border)] bg-[var(--surface)]/95 p-2.5 shadow-[var(--shadow-lg)] backdrop-blur-md"
      style={{ fontFamily: 'var(--font-mono), ui-monospace, monospace' }}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5">
          <span className="live-dot" />
          <span className="term-label" style={{ color: 'var(--good)' }}>CEB live</span>
        </span>
        <span className="text-[9px] tracking-[0.04em] text-[var(--ink-3)]">{formatAsOf(data.asOf)}</span>
      </div>

      <div className="mt-1.5 flex items-baseline gap-1.5">
        <span className="tabular-nums text-[19px] font-bold leading-none text-[var(--ink)]">
          {data.totalMW.toLocaleString()}
        </span>
        <span className="text-[10px] text-[var(--ink-3)]">MW</span>
        <span className="ml-auto tabular-nums text-[11px] font-semibold" style={{ color: 'var(--good)' }}>
          {data.cleanPct}% renewable
        </span>
      </div>

      {/* Stacked mix bar */}
      <div className="mt-2 flex h-2.5 w-full overflow-hidden rounded-[3px] border border-[var(--border)]">
        {data.sources
          .filter((s) => s.pct > 0)
          .map((s) => (
            <span key={s.name} title={`${s.label} ${s.pct}%`} style={{ width: `${s.pct}%`, background: s.color }} />
          ))}
      </div>

      {/* Source list */}
      <ul className="mt-2 space-y-0.5">
        {top.map((s) => (
          <li key={s.name} className="flex items-center gap-2 text-[11px]">
            <span className="h-2 w-2 shrink-0 rounded-[2px]" style={{ background: s.color }} />
            <span className="min-w-0 flex-1 truncate text-[var(--ink-2)]">{s.label}</span>
            <span className="tabular-nums text-[var(--ink-3)]">{s.mw.toLocaleString()}</span>
            <span className="w-9 shrink-0 text-right tabular-nums font-semibold text-[var(--ink)]">{s.pct}%</span>
          </li>
        ))}
      </ul>

      <div className="mt-2 border-t border-[var(--border)] pt-1.5 text-[8.5px] leading-tight text-[var(--ink-3)]">
        Source: CEB Generation Summary · snapshot, refreshed periodically
      </div>
    </div>
  )
}
