'use client'

import { useMemo } from 'react'
import { Box, Link, Typography } from '@mui/material'
import { formatMetricValue, isDisplayableUnit } from '@/lib/formatDataValue'
import { getSeriesColors } from '@/lib/uiThemePresets'
import { orderSeriesByMagnitude } from '@/lib/seriesOrder'
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
  /** Drives chart chrome + series palette so plots read in both registers. */
  isDark?: boolean
}

const PIE_MAX_CATEGORIES = 8

const MONO = 'var(--font-mono), ui-monospace, SFMono-Regular, Menlo, monospace'

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
  isDark = true,
}: TimeSeriesChartProps) {
  const sourceLabel = primarySource === 'ldflk'
    ? 'LDFLK'
    : primarySource === 'nuuuwan'
      ? 'LDS'
      : 'N/A'

  const chrome = isDark
    ? { grid: '#2a322b', tick: '#abb1a2', tooltipBg: '#161b18', tooltipBorder: '#3a423a', text: '#ece6db' }
    : { grid: '#e2dacb', tick: '#5e574b', tooltipBg: '#fdfbf6', tooltipBorder: '#cfc5b2', text: '#22201c' }
  const series = getSeriesColors(isDark)

  const tooltipProps = {
    contentStyle: {
      backgroundColor: chrome.tooltipBg,
      borderRadius: '7px',
      border: `1px solid ${chrome.tooltipBorder}`,
      boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
      color: chrome.text,
      fontFamily: MONO,
      fontSize: 12,
    },
    itemStyle: { fontWeight: 600, color: chrome.text },
    labelStyle: { color: chrome.tick, fontWeight: 600 },
    cursor: { fill: 'rgba(127,127,127,0.08)', stroke: chrome.grid },
  } as const

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

  // Render lines + legend largest → smallest so the plot reads in magnitude order.
  const orderedNames = useMemo(
    () => orderSeriesByMagnitude(seriesData, effectiveNames),
    [seriesData, effectiveNames],
  )

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
      <Box className="flex h-full items-center justify-center p-6">
        <Box className="rounded-md border border-[var(--border)] bg-[var(--surface-2)] px-6 py-5 text-center">
          <span className="term-label">No series</span>
          <Typography variant="body2" className="mt-1.5 text-[var(--ink-2)]">
            This dataset has no time series. Try another dataset or year range.
          </Typography>
        </Box>
      </Box>
    )
  }

  const modeLabel = plotMode === 'line' ? 'TIME SERIES' : plotMode === 'bar' ? 'BAR' : 'SHARE'
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

  const axisTick = { fontSize: 11, fill: chrome.tick, fontFamily: MONO }
  const lineEmpty = plotMode === 'line' && effectiveNames.length === 0

  return (
    <Box className="h-full p-4 sm:p-5">
      <Box className="mx-auto flex h-full max-w-[1200px] flex-col rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-5">
        <Box className="mb-3 flex flex-wrap items-start justify-between gap-3">
          <Box className="min-w-0">
            <Box className="flex items-center gap-2">
              <span className="term-label">Plots</span>
              <span className="mono text-[10px] tracking-[0.08em] text-[var(--accent)]">{modeLabel}</span>
            </Box>
            <Typography variant="body2" className="mt-1.5 truncate text-[13.5px] font-semibold text-[var(--ink)]" title={datasetName}>
              {datasetName}
            </Typography>
            <span className="mono mt-1 block text-[10.5px] text-[var(--ink-3)]">
              {sourceLabel} · {secondarySource || 'N/A'} · {unitCaption}
            </span>
            {citation && (
              <Typography variant="caption" className="mt-1 block text-[11px] text-[var(--ink-3)]">
                Cite as{' '}
                <Link
                  href={citationUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  underline="hover"
                  sx={{ color: 'var(--accent)', fontWeight: 600 }}
                >
                  {citation}
                </Link>
              </Typography>
            )}
          </Box>
        </Box>

        <Box className="min-h-0 flex-1">
          {lineEmpty && (
            <Box className="flex h-full min-h-[320px] items-center justify-center rounded-md border border-dashed border-[var(--border-2)] bg-[var(--surface-2)] px-6 text-center">
              <Box>
                <span className="term-label">No series selected</span>
                <Typography variant="body2" className="mt-1.5 text-[var(--ink-2)]">
                  Turn on “All series” in the sidebar, or pick series from the list.
                </Typography>
              </Box>
            </Box>
          )}

          {plotMode === 'line' && !lineEmpty && (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={lineChartData} margin={{ left: 6, right: 8, top: 8, bottom: 8 }}>
                <CartesianGrid strokeDasharray="2 4" stroke={chrome.grid} />
                <XAxis dataKey="year" tick={axisTick} stroke={chrome.grid} />
                <YAxis tick={axisTick} stroke={chrome.grid} label={{ value: yLabel, angle: -90, position: 'insideLeft', offset: 4, style: { fontSize: 10, fill: chrome.tick } }} />
                <Tooltip {...tooltipProps} formatter={(v, name) => [formatTooltipNumber(v), String(name)]} />
                <Legend wrapperStyle={{ fontSize: 11, color: chrome.tick }} />
                {orderedNames.map((name, index) => (
                  <Line
                    key={name}
                    dataKey={name}
                    type="monotone"
                    stroke={series[index % series.length]}
                    strokeWidth={2}
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
                <CartesianGrid strokeDasharray="2 4" stroke={chrome.grid} />
                <XAxis type="number" tick={axisTick} stroke={chrome.grid} />
                <YAxis dataKey="name" type="category" tick={axisTick} stroke={chrome.grid} width={110} />
                <Tooltip {...tooltipProps} formatter={(v, name) => [formatTooltipNumber(v), String(name)]} />
                <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                  {categoricalData.slice(0, 30).map((_, index) => (
                    <Cell key={index} fill={series[index % series.length]} />
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
                  innerRadius="38%"
                  paddingAngle={2}
                  stroke={chrome.tooltipBg}
                  strokeWidth={2}
                  label={(props: { name?: string; percent?: number }) => `${props.name ?? ''} (${((props.percent ?? 0) * 100).toFixed(1)}%)`}
                  labelLine={{ strokeWidth: 1, stroke: chrome.grid }}
                >
                  {categoricalData.map((_, index) => (
                    <Cell key={index} fill={series[index % series.length]} />
                  ))}
                </Pie>
                <Tooltip {...tooltipProps} formatter={(v, name) => [formatTooltipNumber(v), String(name)]} />
                <Legend wrapperStyle={{ fontSize: 11, color: chrome.tick }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </Box>
      </Box>
    </Box>
  )
}
