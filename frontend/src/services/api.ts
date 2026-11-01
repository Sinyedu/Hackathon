import type { HealthResponse } from '../types/health'
import type { CatalogItem, Corrections, Document, Reconciliation } from '../types/reconciliation'
import type { AgentCard, AskResponse } from '../types/assistant'
import type { Priority, RecoveryPlan, ReplacementOrder } from '../types/recovery'
import { aiHeaders } from './aiSettings'

// Unset VITE_API_URL -> same host as the page on port 8000, so a phone opening
// http://<laptop-ip>:5173 talks to http://<laptop-ip>:8000 without extra config.
const pageProtocol = window.location.protocol === 'file:' ? 'http:' : window.location.protocol
const pageHost = window.location.hostname || '127.0.0.1'
const API_URL: string = import.meta.env.VITE_API_URL || `${pageProtocol}//${pageHost}:8000`

export class ApiError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, init)
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { detail?: string } | null
    throw new ApiError(response.status, body?.detail ?? `Request failed with status ${response.status}`)
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

// --- AutoRecover ---

const planPath = (reconciliationId: string, itemId: string) =>
  `/api/reconciliations/${encodeURIComponent(reconciliationId)}/discrepancies/${encodeURIComponent(itemId)}`

/** Existing plan, or null when none has been generated yet. */
export async function getRecoveryPlan(reconciliationId: string, itemId: string): Promise<RecoveryPlan | null> {
  try {
    return await request<RecoveryPlan>(`${planPath(reconciliationId, itemId)}/recovery`)
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) return null
    throw e
  }
}

export function findRecovery(reconciliationId: string, itemId: string, priority: Priority): Promise<RecoveryPlan> {
  return request<RecoveryPlan>(`${planPath(reconciliationId, itemId)}/recover?priority=${priority}`, { method: 'POST' })
}

export function createReplacementOrder(planId: string, optionId: string): Promise<ReplacementOrder> {
  return request<ReplacementOrder>(`/api/recovery-plans/${encodeURIComponent(planId)}/draft-order`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ option_id: optionId }),
  })
}

export function decideReplacementOrder(
  orderId: string,
  decision: 'approve' | 'reject',
  confirmSubstitution = false,
): Promise<ReplacementOrder> {
  return request<ReplacementOrder>(`/api/replacement-orders/${encodeURIComponent(orderId)}/${decision}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ confirm_substitution: confirmSubstitution }),
  })
}

/** Runs the real pipeline on the synthetic "Missing Tomatoes" fixture scans. */
export function startDemoScenario(): Promise<Reconciliation> {
  return request<Reconciliation>('/api/demo/missing-tomatoes', { method: 'POST' })
}

// --- Assistant (questions and voice) ---

export function getCards(reconciliationId: string): Promise<AgentCard[]> {
  return request<AgentCard[]>(`/api/reconciliations/${encodeURIComponent(reconciliationId)}/cards`)
}

export interface Turn { role: 'user' | 'assistant'; content: string }

export function askQuestion(reconciliationId: string, question: string, focus?: string | null, history: Turn[] = []): Promise<AskResponse> {
  return request<AskResponse>(`/api/reconciliations/${encodeURIComponent(reconciliationId)}/ask`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...aiHeaders() },
    body: JSON.stringify({ question, focus: focus ?? null, history }),
  })
}

export type AskEvent =
  | { type: 'meta'; focus: string | null; sources: Document[] }
  | { type: 'sentence' | 'fallback'; text: string }
  | { type: 'done'; grounded: boolean }
  | { type: 'error'; detail: string }

/** Answer sentence by sentence (NDJSON) so the agent can start speaking before the model has finished. */
export async function askStream(reconciliationId: string, question: string, history: Turn[], onEvent: (event: AskEvent) => void, signal?: AbortSignal, requestId?: string): Promise<void> {
  const response = await fetch(`${API_URL}/api/reconciliations/${encodeURIComponent(reconciliationId)}/ask/stream`, {
    method: 'POST', signal,
    headers: { 'Content-Type': 'application/json', ...aiHeaders(), ...(requestId ? { 'X-Request-ID': requestId } : {}) },
    body: JSON.stringify({ question, history }),
  })
  if (!response.ok || !response.body) throw new ApiError(response.status, `Request failed with status ${response.status}`)
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''
    for (const line of lines) if (line.trim()) onEvent(JSON.parse(line) as AskEvent)
  }
}

/** Local Whisper speech-to-text. Returns the transcript so the user can see what was heard. */
export async function transcribeAudio(audio: Blob, requestId?: string): Promise<string> {
  const form = new FormData()
  const extension = audio.type.includes('mp4') ? 'mp4' : audio.type.includes('ogg') ? 'ogg' : 'webm'
  form.append('audio', audio, `speech.${extension}`)
  return (await request<{ text: string }>('/api/voice/transcribe', { method: 'POST', body: form, headers: requestId ? { 'X-Request-ID': requestId } : undefined })).text
}
