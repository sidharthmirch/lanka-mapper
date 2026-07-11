'use client'

import { IconButton, Tooltip, CircularProgress } from '@mui/material'
import SyncIcon from '@mui/icons-material/Sync'
import DarkModeOutlinedIcon from '@mui/icons-material/DarkModeOutlined'
import LightModeOutlinedIcon from '@mui/icons-material/LightModeOutlined'
import type { DatasetSource } from '@/types'
import { sourceShortLabel } from '@/lib/sourceLabels'
import { formatMetricValue } from '@/lib/formatDataValue'

interface TerminalStatusBarProps {
  datasetName: string | null
  source: DatasetSource | null
  /** One headline stat from the active dataset — the current leader region. */
  topName: string | null
  topValue: number | null
  unit: string | null
  catalogTotal: number
  lastSyncLabel: string
  catalogLoading: boolean
  onSync: () => void
  isDark: boolean
  onToggleTheme: () => void
  /** When true, renders as the top row inside CommandSurface (no outer chrome). */
  embedded?: boolean
}

function Rule() {
  return <span aria-hidden className="h-3.5 w-px shrink-0 bg-[var(--border)]" />
}

/**
 * Top readout row: brand identity, active dataset title, leader stat, catalog meta.
 */
export default function TerminalStatusBar({
  datasetName,
  source,
  topName,
  topValue,
  unit,
  catalogTotal,
  lastSyncLabel,
  catalogLoading,
  onSync,
  isDark,
  onToggleTheme,
  embedded = false,
}: TerminalStatusBarProps) {
  const hasStat = topName != null && topValue != null && topValue > 0

  const inner = (
    <>
      {/* Brand + active dataset — visual hierarchy */}
      <div className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden sm:gap-2.5">
        <div
          data-testid="command-brand"
          className="flex shrink-0 items-center gap-1.5"
          title="Lanka Mapper"
        >
          <span
            aria-hidden
            className="h-2.5 w-2.5 shrink-0 rounded-[2px] bg-[var(--accent)]"
            style={{ boxShadow: '0 0 8px color-mix(in oklab, var(--accent) 45%, transparent)' }}
          />
          <span className="hidden font-serif-identity text-[11px] font-semibold tracking-[0.02em] text-[var(--ink-2)] sm:inline">
            Lanka Mapper
          </span>
        </div>

        <Rule />

        {datasetName ? (
          <div className="flex min-w-0 flex-1 items-baseline gap-2 overflow-hidden">
            <h1
              data-testid="active-dataset-title"
              className="min-w-0 truncate text-[13px] font-semibold leading-tight text-[var(--ink)] sm:text-[14px]"
              title={datasetName}
            >
              {datasetName}
            </h1>
            <span className="hidden shrink-0 text-[10px] tracking-[0.05em] text-[var(--ink-3)] md:inline">
              {source ? sourceShortLabel(source) : '—'}
            </span>
            {hasStat ? (
              <>
                <Rule />
                <span className="hidden min-w-0 items-baseline gap-1.5 lg:flex" title={`Leader: ${topName}`}>
                  <span aria-hidden className="text-[10px] text-[var(--accent)]">▲</span>
                  <span className="max-w-[14ch] truncate text-[11px] font-medium text-[var(--ink-2)]">{topName}</span>
                  <span className="mono tabular-nums text-[12px] font-semibold text-[var(--accent)]">
                    {formatMetricValue(topValue as number, unit, 'compact')}
                  </span>
                </span>
              </>
            ) : null}
          </div>
        ) : (
          <span className="mono text-[11px] tracking-[0.08em] text-[var(--ink-3)]">NO DATASET LOADED</span>
        )}
      </div>

      {/* Restrained catalog / sync / theme metadata */}
      <div
        data-testid="command-meta"
        className="flex shrink-0 items-center gap-2 sm:gap-2.5"
        style={{ fontFamily: 'var(--font-mono), ui-monospace, SFMono-Regular, Menlo, monospace' }}
      >
        <span className="flex items-center gap-1 whitespace-nowrap">
          <span className="tabular-nums text-[11px] font-semibold text-[var(--ink-2)]">{catalogTotal.toLocaleString()}</span>
          <span className="hidden text-[9px] tracking-[0.12em] text-[var(--ink-3)] sm:inline">SETS</span>
        </span>

        <Rule />

        <Tooltip title={catalogLoading ? 'Syncing catalog…' : 'Re-sync catalog'}>
          <span>
            <button
              type="button"
              onClick={onSync}
              disabled={catalogLoading}
              aria-label="Re-sync dataset catalog"
              className="flex min-h-[36px] items-center gap-1 rounded-md px-1.5 py-1 text-[var(--ink-3)] transition-colors hover:text-[var(--ink)] disabled:cursor-not-allowed disabled:opacity-60 sm:min-h-0 sm:px-1 sm:py-0.5"
            >
              {catalogLoading ? (
                <CircularProgress size={11} thickness={6} sx={{ color: 'var(--ink-3)' }} />
              ) : (
                <SyncIcon sx={{ fontSize: 13 }} />
              )}
              <span className="hidden tabular-nums text-[10px] sm:inline">{lastSyncLabel}</span>
            </button>
          </span>
        </Tooltip>

        <Rule />

        <Tooltip title={isDark ? 'Switch to light' : 'Switch to dark'}>
          <IconButton
            onClick={onToggleTheme}
            size="small"
            aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
            sx={{
              width: { xs: 36, sm: 28 },
              height: { xs: 36, sm: 28 },
              color: 'var(--ink-3)',
              borderRadius: '6px',
              '&:hover': { color: 'var(--ink)', backgroundColor: 'var(--surface-2)' },
            }}
          >
            {isDark ? <LightModeOutlinedIcon sx={{ fontSize: 15 }} /> : <DarkModeOutlinedIcon sx={{ fontSize: 15 }} />}
          </IconButton>
        </Tooltip>
      </div>
    </>
  )

  if (embedded) {
    return (
      <div className="flex w-full items-center gap-2 px-2.5 py-1.5 sm:gap-3 sm:px-3 sm:py-2">
        {inner}
      </div>
    )
  }

  return (
    <header
      data-testid="terminal-status-bar"
      className="flex w-full shrink-0 items-center gap-2.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 shadow-[var(--shadow-sm)] sm:gap-3 sm:px-3.5"
    >
      {inner}
    </header>
  )
}
