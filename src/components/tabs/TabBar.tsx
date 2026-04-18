'use client'

import { useMemo, useState, type ReactNode } from 'react'
import Fuse from 'fuse.js'
import {
  Autocomplete,
  Chip,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material'
import type { AppTab, DatasetManifestEntry } from '@/types'

interface TabBarProps {
  currentTab: AppTab
  onTabChange: (tab: AppTab) => void
  datasetManifest: DatasetManifestEntry[]
  onSelectDataset: (dataset: DatasetManifestEntry) => void
}

const TABS: Array<{ id: AppTab; label: string }> = [
  { id: 'map', label: 'Map' },
  { id: 'plots', label: 'Plots' },
  { id: 'table', label: 'Table' },
  { id: 'sources', label: 'Sources' },
]

const MAX_FUSE_RESULTS = 220
const BROWSE_PREVIEW = 90

function getLevelChipStyles(level: 'district' | 'province' | 'national') {
  if (level === 'district') return { label: 'DISTRICT', className: 'bg-emerald-100 text-emerald-800' }
  if (level === 'province') return { label: 'PROVINCE', className: 'bg-amber-100 text-amber-800' }
  return { label: 'NATIONAL', className: 'bg-slate-200 text-slate-700' }
}

/** Map / Plots view pills — plain spans, no MuiBox. */
function viewIndicatorBlocks(option: DatasetManifestEntry): ReactNode[] {
  const blocks: ReactNode[] = []
  if (option.hasGeo) {
    blocks.push(
      <span
        key="map"
        className="inline-flex items-center justify-center rounded-md border border-sky-400/85 bg-sky-500/15 px-2 py-0.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
      >
        <span className="text-[0.58rem] font-extrabold leading-none tracking-[0.08em] text-sky-500">
          MAP
        </span>
      </span>,
    )
  }
  if (option.hasTime) {
    blocks.push(
      <span
        key="plot"
        className="inline-flex items-center justify-center rounded-md border border-violet-400/85 bg-violet-500/12 px-2 py-0.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
      >
        <span className="text-[0.58rem] font-extrabold leading-none tracking-[0.08em] text-violet-500">
          PLOT
        </span>
      </span>,
    )
  }
  return blocks
}

export default function TabBar({
  currentTab,
  onTabChange,
  datasetManifest,
  onSelectDataset,
}: TabBarProps) {
  const [inputValue, setInputValue] = useState('')

  const sortedManifest = useMemo(
    () => [...datasetManifest].sort((a, b) => a.name.localeCompare(b.name)),
    [datasetManifest],
  )

  const fuse = useMemo(
    () => new Fuse(datasetManifest, {
      keys: [
        'name',
        'description',
        'path',
        'tags',
        { name: 'searchHints', weight: 0.35 },
      ],
      threshold: 0.32,
      ignoreLocation: true,
    }),
    [datasetManifest],
  )

  const searchOptions = useMemo(() => {
    const q = inputValue.trim()
    if (!q) {
      return sortedManifest.slice(0, BROWSE_PREVIEW)
    }
    return fuse.search(q).map((r) => r.item).slice(0, MAX_FUSE_RESULTS)
  }, [fuse, inputValue, sortedManifest])

  return (
    <div
      className="w-full shrink-0 rounded-2xl border border-[var(--outline)] bg-[var(--surface)]/80 px-3 py-2 shadow-[0_12px_36px_rgba(0,0,0,0.12)] backdrop-blur-2xl text-[var(--on-surface)]"
    >
      <div className="flex min-h-[40px] items-center gap-2 sm:gap-3">
        <Tabs
          value={currentTab}
          onChange={(_, nextValue: AppTab) => onTabChange(nextValue)}
          textColor="inherit"
          indicatorColor="primary"
          sx={{
            minHeight: 36,
            flex: '0 0 auto',
            minWidth: 0,
            '& .MuiTabs-indicator': {
              height: 3,
              borderRadius: 999,
            },
            '& .MuiTab-root': {
              minHeight: 36,
              padding: '6px 12px',
              textTransform: 'none',
              fontWeight: 700,
              fontSize: 13,
              borderRadius: '10px',
              letterSpacing: '0.01em',
            },
          }}
        >
          {TABS.map((tab) => (
            <Tab key={tab.id} value={tab.id} label={tab.label} />
          ))}
        </Tabs>

        <Autocomplete
          className="min-w-0 flex-1"
          size="small"
          options={searchOptions}
          value={undefined}
          inputValue={inputValue}
          onInputChange={(_, value) => {
            setInputValue(value)
          }}
          onChange={(_, value) => {
            if (value) {
              onSelectDataset(value)
              setInputValue('')
            }
          }}
          blurOnSelect
          disableClearable
          filterOptions={(options) => options}
          isOptionEqualToValue={(a, b) => a.id === b.id}
          getOptionLabel={(option) => option.name}
          renderOption={(props, option) => {
            const levelChip = getLevelChipStyles(option.level)
            const viewBlocks = viewIndicatorBlocks(option)
            return (
              <li {...props}>
                <div className="flex w-full items-center justify-between gap-2 py-2">
                  <div className="min-w-0 flex-1">
                    <Typography variant="body2" className="font-semibold truncate">
                      {option.name}
                    </Typography>
                    <Typography variant="caption" className="opacity-65 truncate block">
                      {option.source === 'ldflk' ? 'LDFLK' : 'LDS'}
                      {' · '}
                      {option.years[0]}
                      {option.years.length > 1 ? ` to ${option.years[option.years.length - 1]}` : ''}
                    </Typography>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    {viewBlocks.length > 0 && (
                      <div className="flex flex-wrap items-center justify-end gap-1.5">
                        {viewBlocks}
                      </div>
                    )}
                    <div className="flex flex-wrap items-center justify-end gap-1.5">
                      {option.hasGeo && (
                        <Chip label="GEO" size="small" className="bg-emerald-100 text-emerald-800 font-bold" sx={{ height: 18, fontSize: '0.58rem' }} />
                      )}
                      {option.hasTime && (
                        <Chip label="TIME" size="small" className="bg-violet-100 text-violet-800 font-bold" sx={{ height: 18, fontSize: '0.58rem' }} />
                      )}
                      <Chip
                        label={levelChip.label}
                        size="small"
                        className={`${levelChip.className} font-semibold`}
                        sx={{ height: 20, fontSize: '0.65rem' }}
                      />
                    </div>
                  </div>
                </div>
              </li>
            )
          }}
          renderInput={(params) => (
            <TextField
              {...params}
              placeholder="Search to open a dataset…"
              variant="outlined"
              sx={{
                '& .MuiOutlinedInput-root': {
                  borderRadius: '12px',
                  backgroundColor: 'color-mix(in srgb, var(--surface) 88%, transparent)',
                },
              }}
            />
          )}
          ListboxProps={{
            sx: { maxHeight: 320 },
          }}
        />
      </div>
    </div>
  )
}
