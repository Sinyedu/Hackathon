import Header from './components/Header'
import { useHashRoute } from './hooks/useHashRoute'
import ReviewPage from './pages/ReviewPage'
import ScanPage from './pages/ScanPage'

export default function App() {
  const { id, open } = useHashRoute()
  return (
    <div className="min-h-screen bg-slate-50">
      <Header onHome={() => open(null)} />
      {id ? <ReviewPage key={id} id={id} onNewScan={() => open(null)} /> : <ScanPage onDone={open} />}
    </div>
  )
}
