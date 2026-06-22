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
}

function Rule() {
  return <span aria-hidden className="h-3.5 w-px shrink-0 bg-[var(--border-2)]" />
}

/**
 * Lean dataset header. Left: what the desk is showing — dataset name, source,
 * and the current leader (top region · value). Right: catalog size, last sync
 * (click to refresh), light/dark toggle. No wordmark, no link badge.
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
}: TerminalStatusBarProps) {
  const hasStat = topName != null && topValue != null && topValue > 0

  return (
    <header
      data-testid="terminal-status-bar"
      className="flex w-full shrink-0 items-center gap-2.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-[var(--ink)] shadow-[var(--shadow-sm)] sm:gap-3 sm:px-3.5"
      style={{ fontFamily: 'var(--font-mono), ui-monospace, SFMono-Regular, Menlo, monospace' }}
    >
      {/* Active dataset readout */}
      <div className="flex min-w-0 flex-1 items-center gap-2.5 overflow-hidden">
        {datasetName ? (
          <>
            <span className="truncate text-[12px] font-semibold text-[var(--ink)]" title={datasetName}>
              {datasetName}
            </span>
            <span className="hidden shrink-0 text-[10px] tracking-[0.06em] text-[var(--ink-3)] sm:inline">
              {source ? sourceShortLabel(source) : '—'}
            </span>
            {hasStat ? (
              <>
                <Rule />
                <span className="hidden min-w-0 items-baseline gap-1.5 md:flex" title={`Leader: ${topName}`}>
                  <span aria-hidden className="text-[10px] text-[var(--accent)]">▲</span>
                  <span className="max-w-[16ch] truncate text-[11px] font-semibold text-[var(--ink-2)]">{topName}</span>
                  <span className="tabular-nums text-[12px] font-semibold text-[var(--accent)]">
                    {formatMetricValue(topValue as number, unit, 'compact')}
                  </span>
                </span>
              </>
            ) : null}
          </>
        ) : (
          <span className="text-[11px] tracking-[0.08em] text-[var(--ink-3)]">NO DATASET LOADED</span>
        )}
      </div>

      <Rule />

      {/* Catalog size */}
      <span className="flex items-center gap-1.5 whitespace-nowrap">
        <span className="tabular-nums text-[12px] font-semibold text-[var(--ink)]">{catalogTotal.toLocaleString()}</span>
        <span className="hidden text-[9px] tracking-[0.14em] text-[var(--ink-3)] sm:inline">SETS</span>
      </span>

      <Rule />

      {/* Last sync / refresh */}
      <Tooltip title={catalogLoading ? 'Syncing catalog…' : 'Re-sync catalog'}>
        <span>
          <button
            type="button"
            onClick={onSync}
            disabled={catalogLoading}
            aria-label="Re-sync dataset catalog"
            className="flex min-h-[36px] items-center gap-1.5 rounded-md border border-transparent px-2 py-1 text-[var(--ink-2)] transition-colors hover:border-[var(--border-2)] hover:text-[var(--ink)] disabled:cursor-not-allowed disabled:opacity-60 sm:min-h-0 sm:px-1 sm:py-0.5"
          >
            {catalogLoading ? (
              <CircularProgress size={11} thickness={6} sx={{ color: 'var(--ink-2)' }} />
            ) : (
              <SyncIcon sx={{ fontSize: 13 }} />
            )}
            <span className="hidden tabular-nums text-[11px] sm:inline">{lastSyncLabel}</span>
          </button>
        </span>
      </Tooltip>

      <Rule />

      {/* Theme toggle */}
      <Tooltip title={isDark ? 'Switch to light' : 'Switch to dark'}>
        <IconButton
          onClick={onToggleTheme}
          size="small"
          aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
          sx={{
            width: { xs: 38, sm: 28 },
            height: { xs: 38, sm: 28 },
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
