import { Loader2, PackageCheck, ServerCrash, ServerCog } from 'lucide-react'
import { useBackendHealth } from '../hooks/useBackendHealth'
import type { ConnectionState } from '../types/health'

const STATUS: Record<ConnectionState, { label: string; className: string }> = {
  checking: { label: 'Checking connection…', className: 'bg-slate-100 text-slate-700' },
  online: { label: 'Backend online', className: 'bg-emerald-100 text-emerald-800' },
  offline: { label: 'Backend offline', className: 'bg-red-100 text-red-800' },
}

function StatusIcon({ state }: { state: ConnectionState }) {
  if (state === 'checking') return <Loader2 className="size-4 animate-spin" aria-hidden />
  if (state === 'online') return <ServerCog className="size-4" aria-hidden />
  return <ServerCrash className="size-4" aria-hidden />
}

export default function Landing() {
  const { state, health } = useBackendHealth()
  const { label, className } = STATUS[state]

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-slate-50 px-4 text-center">
      <PackageCheck className="size-14 text-indigo-600" aria-hidden />
      <div>
        <h1 className="text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">DockProof</h1>
        <p className="mt-2 text-lg text-slate-600">AI-powered delivery reconciliation</p>
      </div>
      <p
        role="status"
        className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium ${className}`}
      >
        <StatusIcon state={state} />
        {label}
        {health && <span className="opacity-70">· {health.service}</span>}
      </p>
    </main>
  )
}
