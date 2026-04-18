'use client'

import type { ReactNode } from 'react'

const LDFLK_PORTAL_HREF = 'https://ldflk.github.io/datasets/'
const LDS_PORTAL_HREF = 'https://nuuuwan.github.io/lanka_data_search/'

const PILL_WRAP =
  'inline-flex items-center justify-center rounded-md border px-2 py-0.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]'

/** Matches MAP pill styling in toolbar search (sky). */
const LDFLK_WRAP = `${PILL_WRAP} border-sky-400/85 bg-sky-500/15`
const LDFLK_TEXT =
  'text-[0.58rem] font-extrabold leading-none tracking-[0.08em] text-sky-500'

/** Matches PLOT pill styling in toolbar search (violet). */
const LDS_WRAP = `${PILL_WRAP} border-violet-400/85 bg-violet-500/12`
const LDS_TEXT =
  'text-[0.58rem] font-extrabold leading-none tracking-[0.08em] text-violet-500'

/** No pointer until hover — then show link affordance (no underline by default). */
const LINK_AFFORDANCE =
  'cursor-default no-underline transition-[box-shadow,opacity] duration-150 hover:cursor-pointer hover:opacity-95 hover:shadow-[0_0_0_1px_rgba(255,255,255,0.12)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--surface)]'

export type CatalogUpstreamProvider = 'ldflk' | 'lds' | 'both'

export function LdflkPill() {
  return (
    <a
      href={LDFLK_PORTAL_HREF}
      target="_blank"
      rel="noopener noreferrer"
      className={`${LDFLK_WRAP} ${LINK_AFFORDANCE} focus-visible:ring-sky-400/45`}
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
      className={`${LDS_WRAP} ${LINK_AFFORDANCE} focus-visible:ring-violet-400/45`}
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
  return <LdsPill />
}
