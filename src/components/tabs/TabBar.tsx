'use client'

import { Box, Tab, Tabs } from '@mui/material'
import type { AppTab } from '@/types'

interface TabBarProps {
  currentTab: AppTab
  onTabChange: (tab: AppTab) => void
}

const TABS: Array<{ id: AppTab; label: string }> = [
  { id: 'map', label: 'Map' },
  { id: 'timeseries', label: 'Time Series' },
  { id: 'table', label: 'Table' },
]

export default function TabBar({ currentTab, onTabChange }: TabBarProps) {
  return (
    <Box className="fixed left-1/2 top-5 z-[980] -translate-x-1/2 rounded-2xl border border-white/30 bg-white/70 px-2 py-1 shadow-lg backdrop-blur-xl">
      <Tabs
        value={currentTab}
        onChange={(_, nextValue: AppTab) => onTabChange(nextValue)}
        textColor="inherit"
        indicatorColor="primary"
        sx={{
          minHeight: 36,
          '& .MuiTab-root': {
            minHeight: 36,
            padding: '6px 12px',
            textTransform: 'none',
            fontWeight: 600,
            fontSize: 13,
            borderRadius: '10px',
          },
        }}
      >
        {TABS.map((tab) => (
          <Tab key={tab.id} value={tab.id} label={tab.label} />
        ))}
      </Tabs>
    </Box>
  )
}
