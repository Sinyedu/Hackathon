import type { HealthResponse } from '../types/health'
import type { CatalogItem, Corrections, Reconciliation } from '../types/reconciliation'

// Unset VITE_API_URL -> same host as the page on port 8000, so a phone opening
// http://<laptop-ip>:5173 talks to http://<laptop-ip>:8000 without extra config.
const API_URL: string =
  import.meta.env.VITE_API_URL || `${window.location.protocol}//${window.location.hostname}:8000`

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

export function getCatalog(): Promise<CatalogItem[]> {
  return request<CatalogItem[]>('/api/catalog')
}

export function documentFileUrl(reconciliationId: string, documentId: string): string {
  return `${API_URL}/api/reconciliations/${encodeURIComponent(reconciliationId)}/documents/${encodeURIComponent(documentId)}/file`
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

export function submitCorrections(id: string, corrections: Corrections): Promise<Reconciliation> {
  return request<Reconciliation>(`/api/reconciliations/${encodeURIComponent(id)}/corrections`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(corrections),
  })
}

export function approveReconciliation(id: string): Promise<Reconciliation> {
  return request<Reconciliation>(`/api/reconciliations/${encodeURIComponent(id)}/approve`, {
    method: 'POST',
  })
}
