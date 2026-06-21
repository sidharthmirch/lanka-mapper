'use client'

import { useMemo, useState } from 'react'
import { Box, TextField, Typography } from '@mui/material'
import type { TabularData } from '@/types'

interface DataTableProps {
  tableData: TabularData | null
}

function isNumericCell(cell: unknown): boolean {
  if (typeof cell === 'number') return Number.isFinite(cell)
  if (typeof cell !== 'string') return false
  const t = cell.trim()
  if (t === '') return false
  return /^-?\d{1,3}(,\d{3})*(\.\d+)?$/.test(t) || /^-?\d+(\.\d+)?$/.test(t)
}

export default function DataTable({ tableData }: DataTableProps) {
  const [query, setQuery] = useState('')

  const rows = useMemo(() => {
    if (!tableData) return []
    if (!query.trim()) return tableData.rows
    const lowered = query.toLowerCase()
    return tableData.rows.filter((row) => row.some((cell) => String(cell).toLowerCase().includes(lowered)))
  }, [query, tableData])

  // Infer per-column alignment from the first data row: numeric columns right-align.
  const columnIsNumeric = useMemo(() => {
    if (!tableData || tableData.rows.length === 0) return tableData?.columns.map(() => false) ?? []
    const sample = tableData.rows.find((r) => r.some((c) => c != null)) ?? tableData.rows[0]
    return tableData.columns.map((_, i) => isNumericCell(sample[i]))
  }, [tableData])

  if (!tableData) {
    return (
      <Box className="flex h-full items-center justify-center p-6">
        <Box className="rounded-md border border-[var(--border)] bg-[var(--surface-2)] px-6 py-5 text-center">
          <span className="term-label">No table</span>
          <Typography variant="body2" className="mt-1.5 text-[var(--ink-2)]">
            This dataset has no tabular layer. Try the Map or Plots tabs.
          </Typography>
        </Box>
      </Box>
    )
  }

  return (
    <Box className="h-full p-4 sm:p-5">
      <Box className="mx-auto flex h-full max-w-[1300px] flex-col rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-5">
        <Box className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <Box className="flex items-baseline gap-3">
            <span className="term-label">Raw Data Table</span>
            <span className="mono text-[11px] text-[var(--ink-3)]">
              {rows.length.toLocaleString()}
              {rows.length !== tableData.rows.length ? ` / ${tableData.rows.length.toLocaleString()}` : ''} rows
            </span>
          </Box>
          <TextField
            size="small"
            placeholder="Filter rows…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            sx={{
              '& .MuiOutlinedInput-root': {
                borderRadius: '6px',
                backgroundColor: 'var(--surface-2)',
                fontSize: 13,
                '& fieldset': { borderColor: 'var(--border)' },
                '&:hover fieldset': { borderColor: 'var(--border-2)' },
                '&.Mui-focused fieldset': { borderColor: 'var(--accent)' },
              },
            }}
          />
        </Box>

        <div className="min-h-0 flex-1 overflow-auto rounded-md border border-[var(--border)] bg-[var(--surface)]">
          <table className="w-full min-w-[40rem] border-collapse text-[13px]">
            <thead className="sticky top-0 z-10">
              <tr className="bg-[var(--surface-2)]">
                {tableData.columns.map((column, i) => (
                  <th
                    key={column}
                    className={`border-b border-[var(--border-2)] px-3 py-2 ${columnIsNumeric[i] ? 'text-right' : 'text-left'}`}
                  >
                    <span className="term-label">{column}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={tableData.columns.length} className="px-3 py-10 text-center text-[var(--ink-3)]">
                    No rows match “{query}”.
                  </td>
                </tr>
              ) : (
                rows.map((row, rowIndex) => (
                  <tr
                    key={rowIndex}
                    className="border-t border-[var(--border)]/60 transition-colors hover:bg-[var(--surface-2)]"
                  >
                    {row.map((cell, cellIndex) => (
                      <td
                        key={`${rowIndex}-${cellIndex}`}
                        className={`px-3 py-1.5 ${
                          columnIsNumeric[cellIndex]
                            ? 'mono tabular-nums text-right text-[var(--ink)]'
                            : 'text-left text-[var(--ink-2)]'
                        }`}
                      >
                        {String(cell)}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Box>
    </Box>
  )
}
