'use client'

import { Box, Tab, Tabs, Typography } from '@mui/material'
import type { AppTab } from '@/types'

interface TabBarProps {
  currentTab: AppTab
  onTabChange: (tab: AppTab) => void
  totalDatasets: number
  lastSyncLabel: string
}

const TABS: Array<{ id: AppTab; label: string }> = [
  { id: 'map', label: 'Map' },
  { id: 'timeseries', label: 'Time Series' },
  { id: 'table', label: 'Table' },
]

export default function TabBar({ currentTab, onTabChange, totalDatasets, lastSyncLabel }: TabBarProps) {
  return (
    <Box className="fixed left-1/2 top-4 z-[980] -translate-x-1/2 rounded-2xl border border-[var(--outline)] bg-[var(--surface)]/88 px-3 py-2 shadow-[0_12px_36px_rgba(0,0,0,0.12)] backdrop-blur-xl min-w-[360px]">
      <Box className="flex items-center justify-between gap-3">
        <Tabs
          value={currentTab}
          onChange={(_, nextValue: AppTab) => onTabChange(nextValue)}
          textColor="inherit"
          indicatorColor="primary"
          sx={{
            minHeight: 36,
            '& .MuiTabs-indicator': {
              height: 3,
              borderRadius: 999,
            },
            '& .MuiTab-root': {
              minHeight: 36,
              padding: '6px 12px',
              textTransform: 'none',
              fontWeight: 700,
              fontSize: 13,
              borderRadius: '10px',
              letterSpacing: '0.01em',
            },
          }}
        >
          {TABS.map((tab) => (
            <Tab key={tab.id} value={tab.id} label={tab.label} />
          ))}
        </Tabs>

        <Box className="text-right">
          <Typography variant="caption" className="block font-semibold uppercase tracking-[0.12em] opacity-65 text-[9px]">
            Live Catalog
          </Typography>
          <Typography variant="caption" className="block font-semibold text-[11px]">
            {totalDatasets.toLocaleString()} datasets · {lastSyncLabel}
          </Typography>
        </Box>
      </Box>
    </Box>
  )
}
