import type { MapData } from '@/types'

export const PROVINCE_TO_DISTRICTS: Record<string, string[]> = {
  'Western Province': ['Colombo', 'Gampaha', 'Kalutara'],
  'Central Province': ['Kandy', 'Matale', 'Nuwara Eliya'],
  'Southern Province': ['Galle', 'Matara', 'Hambantota'],
  'Northern Province': ['Jaffna', 'Kilinochchi', 'Mannar', 'Vavuniya', 'Mullaitivu'],
  'Eastern Province': ['Batticaloa', 'Ampara', 'Trincomalee'],
  'North Western Province': ['Kurunegala', 'Puttalam'],
  'North Central Province': ['Anuradhapura', 'Polonnaruwa'],
  'Uva Province': ['Badulla', 'Moneragala'],
  'Sabaragamuwa Province': ['Ratnapura', 'Kegalle'],
}

export function lerpValues(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

export function buildMapDataInterpolated(
  seriesData: Record<string, Record<number, number>>,
  y0: number,
  y1: number,
  t: number,
  level: 'district' | 'province' | 'national' | null,
): MapData[] {
  if (!level || level === 'national') {
    return []
  }

  if (level === 'district') {
    return Object.keys(seriesData).map((name) => {
      const vals = seriesData[name]
      const v0 = vals[y0] ?? 0
      const v1 = vals[y1] ?? 0
      return { name, district: name, value: lerpValues(v0, v1, t) }
    })
  }

  const expanded: MapData[] = []
  for (const provinceName of Object.keys(seriesData)) {
    const vals = seriesData[provinceName]
    const v0 = vals[y0] ?? 0
    const v1 = vals[y1] ?? 0
    const value = lerpValues(v0, v1, t)
    const districts = PROVINCE_TO_DISTRICTS[provinceName] ?? []
    for (const d of districts) {
      expanded.push({ name: d, district: d, value, originalName: provinceName })
    }
  }
  return expanded
}
