'use client'

import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import { Box, Button, TextField, Typography, useMediaQuery } from '@mui/material'
import type { TabularData } from '@/types'

interface DataTableProps {
  tableData: TabularData | null
}

const DESKTOP_ROW_HEIGHT = 39
const ROW_OVERSCAN = 8
const MOBILE_PAGE_SIZE = 50
const MAX_UNVIRTUALIZED_ROWS = 500

function isNumericCell(cell: unknown): boolean {
  if (typeof cell === 'number') return Number.isFinite(cell)
  if (typeof cell !== 'string') return false
  const t = cell.trim()
  if (t === '') return false
  return /^-?\d{1,3}(,\d{3})*(\.\d+)?$/.test(t) || /^-?\d+(\.\d+)?$/.test(t)
}

export default function DataTable({ tableData }: DataTableProps) {
  const [query, setQuery] = useState('')
  const deferredQuery = useDeferredValue(query)
  const [scrollTop, setScrollTop] = useState(0)
  const [viewportHeight, setViewportHeight] = useState(0)
  const [showAllRows, setShowAllRows] = useState(false)
  const [mobileVisibleCount, setMobileVisibleCount] = useState(MOBILE_PAGE_SIZE)
  const tableViewportRef = useRef<HTMLDivElement | null>(null)
  const isMobile = useMediaQuery('(max-width: 599px)')

  const rows = useMemo(() => {
    if (!tableData) return []
    if (!deferredQuery.trim()) return tableData.rows
    const lowered = deferredQuery.toLowerCase()
    return tableData.rows.filter((row) => row.some((cell) => String(cell).toLowerCase().includes(lowered)))
  }, [deferredQuery, tableData])

  // Infer per-column alignment from the first data row: numeric columns right-align.
  const columnIsNumeric = useMemo(() => {
    if (!tableData || tableData.rows.length === 0) return tableData?.columns.map(() => false) ?? []
    const sample = tableData.rows.find((r) => r.some((c) => c != null)) ?? tableData.rows[0]
    return tableData.columns.map((_, i) => isNumericCell(sample[i]))
  }, [tableData])

  useEffect(() => {
    const viewport = tableViewportRef.current
    if (!viewport || isMobile) return

    const updateHeight = () => setViewportHeight(viewport.clientHeight)
    updateHeight()
    const observer = new ResizeObserver(updateHeight)
    observer.observe(viewport)
    return () => observer.disconnect()
  }, [isMobile, tableData])

  useEffect(() => {
    setScrollTop(0)
    setShowAllRows(false)
    setMobileVisibleCount(MOBILE_PAGE_SIZE)
    tableViewportRef.current?.scrollTo({ top: 0 })
  }, [deferredQuery, tableData])

  const visibleRange = useMemo(() => {
    const visibleRows = Math.ceil(viewportHeight / DESKTOP_ROW_HEIGHT)
    const start = Math.max(0, Math.floor(scrollTop / DESKTOP_ROW_HEIGHT) - ROW_OVERSCAN)
    const end = Math.min(rows.length, start + visibleRows + ROW_OVERSCAN * 2)
    return { start, end }
  }, [rows.length, scrollTop, viewportHeight])
  const desktopRows = showAllRows ? rows : rows.slice(visibleRange.start, visibleRange.end)
  const renderedRange = showAllRows ? { start: 0, end: rows.length } : visibleRange
  const mobileRows = rows.slice(0, mobileVisibleCount)

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
            <span className="term-label">Data Table</span>
            <span className="mono text-[11px] text-[var(--ink-3)]">
              {rows.length.toLocaleString()}
              {rows.length !== tableData.rows.length ? ` / ${tableData.rows.length.toLocaleString()}` : ''} rows
            </span>
            {!isMobile && rows.length > ROW_OVERSCAN * 3 && rows.length <= MAX_UNVIRTUALIZED_ROWS && (
              <Button
                size="small"
                variant="text"
                onClick={() => setShowAllRows((show) => !show)}
                sx={{ minHeight: 28, px: 0.75, fontSize: '0.7rem' }}
              >
                {showAllRows ? 'Virtualize rows' : 'Show all rows'}
              </Button>
            )}
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
        <Typography variant="caption" className="mb-3 text-[10.5px] text-[var(--ink-3)]">
          Display-normalized labels; numeric values and upstream source records are unchanged.
        </Typography>

        {rows.length === 0 ? (
          <div className="flex min-h-0 flex-1 items-center justify-center rounded-md border border-[var(--border)] text-[13px] text-[var(--ink-3)]">
            No rows match “{query}”.
          </div>
        ) : (
          <>
            {!isMobile ? (
              <div
                ref={tableViewportRef}
                onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
                className="min-h-0 flex-1 overflow-auto rounded-md border border-[var(--border)] bg-[var(--surface)]"
              >
              <table
                className="w-full min-w-[34rem] border-collapse text-[13px]"
                aria-rowcount={rows.length}
                aria-colcount={tableData.columns.length}
              >
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
                  {renderedRange.start > 0 && (
                    <tr aria-hidden>
                      <td colSpan={tableData.columns.length} className="p-0" style={{ height: renderedRange.start * DESKTOP_ROW_HEIGHT }} />
                    </tr>
                  )}
                  {desktopRows.map((row, visibleIndex) => {
                    const rowIndex = renderedRange.start + visibleIndex
                    return (
                    <tr
                      key={rowIndex}
                      aria-rowindex={rowIndex + 2}
                      style={{ height: DESKTOP_ROW_HEIGHT }}
                      className="border-t border-[var(--border)]/60 transition-colors hover:bg-[var(--surface-2)]"
                    >
                      {row.map((cell, cellIndex) => (
                        <td
                          key={`${rowIndex}-${cellIndex}`}
                          className={`whitespace-nowrap px-3 py-1.5 ${
                            columnIsNumeric[cellIndex]
                              ? 'mono tabular-nums text-right text-[var(--ink)]'
                              : 'text-left text-[var(--ink-2)]'
                          }`}
                        >
                          {String(cell)}
                        </td>
                      ))}
                    </tr>
                    )
                  })}
                  {renderedRange.end < rows.length && (
                    <tr aria-hidden>
                      <td colSpan={tableData.columns.length} className="p-0" style={{ height: (rows.length - renderedRange.end) * DESKTOP_ROW_HEIGHT }} />
                    </tr>
                  )}
                </tbody>
              </table>
              </div>

            ) : (
            <div className="min-h-0 flex-1 space-y-2 overflow-auto">
              {mobileRows.map((row, rowIndex) => (
                <div key={rowIndex} className="rounded-md border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2">
                  {tableData.columns.map((col, ci) => (
                    <div key={ci} className="flex items-baseline justify-between gap-3 py-0.5">
                      <span className="term-label shrink-0">{col}</span>
                      <span
                        className={`min-w-0 break-words text-right text-[13px] ${
                          columnIsNumeric[ci] ? 'mono tabular-nums text-[var(--ink)]' : 'text-[var(--ink-2)]'
                        }`}
                      >
                        {String(row[ci])}
                      </span>
                    </div>
                  ))}
                </div>
              ))}
              {mobileVisibleCount < rows.length && (
                <Button
                  fullWidth
                  size="small"
                  variant="outlined"
                  onClick={() => setMobileVisibleCount((count) => Math.min(count + MOBILE_PAGE_SIZE, rows.length))}
                >
                  Show {Math.min(MOBILE_PAGE_SIZE, rows.length - mobileVisibleCount)} more rows
                </Button>
              )}
            </div>
            )}
          </>
        )}
      </Box>
    </Box>
  )
}
