/**
 * Small, evidence-based corrections for recurring upstream spelling mistakes.
 * These are presentation-only: the source value remains available for lookup
 * and provenance, while every user-facing surface receives the corrected text.
 */
export interface PresentationTextRule {
  from: string
  to: string
  description: string
}

export const PRESENTATION_TEXT_RULES: PresentationTextRule[] = [
  { from: 'Germeny', to: 'Germany', description: 'Country spelling correction' },
  { from: 'Nothern', to: 'Northern', description: 'Province spelling correction' },
  { from: 'Mulllativu', to: 'Mullaitivu', description: 'District spelling correction' },
  { from: 'Grevious', to: 'Grievous', description: 'Crime metric spelling correction' },
  { from: 'Grve', to: 'Grave', description: 'Crime metric spelling correction' },
  { from: 'irrrespective', to: 'irrespective', description: 'Crime metric spelling correction' },
  { from: 'Non Grievous', to: 'Non-grievous', description: 'Metric style normalization' },
]

const PRESENTATION_TEXT_REPLACEMENTS = PRESENTATION_TEXT_RULES.map((rule) => ({
  rule,
  pattern: new RegExp(`\\b${rule.from.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\$&')}\\b`, 'gi'),
}))

/** Apply only the narrowly documented corrections above. */
export function normalizePresentationText(raw: string): string {
  return PRESENTATION_TEXT_REPLACEMENTS.reduce(
    (text, { rule, pattern }) => text.replace(pattern, rule.to),
    raw,
  )
}
