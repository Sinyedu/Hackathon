import type { HealthResponse } from '../types/health'
import type { Reconciliation } from '../types/reconciliation'

const API_URL: string = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, init)
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { detail?: string } | null
    throw new Error(body?.detail ?? `Request failed with status ${response.status}`)
  }
  return (await response.json()) as T
}

export function getHealth(signal?: AbortSignal): Promise<HealthResponse> {
  return request<HealthResponse>('/api/health', { signal })
}

export function createReconciliation(files: {
  purchaseOrder: File
  deliveryNote: File
  invoice?: File
}): Promise<Reconciliation> {
  const form = new FormData()
  form.append('purchase_order', files.purchaseOrder)
  form.append('delivery_note', files.deliveryNote)
  if (files.invoice) form.append('invoice', files.invoice)
  return request<Reconciliation>('/api/reconciliations', { method: 'POST', body: form })
}

export function getReconciliation(id: string): Promise<Reconciliation> {
  return request<Reconciliation>(`/api/reconciliations/${encodeURIComponent(id)}`)
}

export function approveReconciliation(id: string): Promise<Reconciliation> {
  return request<Reconciliation>(`/api/reconciliations/${encodeURIComponent(id)}/approve`, {
    method: 'POST',
  })
}
