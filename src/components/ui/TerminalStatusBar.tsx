'use client'

import { IconButton, Tooltip, CircularProgress } from '@mui/material'
import SyncIcon from '@mui/icons-material/Sync'
import DarkModeOutlinedIcon from '@mui/icons-material/DarkModeOutlined'
import LightModeOutlinedIcon from '@mui/icons-material/LightModeOutlined'
import type { AppTab, DatasetSource } from '@/types'
import { sourceShortLabel } from '@/lib/sourceLabels'

export type TerminalLink = 'live' | 'loading' | 'error'

interface TerminalStatusBarProps {
  link: TerminalLink
  errorMessage?: string | null
  datasetName: string | null
  source: DatasetSource | null
  level: 'district' | 'province' | 'national' | null
  unit: string | null
  currentYear: number
  years: number[]
  currentTab: AppTab
  catalogTotal: number
  lastSyncLabel: string
  catalogLoading: boolean
  onSync: () => void
  isDark: boolean
  onToggleTheme: () => void
}

const LINK_TEXT: Record<TerminalLink, string> = {
  live: 'LIVE',
  loading: 'SYNC',
  error: 'ERR',
}

function sourceLabel(source: DatasetSource | null): string {
  return source ? sourceShortLabel(source) : '—'
}

function Cell({ children }: { children: React.ReactNode }) {
  return <span className="flex items-center gap-1.5 whitespace-nowrap">{children}</span>
}

function Rule() {
  return <span aria-hidden className="h-3.5 w-px shrink-0 bg-[var(--border-2)]" />
}

/**
 * Wordmark-free terminal header. Left: a cursor mark + link state. Middle: the
 * active-dataset readout (what the desk is showing). Right: catalog size, last
 * sync (click to refresh), and the light/dark toggle. Everything numeric is mono
 * + tabular so the row reads like an instrument panel, not a navbar.
 */
export default function TerminalStatusBar({
  link,
  errorMessage,
  datasetName,
  source,
  level,
  unit,
  currentYear,
  years,
  currentTab,
  catalogTotal,
  lastSyncLabel,
  catalogLoading,
  onSync,
  isDark,
  onToggleTheme,
}: TerminalStatusBarProps) {
  const sortedYears = [...years].sort((a, b) => a - b)
  const first = sortedYears[0]
  const last = sortedYears[sortedYears.length - 1]
  const hasSpan = sortedYears.length > 1 && first !== last
  const linkColor =
    link === 'error' ? 'var(--bad)' : link === 'loading' ? 'var(--amber)' : 'var(--good)'

  return (
    <header
      data-testid="terminal-status-bar"
      className="flex w-full shrink-0 items-center gap-2.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-[var(--ink)] shadow-[var(--shadow-sm)] sm:gap-3 sm:px-3.5"
      style={{ fontFamily: 'var(--font-mono), ui-monospace, SFMono-Regular, Menlo, monospace' }}
    >
      {/* Cursor mark + wordmark */}
      <span
        aria-hidden
        className="hidden h-3.5 w-2 shrink-0 sm:block"
        style={{
          background: 'var(--accent)',
          boxShadow: '0 0 10px color-mix(in oklab, var(--accent) 55%, transparent)',
        }}
      />
      <span className="hidden shrink-0 whitespace-nowrap text-[12px] font-semibold tracking-[0.01em] text-[var(--ink)] sm:inline">
        Lanka Mapper
      </span>

      {/* Link state */}
      <Cell>
        {link === 'loading' ? (
          <CircularProgress size={9} thickness={6} sx={{ color: linkColor }} />
        ) : (
          <span className={link === 'live' ? 'live-dot' : ''} style={link === 'live' ? undefined : { width: 7, height: 7, borderRadius: 999, background: linkColor, display: 'inline-block' }} />
        )}
        <span
          className="text-[10px] font-semibold tracking-[0.12em]"
          style={{ color: linkColor }}
          title={link === 'error' && errorMessage ? errorMessage : undefined}
        >
          {LINK_TEXT[link]}
        </span>
      </Cell>

      <Rule />

      {/* Active dataset readout */}
      <div className="flex min-w-0 flex-1 items-center gap-2.5 overflow-hidden">
        {datasetName ? (
          <>
            <span className="truncate text-[12px] font-semibold text-[var(--ink)]" title={datasetName}>
              {datasetName}
            </span>
            <span className="hidden items-center gap-2.5 text-[10px] tracking-[0.06em] text-[var(--ink-3)] md:flex">
              <span>{sourceLabel(source)}</span>
              <span aria-hidden>·</span>
              <span className="uppercase">{level ?? '—'}</span>
              {unit && unit.trim() && unit.trim() !== '—' ? (
                <>
                  <span aria-hidden>·</span>
                  <span className="max-w-[14ch] truncate normal-case text-[var(--ink-2)]">{unit.trim()}</span>
                </>
              ) : null}
            </span>
          </>
        ) : (
          <span className="text-[11px] tracking-[0.08em] text-[var(--ink-3)]">NO DATASET LOADED</span>
        )}
      </div>

      {/* Year readout — only meaningful on map/plots */}
      {datasetName && (currentTab === 'map' || currentTab === 'plots') && Number.isFinite(currentYear) ? (
        <>
          <Rule />
          <Cell>
            <span className="text-[9px] tracking-[0.14em] text-[var(--ink-3)]">YR</span>
            <span className="tabular-nums text-[12px] font-semibold text-[var(--accent)]">
              {Math.round(currentYear)}
            </span>
            {hasSpan ? (
              <span className="hidden tabular-nums text-[10px] text-[var(--ink-3)] lg:inline">
                /{first}–{last}
              </span>
            ) : null}
          </Cell>
        </>
      ) : null}

      <Rule />

      {/* Catalog size */}
      <Cell>
        <span className="tabular-nums text-[12px] font-semibold text-[var(--ink)]">{catalogTotal.toLocaleString()}</span>
        <span className="hidden text-[9px] tracking-[0.14em] text-[var(--ink-3)] sm:inline">SETS</span>
      </Cell>

      <Rule />

      {/* Last sync / refresh */}
      <Tooltip title={catalogLoading ? 'Syncing catalog…' : 'Re-sync catalog'}>
        <button
          type="button"
          onClick={onSync}
          disabled={catalogLoading}
          aria-label="Re-sync dataset catalog"
          className="flex items-center gap-1.5 rounded-md border border-transparent px-1 py-0.5 text-[var(--ink-2)] transition-colors hover:border-[var(--border-2)] hover:text-[var(--ink)] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {catalogLoading ? (
            <CircularProgress size={11} thickness={6} sx={{ color: 'var(--ink-2)' }} />
          ) : (
            <SyncIcon sx={{ fontSize: 13 }} />
          )}
          <span className="hidden tabular-nums text-[11px] sm:inline">{lastSyncLabel}</span>
        </button>
      </Tooltip>

      <Rule />

      {/* Theme toggle */}
      <Tooltip title={isDark ? 'Switch to light' : 'Switch to dark'}>
        <IconButton
          onClick={onToggleTheme}
          size="small"
          aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
          sx={{
            width: 28,
            height: 28,
            color: 'var(--ink-2)',
            border: '1px solid var(--border)',
            borderRadius: '6px',
            '&:hover': { color: 'var(--ink)', borderColor: 'var(--border-2)', backgroundColor: 'var(--surface-2)' },
          }}
        >
          {isDark ? <LightModeOutlinedIcon sx={{ fontSize: 15 }} /> : <DarkModeOutlinedIcon sx={{ fontSize: 15 }} />}
        </IconButton>
      </Tooltip>
    </header>
  )
}
