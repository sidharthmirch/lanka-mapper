import { describe, it, expect } from 'vitest'
import { prettifyDatasetName, cleanDatasetName } from './datasetNaming'

describe('prettifyDatasetName', () => {
  it('groups Agriculture-* under an Agriculture parent and trims the source tag', () => {
    expect(prettifyDatasetName('Agriculture-rubber (CBSL)')).toEqual({
      displayName: 'Rubber',
      category: 'Agriculture',
    })
    expect(prettifyDatasetName('Agriculture-subsidiary Food Crops (CBSL)')).toEqual({
      displayName: 'Subsidiary Food Crops',
      category: 'Agriculture',
    })
  })

  it('groups the long provincial-council revenue names and keeps only the distinctive tail', () => {
    expect(prettifyDatasetName('Analysis OF Revenue Collection OF Provincial Councils Excise Duties')).toEqual({
      displayName: 'Excise Duties',
      category: 'Provincial Council Revenue',
    })
  })

  it('assigns a topic category without changing an already-clean name', () => {
    expect(prettifyDatasetName('Unemployment Rate by District')).toEqual({
      displayName: 'Unemployment Rate by District',
      category: 'Labour & Employment',
    })
    expect(prettifyDatasetName('Population by District (Census)')).toEqual({
      displayName: 'Population by District (Census)',
      category: 'Population',
    })
  })

  it('leaves an uncategorizable name as-is with no category', () => {
    expect(prettifyDatasetName('Widget Index')).toEqual({ displayName: 'Widget Index' })
  })

  it('removes an explicit trailing US-dollar scale from the title and resolves its unit', () => {
    expect(prettifyDatasetName('Inflow of workers Remittances by country US Million')).toEqual({
      displayName: 'Inflow of Workers Remittances by Country',
      category: undefined,
      unit: 'US$ Mn',
    })
  })
})

describe('cleanDatasetName', () => {
  it('down-cases shouty connectors and ALL-CAPS words, preserves acronyms', () => {
    expect(cleanDatasetName('REVENUE OF GDP BY District')).toBe('Revenue of GDP by District')
  })
})
