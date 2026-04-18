import { describe, expect, it } from 'vitest'
import { normalizeDistrict, normalizeProvince } from './dataService'

describe('normalizeDistrict', () => {
  it('canonicalizes case + trailing "District" suffix', () => {
    expect(normalizeDistrict('colombo')).toBe('Colombo')
    expect(normalizeDistrict('COLOMBO')).toBe('Colombo')
    expect(normalizeDistrict('Colombo District')).toBe('Colombo')
    expect(normalizeDistrict('colombo district')).toBe('Colombo')
  })

  it('fixes known misspellings via the alias table', () => {
    expect(normalizeDistrict('Mullative')).toBe('Mullaitivu')
    expect(normalizeDistrict('Mullativu')).toBe('Mullaitivu')
    expect(normalizeDistrict('Mullaitivu')).toBe('Mullaitivu')
    expect(normalizeDistrict('Amparai')).toBe('Ampara')
    expect(normalizeDistrict('Puttalum')).toBe('Puttalam')
    expect(normalizeDistrict('Rathnapura')).toBe('Ratnapura')
    expect(normalizeDistrict('Monaragala')).toBe('Moneragala')
  })

  it('preserves multi-word canonicals like "Nuwara Eliya"', () => {
    expect(normalizeDistrict('Nuwara Eliya')).toBe('Nuwara Eliya')
    expect(normalizeDistrict('nuwara eliya')).toBe('Nuwara Eliya')
    expect(normalizeDistrict('Nuwara Eliya District')).toBe('Nuwara Eliya')
  })

  it('passes through unknown names unchanged (does not silently rename)', () => {
    // The alias table is hand-curated; anything outside it should flow
    // through so upstream callers can see and triage the miss.
    expect(normalizeDistrict('Narnia')).toBe('Narnia')
    expect(normalizeDistrict('  ')).toBe('  ')
  })
})

describe('normalizeProvince', () => {
  it('maps short keys to canonical "X Province" labels', () => {
    expect(normalizeProvince('Western')).toBe('Western Province')
    expect(normalizeProvince('western')).toBe('Western Province')
    expect(normalizeProvince('Central')).toBe('Central Province')
    expect(normalizeProvince('sabaragamuwa')).toBe('Sabaragamuwa Province')
    expect(normalizeProvince('uva')).toBe('Uva Province')
  })

  it('handles already-canonical inputs', () => {
    expect(normalizeProvince('Western Province')).toBe('Western Province')
    expect(normalizeProvince('Uva Province')).toBe('Uva Province')
  })

  it('handles hyphenated and spaced multi-word provinces', () => {
    expect(normalizeProvince('North Western')).toBe('North Western Province')
    expect(normalizeProvince('north-western')).toBe('North Western Province')
    expect(normalizeProvince('North Central')).toBe('North Central Province')
    expect(normalizeProvince('north-central')).toBe('North Central Province')
    expect(normalizeProvince('North Western Province')).toBe('North Western Province')
  })

  it('passes through unknown labels unchanged', () => {
    expect(normalizeProvince('Atlantis')).toBe('Atlantis')
  })
})
