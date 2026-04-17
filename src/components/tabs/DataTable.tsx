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
    const lowered = query.toLowerCase()
    return tableData.rows.filter((row) => row.some((cell) => String(cell).toLowerCase().includes(lowered)))
  }, [query, tableData])

  if (!tableData) {
    return (
      <Box className="h-full p-6 pt-4">
        <Box className="mx-auto max-w-4xl rounded-3xl border border-[var(--outline)] bg-[var(--surface)]/74 p-6 shadow-[0_18px_34px_rgba(0,0,0,0.1)] backdrop-blur-xl">
          <Typography>No table data available for this dataset.</Typography>
        </Box>
      </Box>
    )
  }

  return (
    <Box className="h-full p-6 pt-4">
      <Box className="mx-auto h-full max-w-[1300px] rounded-3xl border border-[var(--outline)] bg-[var(--surface)]/76 p-6 shadow-[0_18px_34px_rgba(0,0,0,0.1)] backdrop-blur-xl">
        <Box className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <Box>
            <Typography variant="h6" className="font-semibold tracking-tight">Raw Data Table</Typography>
            <Typography variant="caption" className="opacity-65">
              Showing {rows.length.toLocaleString()} row(s)
            </Typography>
          </Box>
          <TextField
            size="small"
            placeholder="Filter rows"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </Box>

        <div className="h-[calc(100%-4.5rem)] overflow-auto rounded-xl border border-[var(--outline)] bg-[var(--surface)]">
          <table className="w-full min-w-[40rem] text-sm">
            <thead className="sticky top-0 bg-[var(--surface-variant)] text-left">
              <tr>
                {tableData.columns.map((column) => (
                  <th key={column} className="px-3 py-2 font-semibold">{column}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, rowIndex) => (
                <tr key={rowIndex} className="border-t border-[var(--outline)]/70">
                  {row.map((cell, cellIndex) => (
                    <td key={`${rowIndex}-${cellIndex}`} className="px-3 py-2 opacity-85">
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
