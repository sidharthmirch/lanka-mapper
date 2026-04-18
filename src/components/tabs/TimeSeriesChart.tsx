'use client'

import { useMemo } from 'react'
import { Box, Typography } from '@mui/material'
import { formatMetricValue, isDisplayableUnit } from '@/lib/formatDataValue'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

interface TimeSeriesChartProps {
  years: number[]
  seriesData: Record<string, Record<number, number>>
  datasetName: string
  primarySource: 'ldflk' | 'nuuuwan' | null
  secondarySource: string | null
  unit: string | null
  citation?: string
  citationUrl?: string
  yearRange: [number, number]
  selectedSeries: string[]
}

const SERIES_COLORS = ['#2f8fcd', '#de8a35', '#4da167', '#7c6ad8', '#cd5261', '#6f8a2d', '#228c99', '#c44dbd', '#3aa68c', '#d4a72c']
const PIE_MAX_CATEGORIES = 8

type PlotMode = 'line' | 'bar' | 'pie'

function inferPlotMode(years: number[], entityCount: number): PlotMode {
  if (years.length > 1) return 'line'
  if (entityCount <= PIE_MAX_CATEGORIES) return 'pie'
  return 'bar'
}

export default function TimeSeriesChart({
  years,
  seriesData,
  datasetName,
  primarySource,
  secondarySource,
  unit,
  citation,
  citationUrl,
  yearRange,
  selectedSeries,
}: TimeSeriesChartProps) {
  const sourceLabel = primarySource === 'ldflk'
    ? 'Lanka Data Foundation (LDFLK)'
    : primarySource === 'nuuuwan'
      ? 'Lanka Data Search (LDS)'
      : 'N/A'

  const sortedYears = useMemo(() => [...years].sort((a, b) => a - b), [years])

  const names = useMemo(
    () => Object.keys(seriesData).sort((a, b) => a.localeCompare(b)),
    [seriesData],
  )

  const plotMode = useMemo(
    () => inferPlotMode(sortedYears, names.length),
    [sortedYears, names.length],
  )

  const effectiveNames = useMemo(() => {
    if (names.length === 0) return []
    return selectedSeries.filter((n) => names.includes(n))
  }, [names, selectedSeries])

  const filteredYears = useMemo(
    () => sortedYears.filter((y) => y >= yearRange[0] && y <= yearRange[1]),
    [sortedYears, yearRange],
  )

  const lineChartData = useMemo(() => {
    if (plotMode !== 'line') return []

    return filteredYears.map((year) => {
      const row: Record<string, number | string> = { year: String(year) }
      effectiveNames.forEach((name) => {
        const raw = seriesData[name]?.[year]
        row[name] = raw !== undefined && Number.isFinite(raw) ? raw : 0
      })
      return row
    })
  }, [filteredYears, effectiveNames, seriesData, plotMode])

  const categoricalData = useMemo(() => {
    const targetYear = filteredYears[filteredYears.length - 1] ?? sortedYears[sortedYears.length - 1]
    if (!targetYear) return []

    return names
      .map((name) => ({
        name,
        value: seriesData[name]?.[targetYear] ?? 0,
      }))
      .filter((d) => d.value > 0)
      .sort((a, b) => b.value - a.value)
  }, [names, seriesData, filteredYears, sortedYears])

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

  const modeLabel = plotMode === 'line' ? 'Time Series' : plotMode === 'bar' ? 'Bar Chart' : 'Pie Chart'
  const yLabel = isDisplayableUnit(unit) ? unit!.trim() : 'Value'
  const unitCaption = isDisplayableUnit(unit) ? unit!.trim() : '—'

  const formatTooltipNumber = (v: unknown) => {
    if (v === undefined || v === null) return formatMetricValue(0, unit)
    if (typeof v === 'number') return formatMetricValue(v, unit)
    if (typeof v === 'string') return formatMetricValue(v === '' ? 0 : Number(v), unit)
    if (Array.isArray(v) && v.length > 0) {
      const x = v[0]
      return formatMetricValue(typeof x === 'number' ? x : Number(x), unit)
    }
    return formatMetricValue(Number(v), unit)
  }

  const lineEmpty = plotMode === 'line' && effectiveNames.length === 0

  return (
    <Box className="h-full p-6 pt-4">
      <Box className="mx-auto h-full max-w-[1200px] rounded-3xl border border-[var(--outline)] bg-[var(--surface)]/76 p-6 shadow-[0_18px_34px_rgba(0,0,0,0.1)] backdrop-blur-xl flex flex-col">
        <Box className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <Box>
            <Typography variant="h6" className="font-semibold tracking-tight">
              Data Plot Explorer
              <Typography component="span" variant="caption" className="ml-2 opacity-50 font-normal">
                ({modeLabel})
              </Typography>
            </Typography>
            <Typography variant="caption" className="opacity-70 block">
              Dataset: {datasetName}
            </Typography>
            <Typography variant="caption" className="opacity-70 block">
              Source: {sourceLabel} · Department: {secondarySource || 'N/A'} · Unit: {unitCaption}
            </Typography>
            {citation && (
              <Typography variant="caption" className="opacity-60 block">
                🎓 Cite as{' '}
                <a
                  href={citationUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline hover:opacity-100 font-semibold"
                >
                  {citation}
                </a>
              </Typography>
            )}
          </Box>
        </Box>

        <Box className="flex-1 min-h-0">
          {lineEmpty && (
            <Box className="flex h-full min-h-[320px] items-center justify-center rounded-2xl border border-dashed border-[var(--outline)] bg-[var(--surface)]/40 px-6 text-center">
              <Box>
                <Typography variant="subtitle1" className="font-semibold">No series selected</Typography>
                <Typography variant="body2" className="opacity-70 mt-1">
                  Use the sidebar to turn on &quot;All series&quot; or pick series in the list.
                </Typography>
              </Box>
            </Box>
          )}

          {plotMode === 'line' && !lineEmpty && (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={lineChartData} margin={{ left: 6, right: 8, top: 8, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(128, 140, 160, 0.35)" />
                <XAxis dataKey="year" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} label={{ value: yLabel, angle: -90, position: 'insideLeft', offset: 4, style: { fontSize: 10 } }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'rgba(249, 252, 255, 0.88)',
                    backdropFilter: 'blur(16px)',
                    WebkitBackdropFilter: 'blur(16px)',
                    borderRadius: '12px',
                    border: '1px solid rgba(76, 96, 120, 0.16)',
                    boxShadow: '0 8px 24px rgba(0, 0, 0, 0.14)',
                  }}
                  itemStyle={{ fontWeight: 600 }}
                  formatter={(v, name) => [formatTooltipNumber(v), String(name)]}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                {effectiveNames.map((name, index) => (
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
          )}

          {plotMode === 'bar' && (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={categoricalData.slice(0, 30)}
                layout="vertical"
                margin={{ left: 120, right: 20, top: 8, bottom: 8 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(128, 140, 160, 0.25)" />
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis
                  dataKey="name"
                  type="category"
                  tick={{ fontSize: 11 }}
                  width={110}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'rgba(249, 252, 255, 0.88)',
                    backdropFilter: 'blur(16px)',
                    WebkitBackdropFilter: 'blur(16px)',
                    borderRadius: '12px',
                    border: '1px solid rgba(76, 96, 120, 0.16)',
                    boxShadow: '0 8px 24px rgba(0, 0, 0, 0.14)',
                  }}
                  itemStyle={{ fontWeight: 600 }}
                  formatter={(v, name) => [formatTooltipNumber(v), String(name)]}
                />
                <Bar dataKey="value" radius={[0, 6, 6, 0]}>
                  {categoricalData.slice(0, 30).map((_, index) => (
                    <Cell key={index} fill={SERIES_COLORS[index % SERIES_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}

          {plotMode === 'pie' && (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={categoricalData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius="70%"
                  innerRadius="35%"
                  paddingAngle={2}
                  label={(props: { name?: string; percent?: number }) => `${props.name ?? ''} (${((props.percent ?? 0) * 100).toFixed(1)}%)`}
                  labelLine={{ strokeWidth: 1 }}
                >
                  {categoricalData.map((_, index) => (
                    <Cell key={index} fill={SERIES_COLORS[index % SERIES_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'rgba(249, 252, 255, 0.88)',
                    backdropFilter: 'blur(16px)',
                    WebkitBackdropFilter: 'blur(16px)',
                    borderRadius: '12px',
                    border: '1px solid rgba(76, 96, 120, 0.16)',
                    boxShadow: '0 8px 24px rgba(0, 0, 0, 0.14)',
                  }}
                  itemStyle={{ fontWeight: 600 }}
                  formatter={(v, name) => [formatTooltipNumber(v), String(name)]}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </Box>
      </Box>
    </Box>
  )
}
