'use client'

import { useState } from 'react'
import { Box, Typography } from '@mui/material'
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown'
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp'
import type { MapData } from '@/types'

interface RankingsChartProps {
  data: MapData[]
  onSelect: (name: string) => void
}

export default function RankingsChart({ data, onSelect }: RankingsChartProps) {
  const [collapsed, setCollapsed] = useState(false)
  const rows = [...data]
    .sort((a, b) => b.value - a.value)
    .slice(0, 12)

  const maxValue = rows.length > 0 ? rows[0].value : 1

  return (
    <Box className="max-h-[calc(100vh-11rem)] overflow-hidden rounded-2xl border border-[var(--outline)] bg-[var(--surface)]/88 p-3 shadow-[0_12px_30px_rgba(0,0,0,0.14)] backdrop-blur-xl">
      <button
        type="button"
        className="mb-2 flex w-full items-center justify-between rounded-xl px-2 py-1 text-left hover:bg-[var(--surface-variant)]/55"
        onClick={() => setCollapsed((prev) => !prev)}
      >
        <Typography variant="subtitle2" className="font-semibold">Top Regions</Typography>
        {collapsed ? <KeyboardArrowDownIcon fontSize="small" /> : <KeyboardArrowUpIcon fontSize="small" />}
      </button>
      {!collapsed && (
        <Box className="max-h-[calc(100vh-16rem)] space-y-2 overflow-y-auto">
          {rows.map((row, index) => (
            <button
              type="button"
              key={`${row.name}-${index}`}
              onClick={() => onSelect(row.name)}
              className="w-full rounded-xl border border-[var(--outline)]/70 bg-[var(--surface)]/70 px-3 py-2 text-left hover:bg-sky-50"
            >
              <div className="mb-1 flex items-center justify-between text-xs font-semibold opacity-85">
                <span>{row.name}</span>
                <span>{row.value.toLocaleString()}</span>
              </div>
              <div className="h-2 rounded-full bg-[var(--surface-variant)]">
                <div
                  className="h-2 rounded-full bg-gradient-to-r from-[#5db8e8] to-[#2d7dc0]"
                  style={{ width: `${Math.max(2, (row.value / maxValue) * 100)}%` }}
                />
              </div>
            </button>
          ))}
        </Box>
      )}
    </Box>
  )
}
