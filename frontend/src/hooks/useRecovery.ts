import { useCallback, useEffect, useState } from 'react'
import { errorMessage } from '../lib/errors'
import {
  createReplacementOrder,
  decideReplacementOrder,
  findRecovery,
  getRecoveryPlan,
} from '../services/api'
import type { Priority, RecoveryPlan, ReplacementOrder } from '../types/recovery'

type Busy = 'find' | 'order' | 'decide' | null

/** Recovery state for one shortage. Everything shown comes from the backend response. */
export function useRecovery(reconciliationId: string, itemId: string) {
  const [plan, setPlan] = useState<RecoveryPlan | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [busy, setBusy] = useState<Busy>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    getRecoveryPlan(reconciliationId, itemId)
      .then((p) => !cancelled && setPlan(p))
      .catch((e: unknown) => !cancelled && setError(errorMessage(e)))
      .finally(() => !cancelled && setLoaded(true))
    return () => {
      cancelled = true
    }
  }, [reconciliationId, itemId])

  const run = useCallback(async (kind: Exclude<Busy, null>, action: () => Promise<void>) => {
    setBusy(kind)
    setError(null)
    try {
      await action()
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(null)
    }
  }, [])

  const find = (priority: Priority) =>
    run('find', async () => setPlan(await findRecovery(reconciliationId, itemId, priority)))

  const putOrder = (order: ReplacementOrder) =>
    setPlan((p) => p && { ...p, orders: [...p.orders.filter((o) => o.id !== order.id), order] })

  const createOrder = (optionId: string) =>
    run('order', async () => {
      if (plan) putOrder(await createReplacementOrder(plan.id, optionId))
    })

  const decide = (orderId: string, decision: 'approve' | 'reject', confirm: boolean) =>
    run('decide', async () => putOrder(await decideReplacementOrder(orderId, decision, confirm)))

  return { plan, loaded, busy, error, find, createOrder, decide }
}
