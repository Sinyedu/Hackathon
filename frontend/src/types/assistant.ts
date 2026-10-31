import type { Document } from './reconciliation'

export interface AskResponse {
  answer: string
  sources: Document[]
  focus: string | null
  grounded: boolean
}

export interface ChatMessage {
  id: number
  question: string
  answer: string | null
  sources: Document[]
  error: string | null
}

/** An inspectable item the agent can explain; built by the backend from persisted results. */
export interface AgentCard {
  id: string
  kind: 'document' | 'discrepancy' | 'recovery' | 'claim'
  title: string
  subtitle: string
  facts: string[]
  document_id: string | null
}
