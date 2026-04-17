import dynamic from 'next/dynamic'

const HomePage = dynamic(() => import('@/app/HomePage'), {
  ssr: false,
  loading: () => (
    <div className="h-screen w-screen flex items-center justify-center bg-gray-100">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
    </div>
  ),
})

export default function Home() {
  return <HomePage />
}
