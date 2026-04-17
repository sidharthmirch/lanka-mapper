'use client'

import { useEffect, useMemo, useState } from 'react'
import { Box, FormControl, InputLabel, MenuItem, Select, Typography } from '@mui/material'
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

interface TimeSeriesChartProps {
  years: number[]
  seriesData: Record<string, Record<number, number>>
  datasetName: string
  primarySource: 'ldflk' | 'nuuuwan' | null
  secondarySource: string | null
  unit: string | null
}

const SERIES_COLORS = ['#2f8fcd', '#de8a35', '#4da167', '#7c6ad8', '#cd5261', '#6f8a2d', '#228c99']

export default function TimeSeriesChart({
  years,
  seriesData,
  datasetName,
  primarySource,
  secondarySource,
  unit,
}: TimeSeriesChartProps) {
  const sourceLabel = primarySource === 'ldflk'
    ? 'Lanka Data Foundation (LDFLK)'
    : primarySource === 'nuuuwan'
      ? 'nuuuwan'
      : 'N/A'

  const names = useMemo(
    () => Object.keys(seriesData).sort((a, b) => a.localeCompare(b)),
    [seriesData],
  )

  const [selectedNames, setSelectedNames] = useState<string[]>(() => names.slice(0, 4))

  useEffect(() => {
    setSelectedNames(names.slice(0, 4))
  }, [names])

  const chartData = useMemo(() => years.map((year) => {
    const row: Record<string, number | string> = { year: String(year) }
    selectedNames.forEach((name) => {
      row[name] = seriesData[name]?.[year] ?? 0
    })
    return row
  }), [years, selectedNames, seriesData])

  if (names.length === 0) {
    return (
      <Box className="h-full p-6 pt-4">
        <Box className="h-full rounded-3xl border border-[var(--outline)] bg-[var(--surface)]/74 p-8 shadow-[0_18px_34px_rgba(0,0,0,0.1)] backdrop-blur-xl flex items-center justify-center text-center">
          <Box>
            <Typography variant="h6" className="font-semibold">No series available yet</Typography>
            <Typography variant="body2" className="opacity-70 mt-1">
              Try another dataset or year range.
            </Typography>
          </Box>
        </Box>
      </Box>
    )
  }

  return (
    <Box className="h-full p-6 pt-4">
      <Box className="mx-auto h-full max-w-[1200px] rounded-3xl border border-[var(--outline)] bg-[var(--surface)]/76 p-6 shadow-[0_18px_34px_rgba(0,0,0,0.1)] backdrop-blur-xl">
        <Box className="mb-5 flex flex-wrap items-start justify-between gap-3">
          <Box>
            <Typography variant="h6" className="font-semibold tracking-tight">Time Series Explorer</Typography>
            <Typography variant="caption" className="opacity-70 block">
              Dataset: {datasetName}
            </Typography>
            <Typography variant="caption" className="opacity-70 block">
              Source: {sourceLabel} · Department: {secondarySource || 'N/A'} · Unit: {unit || 'N/A'}
            </Typography>
          </Box>
          <FormControl size="small" className="min-w-[300px] max-w-full">
            <InputLabel>Series</InputLabel>
            <Select
              multiple
              label="Series"
              value={selectedNames}
              onChange={(event) => setSelectedNames(event.target.value as string[])}
            >
              {names.map((name) => (
                <MenuItem key={name} value={name}>{name}</MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>

        <Box className="h-[calc(100%-6.2rem)]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ left: 6, right: 8, top: 8, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(128, 140, 160, 0.35)" />
              <XAxis dataKey="year" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              {selectedNames.map((name, index) => (
                <Line
                  key={name}
                  dataKey={name}
                  type="monotone"
                  stroke={SERIES_COLORS[index % SERIES_COLORS.length]}
                  strokeWidth={2.25}
                  dot={false}
                  activeDot={{ r: 4 }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </Box>
      </Box>
    </Box>
  )
}
