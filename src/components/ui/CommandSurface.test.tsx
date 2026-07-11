/** @vitest-environment happy-dom */

import { describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { createElement } from 'react'
import CommandSurface from './CommandSurface'
import type { DatasetManifestEntry } from '@/types'

const sampleManifest: DatasetManifestEntry[] = [
  {
    id: 'test-district-pop',
    name: 'Population by District',
    originalName: 'Population by District',
    category: 'Demographics',
    description: 'Test dataset',
    path: '/test',
    source: 'ldflk',
    unit: 'persons',
    level: 'district',
    years: [2012, 2021],
    metrics: ['population'],
    defaultMetric: 'population',
    hasGeo: true,
    hasTime: true,
    tags: ['population'],
  },
]

describe('CommandSurface hierarchy', () => {
  it('renders a single command surface with brand, dataset title, tabs, and catalog search', () => {
    render(
      createElement(CommandSurface, {
        datasetName: 'Population by District',
        source: 'ldflk',
        topName: 'Colombo',
        topValue: 2450000,
        unit: 'persons',
        catalogTotal: 180,
        lastSyncLabel: '10:30 AM',
        catalogLoading: false,
        onSync: vi.fn(),
        isDark: true,
        onToggleTheme: vi.fn(),
        currentTab: 'map',
        onTabChange: vi.fn(),
        datasetManifest: sampleManifest,
        onSelectDataset: vi.fn(),
        sidebarOpen: true,
        showRandom: true,
        randomDisabled: false,
        onRandomPick: vi.fn(),
        showChoropleth: true,
        onToggleChoropleth: vi.fn(),
      }),
    )

    const surface = screen.getByTestId('command-surface')
    expect(surface.tagName).toBe('HEADER')

    expect(within(surface).getByTestId('command-brand')).toHaveTextContent('Lanka Mapper')
    expect(within(surface).getByTestId('active-dataset-title')).toHaveTextContent('Population by District')

    expect(within(surface).getByRole('tab', { name: 'Map' })).toBeInTheDocument()
    expect(within(surface).getByRole('tab', { name: 'Plots' })).toBeInTheDocument()
    expect(within(surface).getByPlaceholder('Search the catalog')).toBeInTheDocument()

    expect(within(surface).getByTestId('command-meta')).toBeInTheDocument()
    expect(within(surface).queryByTestId('terminal-status-bar')).not.toBeInTheDocument()
  })

  it('keeps catalog search separate from sidebar dataset selector semantics via aria label', () => {
    render(
      createElement(CommandSurface, {
        datasetName: 'Population by District',
        source: 'ldflk',
        topName: null,
        topValue: null,
        unit: null,
        catalogTotal: 180,
        lastSyncLabel: 'Never',
        catalogLoading: false,
        onSync: vi.fn(),
        isDark: false,
        onToggleTheme: vi.fn(),
        currentTab: 'map',
        onTabChange: vi.fn(),
        datasetManifest: sampleManifest,
        onSelectDataset: vi.fn(),
        sidebarOpen: false,
        showRandom: true,
        randomDisabled: false,
        onRandomPick: vi.fn(),
        showChoropleth: true,
        onToggleChoropleth: vi.fn(),
      }),
    )

    expect(screen.getByRole('combobox', { name: 'Search dataset catalog' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Random dataset' })).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: 'Region shading' })).toBeInTheDocument()
  })

  it('exposes accessible theme and sync controls in metadata strip', () => {
    render(
      createElement(CommandSurface, {
        datasetName: null,
        source: null,
        topName: null,
        topValue: null,
        unit: null,
        catalogTotal: 0,
        lastSyncLabel: 'Never',
        catalogLoading: false,
        onSync: vi.fn(),
        isDark: true,
        onToggleTheme: vi.fn(),
        currentTab: 'sources',
        onTabChange: vi.fn(),
        datasetManifest: [],
        onSelectDataset: vi.fn(),
        sidebarOpen: true,
        showRandom: false,
        randomDisabled: true,
        onRandomPick: vi.fn(),
        showChoropleth: true,
        onToggleChoropleth: vi.fn(),
      }),
    )

    expect(screen.getByRole('button', { name: 'Re-sync dataset catalog' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Switch to light theme' })).toBeInTheDocument()
  })
})
