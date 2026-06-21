import dynamic from 'next/dynamic'

const HomePage = dynamic(() => import('@/app/HomePage'), {
  ssr: false,
  loading: () => (
    <div className="flex h-screen w-screen items-center justify-center bg-[var(--bg)]">
      <div className="flex items-center gap-2.5">
        <span
          className="h-4 w-2 animate-pulse bg-[var(--accent)]"
          style={{ boxShadow: '0 0 12px color-mix(in oklab, var(--accent) 55%, transparent)' }}
        />
        <span className="mono text-[12px] uppercase tracking-[0.16em] text-[var(--ink-3)]">Lanka Mapper</span>
      </div>
    </div>
  ),
})

export default function Home() {
  return <HomePage />
}
