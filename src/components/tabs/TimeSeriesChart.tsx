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
      ? 'nuuuwan / CBSL'
      : 'N/A'
  const names = useMemo(
    () => Object.keys(seriesData).sort((a, b) => a.localeCompare(b)),
    [seriesData],
  )
  const [selectedNames, setSelectedNames] = useState<string[]>(() => names.slice(0, 3))
  useEffect(() => {
    setSelectedNames(names.slice(0, 3))
  }, [names])

  const chartData = useMemo(() => {
    return years.map((year) => {
      const row: Record<string, number | string> = { year: String(year) }
      selectedNames.forEach((name) => {
        row[name] = seriesData[name]?.[year] ?? 0
      })
      return row
    })
  }, [years, selectedNames, seriesData])

  return (
    <Box className="h-full p-8 pt-24">
      <Box className="mx-auto h-full max-w-5xl rounded-3xl border border-white/25 bg-white/75 p-6 shadow-lg backdrop-blur-xl">
        <Box className="mb-5 flex items-center justify-between gap-3">
          <Box>
            <Typography variant="h6" className="font-semibold">Time Series</Typography>
            <Typography variant="caption" className="text-gray-500">
              Dataset: {datasetName}
            </Typography>
            <Typography variant="caption" className="block text-gray-500">
              Source: {sourceLabel} | Department: {secondarySource || 'N/A'} | Unit: {unit || 'N/A'}
            </Typography>
          </Box>
          <FormControl size="small" className="min-w-72">
            <InputLabel>Regions</InputLabel>
            <Select
              multiple
              label="Regions"
              value={selectedNames}
              onChange={(event) => setSelectedNames(event.target.value as string[])}
            >
              {names.map((name) => (
                <MenuItem key={name} value={name}>{name}</MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>
        <Box className="h-[calc(100%-6rem)]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="year" />
              <YAxis />
              <Tooltip />
              <Legend />
              {selectedNames.map((name, index) => (
                <Line
                  key={name}
                  dataKey={name}
                  type="monotone"
                  stroke={['#007AFF', '#5AC8FA', '#34C759', '#FF9500', '#AF52DE'][index % 5]}
                  strokeWidth={2}
                  dot={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </Box>
        <Typography variant="caption" className="mt-2 block text-gray-500">
          Attribution: data provided by selected source; department credit shown when available.
        </Typography>
      </Box>
    </Box>
  )
}
