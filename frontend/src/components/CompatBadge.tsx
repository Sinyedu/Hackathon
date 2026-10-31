import { Bot, ShieldCheck } from 'lucide-react'
import type { RecoveryOption } from '../types/recovery'

export default function CompatBadge({ option }: { option: RecoveryOption }) {
  if (option.verified) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-800">
        <ShieldCheck className="size-3.5" aria-hidden />
        {option.compatibility === 'exact' ? 'Verified match' : 'Verified, repackaged'}
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-2.5 py-0.5 text-xs font-medium text-violet-800">
      <Bot className="size-3.5" aria-hidden />AI-assessed substitute
    </span>
  )
}
