import { Loader2, ScanLine } from 'lucide-react'
import { useEffect, useState } from 'react'
import FileSlot from '../components/FileSlot'
import { errorMessage } from '../lib/errors'
import { createReconciliation } from '../services/api'

export default function ScanPage({ onDone }: { onDone: (id: string) => void }) {
  const [purchaseOrder, setPurchaseOrder] = useState<File | null>(null)
  const [deliveryNote, setDeliveryNote] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const [seconds, setSeconds] = useState(0)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!busy) return
    const timer = setInterval(() => setSeconds((s) => s + 1), 1000)
    return () => clearInterval(timer)
  }, [busy])

  const submit = async () => {
    if (!purchaseOrder || !deliveryNote) return
    setSeconds(0)
    setBusy(true)
    setError(null)
    try {
      const rec = await createReconciliation({ purchaseOrder, deliveryNote })
      onDone(rec.id)
    } catch (e) {
      setError(errorMessage(e))
      setBusy(false)
    }
  }

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-4 px-4 py-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Scan your delivery</h1>
        <p className="text-slate-600">Scan the purchase order and the delivery note. DockProof compares them and prepares the supplier claim.</p>
      </div>
      <FileSlot title="1. Purchase order" hint="What you ordered" file={purchaseOrder} onChange={setPurchaseOrder} disabled={busy} />
      <FileSlot title="2. Delivery note" hint="What arrived" file={deliveryNote} onChange={setDeliveryNote} disabled={busy} />
      {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p>}
      <button onClick={submit} disabled={!purchaseOrder || !deliveryNote || busy}
        className="flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 text-lg font-semibold text-white hover:bg-indigo-700 disabled:bg-slate-300">
        {busy ? <Loader2 className="size-5 animate-spin" aria-hidden /> : <ScanLine className="size-5" aria-hidden />}
        {busy ? `Reading documents and matching products… ${seconds}s` : 'Reconcile'}
      </button>
    </main>
  )
}
