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
    <Box className="max-h-[calc(100vh-10rem)] overflow-hidden rounded-2xl border border-white/30 bg-white/80 p-3 shadow-lg backdrop-blur-xl">
      <button
        type="button"
        className="mb-2 flex w-full items-center justify-between rounded-xl px-2 py-1 text-left hover:bg-white/60"
        onClick={() => setCollapsed((prev) => !prev)}
      >
        <Typography variant="subtitle2" className="font-semibold">Rankings</Typography>
        {collapsed ? <KeyboardArrowDownIcon fontSize="small" /> : <KeyboardArrowUpIcon fontSize="small" />}
      </button>
      {!collapsed && (
        <Box className="max-h-[calc(100vh-15rem)] space-y-2 overflow-y-auto">
          {rows.map((row, index) => (
            <button
              type="button"
              key={`${row.name}-${index}`}
              onClick={() => onSelect(row.name)}
              className="w-full rounded-xl bg-white/70 px-3 py-2 text-left hover:bg-blue-50"
            >
              <div className="mb-1 flex items-center justify-between text-xs font-medium text-gray-700">
                <span>{row.name}</span>
                <span>{row.value.toLocaleString()}</span>
              </div>
              <div className="h-2 rounded-full bg-gray-100">
                <div
                  className="h-2 rounded-full bg-blue-500"
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
