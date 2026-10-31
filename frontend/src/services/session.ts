import type { Reconciliation } from '../types/reconciliation'

export const API = import.meta.env.VITE_API_URL || `${window.location.protocol}//${window.location.hostname}:8000`

export interface Session {
  id: string
  events: { id: number; type: string; data: Record<string, string> }[]
  aliases: Record<string, string>
  rejected: string[][]
  counts: Record<string, number>
  reconciliation_id: string | null
  deliveries: string[]
}

async function json<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API}${path}`, init)
  if (!response.ok) {
    const body = await response.json().catch(() => ({})) as { detail?: string }
    throw new Error(body.detail || `Request failed (${response.status})`)
  }
  return response.json() as Promise<T>
}

export const createSession = () => json<Session>('/api/session', { method: 'POST' })
export const getSession = (id: string) => json<Session>(`/api/session/${id}`)
export const joinSession = (id: string) => json<Session>(`/api/session/${id}/join`, { method: 'POST' })
export const lanIp = (id: string) => json<{ ip: string }>(`/api/session/${id}/lan-ip`)
export const uploadSession = (id: string, files: { purchase_order?: File; delivery_note?: File }) => {
  const body = new FormData()
  if (files.purchase_order) body.append('purchase_order', files.purchase_order)
  if (files.delivery_note) body.append('delivery_note', files.delivery_note)
  return json<Session>(`/api/session/${id}/upload`, { method: 'POST', body })
}
export const answerSession = (id: string, line_id: string, catalog_item_id: string, yes: boolean) =>
  json<Session>(`/api/session/${id}/answer`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ line_id, catalog_item_id, yes }) })
export const approveSession = (id: string) => json<Session>(`/api/session/${id}/approve`, { method: 'POST' })
export const resetSession = (id: string) => json<Session>(`/api/session/${id}/reset`, { method: 'POST' })
export const getResult = (id: string) => json<Reconciliation>(`/api/reconciliations/${id}`)
