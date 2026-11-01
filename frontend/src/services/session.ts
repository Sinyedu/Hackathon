import type { Reconciliation } from '../types/reconciliation'

const pageProtocol = window.location.protocol === 'file:' ? 'http:' : window.location.protocol
const pageHost = window.location.hostname || '127.0.0.1'
export const API = import.meta.env.VITE_API_URL || `${pageProtocol}//${pageHost}:8000`

export interface Session {
  id: string
  events: { id: number; type: string; data: Record<string, string> }[]
  aliases: Record<string, string>
  rejected: string[][]
  counts: Record<string, string>
  verdict: CountVerdict[]
  reconciliation_id: string | null
  claim_fingerprint: string | null
  deliveries: string[]
  generated: { delivery_id: string; supplier: string; purchase_order: string; delivery_note: string; seed: number }[]
  delivery_id: string | null
}

export interface CountVerdict {
  catalog_item_id: string
  description: string
  unit: string
  line_ids: string[]
  ordered: string
  noted: string
  counted: string | null
  received: string
  shortage: string
  note_overstated: string
  over_delivery: string
  claim_cents: number | null
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
export const uploadSession = (id: string, files: { purchase_order?: File; delivery_note?: File; documents?: File[] }) => {
  const body = new FormData()
  if (files.purchase_order) body.append('purchase_order', files.purchase_order)
  if (files.delivery_note) body.append('delivery_note', files.delivery_note)
  for (const file of files.documents ?? []) body.append('documents', file) // the backend reads each scan to see what it is
  return json<Session>(`/api/session/${id}/upload`, { method: 'POST', body })
}
export interface LocalFile { name: string; size: number; kind: 'purchase_order' | 'delivery_note' | null }
export const listFiles = (id: string) => json<{ folder: string; files: LocalFile[] }>(`/api/session/${id}/files`)
export const importFile = (id: string, filename: string, kind?: 'purchase_order' | 'delivery_note') =>
  json<Session>(`/api/session/${id}/import`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ filename, kind }) })
export const answerSession = (id: string, line_id: string, catalog_item_id: string, yes: boolean) =>
  json<Session>(`/api/session/${id}/answer`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ line_id, catalog_item_id, yes }) })
export const approveSession = (id: string) => json<Session>(`/api/session/${id}/approve`, { method: 'POST' })
export const updateCount = (id: string, line_id: string, counted: string | null) =>
  json<Session>(`/api/session/${id}/count`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ line_id, counted }) })
export const resetSession = (id: string) => json<Session>(`/api/session/${id}/reset`, { method: 'POST' })
export const getResult = (id: string) => json<Reconciliation>(`/api/reconciliations/${id}`)
export const resolveLine = (id: string, line_id: string, catalog_item_id: string | null) =>
  json<Session>(`/api/session/${id}/resolve`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ line_id, catalog_item_id }) })
export const generateDelivery = (id: string, input: { persona: string; seed: number; chaos: string[]; ugliness: number; format: 'pdf' | 'png' }) =>
  json<{ delivery_id: string; supplier: string; purchase_order: string; delivery_note: string; seed: number }>(`/api/session/${id}/generate`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input),
  })
export const revealAnswer = (id: string) => json<{ delivery_id: string; supplier: string; comparison: { type: string; catalog_item_id: string; amount: number; found: boolean }[] }>(`/api/session/${id}/reveal`)
