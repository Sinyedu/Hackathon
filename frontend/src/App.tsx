import { lazy, Suspense } from 'react'
const LiveWorkspace = lazy(() => import('./pages/LiveWorkspace'))
const Companion = lazy(() => import('./companion/Companion'))

export default function App() {
  return <Suspense fallback={null}>{new URLSearchParams(location.search).has('companion') ? <Companion /> : <LiveWorkspace />}</Suspense>
}
