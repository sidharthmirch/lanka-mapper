'use client'

import { useMemo, useState } from 'react'
import { Box, TextField, Typography } from '@mui/material'
import type { TabularData } from '@/types'

interface DataTableProps {
  tableData: TabularData | null
}

export default function DataTable({ tableData }: DataTableProps) {
  const [query, setQuery] = useState('')

  const rows = useMemo(() => {
    if (!tableData) return []
    if (!query.trim()) return tableData.rows
    const q = query.toLowerCase()
    return tableData.rows.filter((row) => row.some((cell) => String(cell).toLowerCase().includes(q)))
  }, [query, tableData])

  if (!tableData) {
    return (
      <Box className="h-full p-8 pt-24">
        <Box className="mx-auto max-w-4xl rounded-3xl border border-white/25 bg-white/75 p-6 shadow-lg backdrop-blur-xl">
          <Typography>No table data available for this dataset.</Typography>
        </Box>
      </Box>
    )
  }

  return (
    <Box className="h-full p-8 pt-24">
      <Box className="mx-auto h-full max-w-6xl rounded-3xl border border-white/25 bg-white/75 p-6 shadow-lg backdrop-blur-xl">
        <Box className="mb-4 flex items-center justify-between gap-3">
          <Typography variant="h6" className="font-semibold">Raw Data Table</Typography>
          <TextField
            size="small"
            placeholder="Filter rows"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </Box>
        <div className="h-[calc(100%-4rem)] overflow-auto rounded-xl border border-gray-100 bg-white">
          <table className="w-full min-w-[40rem] text-sm">
            <thead className="sticky top-0 bg-gray-50 text-left">
              <tr>
                {tableData.columns.map((column) => (
                  <th key={column} className="px-3 py-2 font-semibold text-gray-700">{column}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, rowIndex) => (
                <tr key={rowIndex} className="border-t border-gray-100">
                  {row.map((cell, cellIndex) => (
                    <td key={`${rowIndex}-${cellIndex}`} className="px-3 py-2 text-gray-600">
                      {String(cell)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Box>
    </Box>
  )
}
