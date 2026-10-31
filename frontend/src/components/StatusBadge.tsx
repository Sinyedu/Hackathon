const STYLES: Record<string, { label: string; className: string }> = {
  ready: { label: 'Ready for approval', className: 'bg-emerald-100 text-emerald-800' },
  needs_review: { label: 'Needs review', className: 'bg-amber-100 text-amber-800' },
  approved: { label: 'Approved', className: 'bg-indigo-100 text-indigo-800' },
  failed: { label: 'Failed', className: 'bg-red-100 text-red-800' },
}

export default function StatusBadge({ status }: { status: string }) {
  const { label, className } = STYLES[status] ?? { label: status, className: 'bg-slate-100 text-slate-700' }
  return <span className={`rounded-full px-3 py-1 text-sm font-medium ${className}`}>{label}</span>
}
