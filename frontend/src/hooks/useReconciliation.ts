import { useEffect, useState } from 'react'
import { getCatalog, getReconciliation } from '../services/api'
import { errorMessage } from '../lib/errors'
import type { CatalogItem, Reconciliation } from '../types/reconciliation'

export function useReconciliation(id: string) {
  const [rec, setRec] = useState<Reconciliation | null>(null)
  const [catalog, setCatalog] = useState<CatalogItem[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    Promise.all([getReconciliation(id), getCatalog()])
      .then(([r, c]) => {
        if (cancelled) return
        setRec(r)
        setCatalog(c)
      })
      .catch((e: unknown) => !cancelled && setError(errorMessage(e)))
    return () => {
      cancelled = true
    }
  }, [id])

  return { rec, setRec, catalog, error }
}
