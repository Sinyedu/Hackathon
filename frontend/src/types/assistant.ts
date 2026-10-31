import type { Document } from './reconciliation'

export interface AskResponse {
  answer: string
  sources: Document[]
}

export interface ChatMessage {
  id: number
  question: string
  answer: string | null
  sources: Document[]
  error: string | null
}
