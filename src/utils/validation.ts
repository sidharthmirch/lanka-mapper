import type { FeatureCollection } from 'geojson'

export function validateTabularData(data: unknown): { columns: string[]; rows: unknown[][] } | null {
  if (!data || typeof data !== 'object') return null
  
  const obj = data as Record<string, unknown>
  
  if (!Array.isArray(obj.columns) || !Array.isArray(obj.rows)) return null
  
  if (!obj.columns.every((c): c is string => typeof c === 'string')) return null
  
  return { columns: obj.columns, rows: obj.rows }
}

export function validateDistrictData(data: unknown): { district: string; value: number }[] | null {
  if (!Array.isArray(data)) return null
  
  const validated: { district: string; value: number }[] = []
  
  for (const item of data) {
    if (!item || typeof item !== 'object') continue
    
    const obj = item as Record<string, unknown>
    
    if (typeof obj.district !== 'string' || typeof obj.value !== 'number') continue
    
    if (obj.value < 0) continue
    
    validated.push({ district: obj.district, value: obj.value })
  }
  
  return validated.length > 0 ? validated : null
}

export function validateProvinceData(data: unknown): { province: string; value: number }[] | null {
  if (!Array.isArray(data)) return null
  
  const validated: { province: string; value: number }[] = []
  
  for (const item of data) {
    if (!item || typeof item !== 'object') continue
    
    const obj = item as Record<string, unknown>
    
    if (typeof obj.province !== 'string' || typeof obj.value !== 'number') continue
    
    if (obj.value < 0) continue
    
    validated.push({ province: obj.province, value: obj.value })
  }
  
  return validated.length > 0 ? validated : null
}

export function validateGeoJSON(data: unknown): FeatureCollection | null {
  if (!data || typeof data !== 'object') return null
  
  const obj = data as Record<string, unknown>
  
  if (obj.type !== 'FeatureCollection') return null
  
  if (!Array.isArray(obj.features)) return null
  
  return data as FeatureCollection
}
