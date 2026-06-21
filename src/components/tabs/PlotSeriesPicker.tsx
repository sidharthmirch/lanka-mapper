'use client'

import { useMemo, useState } from 'react'
import CheckIcon from '@mui/icons-material/Check'
import { getSeriesColors } from '@/lib/uiThemePresets'

interface PlotSeriesPickerProps {
  seriesNames: string[]
  /** Selected names, in chart order (index → line color). */
  selected: string[]
  onChange: (names: string[]) => void
  isDark: boolean
}

const SHOW_FILTER_THRESHOLD = 7

/**
 * Compact, finger-friendly series picker for the Plots tab. Long series names
 * (e.g. "Eligible for university admission as a percentage of number sat for GCE
 * (A or L)") were unreadable as truncated MUI chips; here each series is a full
 * roomy row with a checkbox and a swatch matching its chart line. Selecting
 * appends (preserving chart color order); a filter appears once the list is long.
 */
export default function PlotSeriesPicker({ seriesNames, selected, onChange, isDark }: PlotSeriesPickerProps) {
  const [query, setQuery] = useState('')
  const colors = getSeriesColors(isDark)

  const selectedSet = useMemo(() => new Set(selected), [selected])
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return seriesNames
    return seriesNames.filter((n) => n.toLowerCase().includes(q))
  }, [seriesNames, query])

  const allOn = seriesNames.length > 0 && seriesNames.every((n) => selectedSet.has(n))

  const toggle = (name: string) => {
    if (selectedSet.has(name)) {
      onChange(selected.filter((n) => n !== name))
    } else {
      onChange([...selected, name])
    }
  }

  return (
    <div
      role="group"
      aria-label="Series on plot"
      className="overflow-hidden rounded-md border border-[var(--border)] bg-[var(--surface-2)]"
    >
      <div className="flex items-center justify-between gap-2 border-b border-[var(--border)] px-3 py-2">
        <div className="flex items-baseline gap-2">
          <span className="term-label">Series on plot</span>
          <span className="mono text-[10px] text-[var(--ink-3)]">
            {selected.length}/{seriesNames.length}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onChange(seriesNames)}
            disabled={allOn}
            className="mono rounded-[5px] border border-[var(--border-2)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.06em] text-[var(--ink-2)] transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-40"
          >
            All
          </button>
          <button
            type="button"
            onClick={() => onChange([])}
            disabled={selected.length === 0}
            className="mono rounded-[5px] border border-[var(--border-2)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.06em] text-[var(--ink-2)] transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-40"
          >
            None
          </button>
        </div>
      </div>

      {seriesNames.length >= SHOW_FILTER_THRESHOLD && (
        <div className="border-b border-[var(--border)] p-2">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter series…"
            aria-label="Filter series"
            className="w-full rounded-[5px] border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1.5 text-[13px] text-[var(--ink)] outline-none placeholder:text-[var(--ink-3)] focus:border-[var(--accent)]"
          />
        </div>
      )}

      <ul className="max-h-[238px] overflow-y-auto overscroll-contain py-1">
        {filtered.length === 0 ? (
          <li className="px-3 py-6 text-center text-[12px] text-[var(--ink-3)]">No series match “{query}”.</li>
        ) : (
          filtered.map((name) => {
            const idx = selected.indexOf(name)
            const on = idx >= 0
            const color = colors[idx % colors.length]
            return (
              <li key={name}>
                <button
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggle(name)}
                  className={`flex w-full items-start gap-2.5 px-3 py-2 text-left transition-colors hover:bg-[var(--surface-3)] ${on ? 'bg-[color-mix(in_oklab,var(--accent)_9%,transparent)]' : ''}`}
                >
                  <span
                    aria-hidden
                    className={`mt-0.5 grid h-[15px] w-[15px] shrink-0 place-items-center rounded-[4px] border transition-colors ${
                      on ? 'border-[var(--accent)] bg-[var(--accent)]' : 'border-[var(--border-2)] bg-[var(--surface)]'
                    }`}
                  >
                    {on && <CheckIcon sx={{ fontSize: 11, color: 'var(--bg)' }} />}
                  </span>
                  <span className="min-w-0 flex-1 break-words text-[12.5px] leading-snug text-[var(--ink)]">
                    {name}
                  </span>
                  {on && (
                    <span
                      aria-hidden
                      className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: color }}
                      title="Line color on plot"
                    />
                  )}
                </button>
              </li>
            )
          })
        )}
      </ul>
    </div>
  )
}
