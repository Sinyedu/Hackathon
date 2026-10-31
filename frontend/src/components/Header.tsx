import { Loader2, PackageCheck } from 'lucide-react'
import { useBackendHealth } from '../hooks/useBackendHealth'

const DOT = { checking: 'bg-slate-400', online: 'bg-emerald-500', offline: 'bg-red-500' } as const
const LABEL = { checking: 'Checking…', online: 'Backend online', offline: 'Backend offline' } as const

export default function Header({ onHome }: { onHome: () => void }) {
  const { state } = useBackendHealth()
  return (
    <header className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3">
      <button onClick={onHome} className="flex items-center gap-2 text-left">
        <PackageCheck className="size-6 text-indigo-600" aria-hidden />
        <span className="text-lg font-bold text-slate-900">DockProof</span>
        <span className="hidden text-sm text-slate-500 sm:inline">AI-powered delivery reconciliation</span>
      </button>
      <p role="status" className="flex items-center gap-2 text-sm text-slate-600">
        {state === 'checking' ? <Loader2 className="size-3 animate-spin" aria-hidden /> : (
          <span className={`size-2.5 rounded-full ${DOT[state]}`} aria-hidden />
        )}
        {LABEL[state]}
      </p>
    </header>
  )
}
