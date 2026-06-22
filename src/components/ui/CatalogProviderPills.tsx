'use client'

import type { ReactNode } from 'react'

const LDFLK_PORTAL_HREF = 'https://ldflk.github.io/datasets/'
const LDS_PORTAL_HREF = 'https://nuuuwan.github.io/lanka_data_search/'
const GOV_PORTAL_HREF = 'https://data.gov.lk/'

const PILL_WRAP =
  'inline-flex items-center justify-center rounded-md border border-[var(--outline)] bg-[var(--surface-variant)]/70 px-2 py-0.5'

/** Matches source pills in toolbar/sidebar search. */
const LDFLK_WRAP = PILL_WRAP
const LDFLK_TEXT =
  'text-[0.58rem] font-bold leading-none text-[var(--on-surface)]'

/** Matches source pills in toolbar/sidebar search. */
const LDS_WRAP = PILL_WRAP
const LDS_TEXT =
  'text-[0.58rem] font-bold leading-none text-[var(--on-surface)]'

/** No pointer until hover — then show link affordance (no underline by default). */
const LINK_AFFORDANCE =
  'cursor-default no-underline transition-[background-color,opacity] duration-150 hover:cursor-pointer hover:bg-[var(--surface-variant)] hover:opacity-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--surface)]'

export type CatalogUpstreamProvider = 'ldflk' | 'lds' | 'both' | 'gov'

export function GovPill() {
  return (
    <a
      href={GOV_PORTAL_HREF}
      target="_blank"
      rel="noopener noreferrer"
      className={`${PILL_WRAP} ${LINK_AFFORDANCE} focus-visible:ring-[var(--primary)]`}
      aria-label="Sri Lanka national open-data portal data.gov.lk (opens in new tab)"
    >
      <span className="text-[0.58rem] font-bold leading-none text-[var(--on-surface)]">GOV.LK</span>
    </a>
  )
}

export function LdflkPill() {
  return (
    <a
      href={LDFLK_PORTAL_HREF}
      target="_blank"
      rel="noopener noreferrer"
      className={`${LDFLK_WRAP} ${LINK_AFFORDANCE} focus-visible:ring-[var(--primary)]`}
      aria-label="Lanka Data Foundation catalog (opens in new tab)"
    >
      <span className={LDFLK_TEXT}>LDFLK</span>
    </a>
  )
}

export function LdsPill() {
  return (
    <a
      href={LDS_PORTAL_HREF}
      target="_blank"
      rel="noopener noreferrer"
      className={`${LDS_WRAP} ${LINK_AFFORDANCE} focus-visible:ring-[var(--primary)]`}
      aria-label="Lanka Data Search (opens in new tab)"
    >
      <span className={LDS_TEXT}>LDS</span>
    </a>
  )
}

export function CatalogProviderPills({
  provider,
}: {
  provider: CatalogUpstreamProvider
}): ReactNode {
  if (provider === 'both') {
    return (
      <span className="inline-flex flex-wrap items-center gap-1.5">
        <LdflkPill />
        <LdsPill />
      </span>
    )
  }
  if (provider === 'ldflk') {
    return <LdflkPill />
  }
  if (provider === 'gov') {
    return <GovPill />
  }
  return <LdsPill />
}
