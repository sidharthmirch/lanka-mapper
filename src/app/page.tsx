import dynamic from 'next/dynamic'

const HomePage = dynamic(() => import('@/app/HomePage'), {
  ssr: false,
  loading: () => (
    <div className="h-screen w-screen flex items-center justify-center bg-[var(--bg)]">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[var(--accent)]" />
    </div>
  ),
})

export default function Home() {
  return <HomePage />
}
