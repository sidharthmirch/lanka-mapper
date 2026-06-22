'use client'

import { useMemo, useState, type ReactNode } from 'react'
import Fuse from 'fuse.js'
import {
  Autocomplete,
  IconButton,
  Chip,
  Switch,
  Tab,
  Tabs,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material'
import ShuffleIcon from '@mui/icons-material/Shuffle'
import type { AppTab, DatasetManifestEntry } from '@/types'
import { sourceShortLabel } from '@/lib/sourceLabels'

interface TabBarProps {
  currentTab: AppTab
  onTabChange: (tab: AppTab) => void
  datasetManifest: DatasetManifestEntry[]
  onSelectDataset: (dataset: DatasetManifestEntry) => void
  sidebarOpen: boolean
  showRandom: boolean
  randomDisabled: boolean
  onRandomPick: () => void
  showChoropleth: boolean
  onToggleChoropleth: (show: boolean) => void
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
  if (level === 'district') return { label: 'District', className: 'bg-[var(--surface-variant)] text-[var(--on-surface)]' }
  if (level === 'province') return { label: 'Province', className: 'bg-[var(--surface-variant)] text-[var(--on-surface)]' }
  return { label: 'National', className: 'bg-[var(--surface-variant)] text-[var(--on-surface)]' }
}

/** Map / Plots view pills — plain spans, no MuiBox. */
function viewIndicatorBlocks(option: DatasetManifestEntry): ReactNode[] {
  const blocks: ReactNode[] = []
  if (option.hasGeo) {
    blocks.push(
      <span
        key="map"
        className="inline-flex items-center justify-center rounded-md border border-[var(--outline)] bg-[var(--surface-variant)]/70 px-2 py-0.5"
      >
        <span className="text-[0.58rem] font-bold leading-none text-[var(--on-surface)]">
          Map
        </span>
      </span>,
    )
  }
  if (option.hasTime) {
    blocks.push(
      <span
        key="plot"
        className="inline-flex items-center justify-center rounded-md border border-[var(--outline)] bg-[var(--surface-variant)]/70 px-2 py-0.5"
      >
        <span className="text-[0.58rem] font-bold leading-none text-[var(--on-surface)]">
          Plot
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
  sidebarOpen,
  showRandom,
  randomDisabled,
  onRandomPick,
  showChoropleth,
  onToggleChoropleth,
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
        'originalName',
        'category',
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

  // Quick actions when the sidebar is collapsed: random pick on map / plots /
  // table (each can shuffle a dataset); region shading is map-only.
  const showCollapsedActions = !sidebarOpen && currentTab !== 'sources'

  return (
    <div
      className="w-full shrink-0 rounded-lg border border-[var(--outline)]/90 bg-[var(--surface)]/90 px-3 py-1.5 shadow-[var(--shadow-md)] text-[var(--on-surface)]"
    >
      <div className="flex min-h-[40px] flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:gap-3">
        <div className="flex min-w-0 flex-1 items-center gap-2">
        <Tabs
          value={currentTab}
          onChange={(_, nextValue: AppTab) => onTabChange(nextValue)}
          variant="scrollable"
          scrollButtons={false}
          textColor="inherit"
          indicatorColor="primary"
          sx={{
            minHeight: 44,
            flex: '1 1 auto',
            maxWidth: '100%',
            minWidth: 0,
            '& .MuiTabs-indicator': {
              height: 3,
              borderRadius: 999,
              background: 'var(--primary)',
            },
            '& .MuiTab-root': {
              minHeight: 44,
              minWidth: { xs: 72, lg: 84 },
              padding: { xs: '6px 12px', lg: '6px 14px' },
              fontFamily: 'var(--font-mono), ui-monospace, SFMono-Regular, Menlo, monospace',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              fontWeight: 600,
              fontSize: { xs: 11, lg: 11.5 },
              borderRadius: '6px',
              color: 'var(--on-surface-variant)',
              transition: 'background-color 180ms ease, color 180ms ease',
            },
            '& .MuiTab-root:hover': {
              color: 'var(--on-surface)',
            },
            '& .MuiTab-root.Mui-selected': {
              color: 'var(--on-surface)',
              backgroundColor: 'var(--surface-variant)',
            },
          }}
        >
          {TABS.map((tab) => (
            <Tab key={tab.id} value={tab.id} label={tab.label} />
          ))}
        </Tabs>

        {showCollapsedActions && (
          <div className="ml-auto flex shrink-0 items-center gap-1.5 rounded-md border border-[var(--outline)]/70 bg-[var(--surface-variant)]/40 px-1.5 py-1">
            {showRandom && (
              <Tooltip title="Random dataset">
                <span>
                  <IconButton
                    type="button"
                    size="small"
                    color="secondary"
                    onClick={onRandomPick}
                    disabled={randomDisabled}
                    aria-label="Random dataset"
                    className="border border-[var(--outline)]/70 bg-[var(--surface)]/65"
                  >
                    <ShuffleIcon fontSize="small" />
                  </IconButton>
                </span>
              </Tooltip>
            )}
            {currentTab === 'map' && (
              <Tooltip title="Region shading">
                <Switch
                  size="small"
                  checked={showChoropleth}
                  onChange={(_, checked) => onToggleChoropleth(checked)}
                  inputProps={{ 'aria-label': 'Region shading' }}
                />
              </Tooltip>
            )}
          </div>
        )}
        </div>

        <Autocomplete
          className="order-last w-full min-w-0 shrink sm:order-first sm:w-[min(380px,42vw)]"
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
                    <Typography variant="body2" className="font-semibold truncate" title={option.originalName ?? option.name}>
                      {option.name}
                    </Typography>
                    <Typography variant="caption" className="opacity-65 truncate block">
                      {option.category ? `${option.category} · ` : ''}
                      {sourceShortLabel(option.source)}
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
                        <Chip label="Geo" size="small" className="bg-[var(--surface-variant)] text-[var(--on-surface)] font-semibold" sx={{ height: 18, fontSize: '0.58rem', borderRadius: '6px' }} />
                      )}
                      {option.hasTime && (
                        <Chip label="Time" size="small" className="bg-[var(--surface-variant)] text-[var(--on-surface)] font-semibold" sx={{ height: 18, fontSize: '0.58rem', borderRadius: '6px' }} />
                      )}
                      <Chip
                        label={levelChip.label}
                        size="small"
                        className={`${levelChip.className} font-semibold`}
                        sx={{ height: 20, fontSize: '0.65rem', borderRadius: '8px' }}
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
              placeholder="Search datasets…"
              variant="outlined"
              sx={{
                '& .MuiOutlinedInput-root': {
                  borderRadius: '8px',
                  backgroundColor: 'var(--surface-2)',
                  fontSize: 13.5,
                  '& fieldset': {
                    borderColor: 'var(--outline)',
                  },
                  '&:hover fieldset': {
                    borderColor: 'var(--border-2)',
                  },
                  '&.Mui-focused fieldset': {
                    borderColor: 'var(--primary)',
                    borderWidth: '1px',
                  },
                },
                '& input::placeholder': {
                  color: 'var(--ink-3)',
                  opacity: 1,
                },
              }}
            />
          )}
          ListboxProps={{
            sx: { maxHeight: 320, p: 0.5 },
          }}
        />
      </div>
    </div>
  )
}
