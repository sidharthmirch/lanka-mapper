/**
 * Prettify upstream dataset names into short, readable display labels and group
 * them into parent categories. The raw upstream name is preserved separately
 * (DatasetManifestEntry.originalName) so it stays recoverable in the UI.
 *
 * Examples:
 *   "Agriculture-rubber (CBSL)"                                  → { display: "Rubber", category: "Agriculture" }
 *   "Analysis OF Revenue Collection OF Provincial Councils Excise Duties"
 *                                                                → { display: "Excise Duties", category: "Provincial Council Revenue" }
 *   "Unemployment Rate by District"                             → { display: "Unemployment Rate by District", category: "Labour & Employment" }
 */

import { normalizePresentationText } from './presentationText'

/** Connector words lowercased mid-title (never at position 0). */
const LOWER_WORDS = new Set([
  'of', 'and', 'by', 'in', 'on', 'for', 'to', 'the', 'a', 'an', 'vs', 'per', 'at', 'with', 'from',
])

/** Redundant trailing source/agency tag — the source is shown separately in the UI. */
const SOURCE_TAG = /\s*\((?:CBSL|DCS|CBS|GOV\.?LK|LDFLK|LDS|NADA|SLBFE|CEB|IRD|HIES|ESS)\)\s*$/i

/** Topic keyword → parent category. First match wins; order = specificity. */
// Patterns use a leading word boundary + stem (no trailing \b) so suffixes match
// (e.g. "unemploy" → "Unemployment"). Short ambiguous words are kept whole (\btea\b).
const TOPIC_RULES: Array<[RegExp, string]> = [
  [/revenue collection of provincial councils/i, 'Provincial Council Revenue'],
  [/\btea\b|\b(agricultur|paddy|rubber|coconut|cultivat|harvest|crop|fisher|livestock|plantation)/i, 'Agriculture'],
  [/\b(revenue|excise|dut(y|ies)|licen[sc]|tariff|customs|\btax)/i, 'Revenue & Taxation'],
  [/\b(population|census|demographic|migrat)/i, 'Population'],
  [/\b(crime|police|offence|arrest|grave)/i, 'Crime & Safety'],
  [/\b(employ|unemploy|labour|labor|workforce|wage|participation)/i, 'Labour & Employment'],
  [/\b(education|school|literac|student|universit|enrol|teacher)/i, 'Education'],
  [/\b(health|hospital|disease|mortal|medical|dengue|patient)/i, 'Health'],
  [/\b(tourism|tourist|accommodation|occupanc|hotel)/i, 'Tourism'],
  [/\b(energy|power|electricity|generation|hydro|solar|wind|grid)/i, 'Energy'],
  [/\b(export|import|trade)/i, 'Trade'],
  [/\b(gdp|gross domestic|econom|expenditure|income|poverty)/i, 'Economy'],
  [/\b(accident|road|transport|vehicle|traffic|railway)/i, 'Transport'],
]

function recase(word: string, index: number): string {
  if (index > 0 && LOWER_WORDS.has(word.toLowerCase())) return word.toLowerCase()
  // Preserve short acronyms (GDP, NCRE, LKR) and tokens that mix digits.
  if (/^[A-Z0-9]{2,5}$/.test(word) || /\d/.test(word)) return word
  // Down-case shouty ALL-CAPS words (REVENUE → Revenue).
  if (/^[A-Z][A-Z]+$/.test(word)) return word[0] + word.slice(1).toLowerCase()
  // Catalog paths frequently arrive as sentence case; make the display label
  // consistently title cased while retaining connector words above.
  if (/^[a-z][a-z]+$/.test(word)) return word[0].toUpperCase() + word.slice(1)
  return word
}

/** Normalize whitespace, drop the source tag, fix shouty casing. */
export function cleanDatasetName(raw: string): string {
  const stripped = normalizePresentationText((raw ?? '').replace(/\s+/g, ' ').trim().replace(SOURCE_TAG, '').trim())
  if (!stripped) return raw ?? ''
  const recased = stripped.split(' ').map(recase).join(' ')
  return recased.charAt(0).toUpperCase() + recased.slice(1)
}

export interface PrettyName {
  /** Short, readable label for display. */
  displayName: string
  /** Parent category for grouping, or undefined if it doesn't fit a known group. */
  category?: string
  /** Unit extracted from an unambiguous trailing title suffix. */
  unit?: string
}

export function prettifyDatasetName(raw: string): PrettyName {
  const sourceName = (raw ?? '').replace(/\s+/g, ' ').trim()
  const embeddedUnit = sourceName.match(/\s+(?:us\$?|usd)\s*(?:million|mn\.?)\s*$/i)
  const name = embeddedUnit
    ? sourceName.slice(0, embeddedUnit.index).trim()
    : sourceName
  if (!name) return { displayName: raw ?? '' }

  // Cluster: "Agriculture-rubber (CBSL)" → Agriculture / "Rubber"
  const agri = name.match(/^agriculture\s*[-:]\s*(.+)$/i)
  if (agri) return {
    displayName: cleanDatasetName(agri[1]),
    category: 'Agriculture',
    ...(embeddedUnit ? { unit: 'US$ Mn' } : {}),
  }

  // Cluster: "...Revenue Collection OF Provincial Councils <X>" → Provincial Council Revenue / "<X>"
  const pcr = name.match(/revenue collection of provincial councils\s+(.+)$/i)
  if (pcr) return {
    displayName: cleanDatasetName(pcr[1]),
    category: 'Provincial Council Revenue',
    ...(embeddedUnit ? { unit: 'US$ Mn' } : {}),
  }

  let category: string | undefined
  for (const [re, cat] of TOPIC_RULES) {
    if (re.test(name)) { category = cat; break }
  }
  return {
    displayName: cleanDatasetName(name),
    category,
    ...(embeddedUnit ? { unit: 'US$ Mn' } : {}),
  }
}
