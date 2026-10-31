import { CircleCheck, Loader2 } from 'lucide-react'
import type { Reconciliation } from '../types/reconciliation'

interface Props {
  rec: Reconciliation
  dirty: boolean
  busy: boolean
  error: string | null
  onApprove: () => void
}

export default function ClaimPanel({ rec, dirty, busy, error, onApprove }: Props) {
  const claim = rec.claim
  if (!claim) {
    return <p className="rounded-xl bg-emerald-50 p-4 text-emerald-800">
      {rec.status === 'ready' ? 'No discrepancies found: nothing to claim.' : 'No claim yet: resolve the items needing review.'}
    </p>
  }
  if (claim.status === 'approved') {
    return (
      <p className="flex items-center gap-2 rounded-xl bg-indigo-50 p-4 text-indigo-900">
        <CircleCheck className="size-5" aria-hidden />
        Claim {claim.id} approved and saved{claim.approved_at ? ` on ${new Date(claim.approved_at).toLocaleString()}` : ''}.
      </p>
    )
  }
  const reason = dirty ? 'Save your corrections first.' : rec.status !== 'ready' ? 'Resolve the items needing review to approve.' : null
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="font-semibold text-slate-900">Draft claim {claim.id}</p>
      <p className="mb-3 text-sm text-slate-600">Nothing is sent to the supplier. Approving records the claim as approved.</p>
      {error && <p role="alert" className="mb-3 rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p>}
      <button onClick={onApprove} disabled={busy || reason !== null}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-3 font-semibold text-white hover:bg-indigo-700 disabled:bg-slate-300">
        {busy && <Loader2 className="size-4 animate-spin" aria-hidden />}Approve claim
      </button>
      {reason && <p className="mt-2 text-sm text-amber-700">{reason}</p>}
    </div>
  )
}
