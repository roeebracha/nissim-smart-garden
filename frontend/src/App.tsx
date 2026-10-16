import { useMemo } from 'react'
import { Dashboard } from '@/components/dashboard'
import { createDemoClient } from '@/demo/fixtures'
import { createHttpClient } from '@/lib/api'
import type { GardenClient } from '@/lib/types'

function clientFromLocation(search: string): GardenClient {
  const demo = new URLSearchParams(search).get('demo') === '1'
  if (demo) return createDemoClient()
  return createHttpClient(import.meta.env.VITE_API_BASE ?? 'http://localhost:3000')
}

export default function App() {
  const client = useMemo(() => clientFromLocation(window.location.search), [])
  return <Dashboard client={client} />
}
