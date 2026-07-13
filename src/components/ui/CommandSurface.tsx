'use client'

import TerminalStatusBar from '@/components/ui/TerminalStatusBar'
import TabBar from '@/components/tabs/TabBar'
import type { AppTab, DatasetManifestEntry, DatasetSource } from '@/types'

export interface CommandSurfaceProps {
  datasetName: string | null
  source: DatasetSource | null
  topName: string | null
  topValue: number | null
  unit: string | null
  catalogTotal: number
  lastSyncLabel: string
  catalogLoading: boolean
  onSync: () => void
  isDark: boolean
  onToggleTheme: () => void
  currentTab: AppTab
  onTabChange: (tab: AppTab) => void
  datasetManifest: DatasetManifestEntry[]
  onSelectDataset: (dataset: DatasetManifestEntry) => void
}

/**
 * Unified top command surface: brand + active dataset readout, restrained
 * catalog metadata, tabs, and toolbar catalog search — one panel, not nested boxes.
 */
export default function CommandSurface({
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
  currentTab,
  onTabChange,
  datasetManifest,
  onSelectDataset,
}: CommandSurfaceProps) {
  return (
    <header
      data-testid="command-surface"
      className="command-surface shrink-0 overflow-hidden rounded-md border border-[var(--border)] bg-[var(--surface)]"
    >
      <TerminalStatusBar
        datasetName={datasetName}
        source={source}
        topName={topName}
        topValue={topValue}
        unit={unit}
        catalogTotal={catalogTotal}
        lastSyncLabel={lastSyncLabel}
        catalogLoading={catalogLoading}
        onSync={onSync}
        isDark={isDark}
        onToggleTheme={onToggleTheme}
        embedded
      />
      <div className="border-t border-[var(--border)]/80" aria-hidden />
      <TabBar
        currentTab={currentTab}
        onTabChange={onTabChange}
        datasetManifest={datasetManifest}
        onSelectDataset={onSelectDataset}
        embedded
      />
    </header>
  )
}
