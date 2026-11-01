export type AiProvider = 'ollama' | 'openai'

export interface AiSettings {
  provider: AiProvider
  ollamaUrl: string
  ollamaModel: string
  openaiUrl: string
  openaiModel: string
}

const SETTINGS_KEY = 'kiwi.ai.settings'
const API_KEY_KEY = 'kiwi.ai.api-key'

export const DEFAULT_AI_SETTINGS: AiSettings = {
  provider: 'ollama',
  ollamaUrl: 'http://localhost:11434',
  ollamaModel: 'qwen3:1.7b',
  openaiUrl: 'https://api.openai.com/v1',
  openaiModel: 'gpt-4o-mini',
}

function storage(kind: 'local' | 'session'): Storage | null {
  try { return kind === 'local' ? window.localStorage : window.sessionStorage } catch { return null }
}

export function getAiSettings(): AiSettings {
  try {
    const raw = JSON.parse(storage('local')?.getItem(SETTINGS_KEY) ?? 'null') as Partial<AiSettings> | null
    return {
      ...DEFAULT_AI_SETTINGS,
      ...raw,
      provider: raw?.provider === 'openai' ? 'openai' : 'ollama',
    }
  } catch {
    return DEFAULT_AI_SETTINGS
  }
}

export function getApiKey(): string {
  return storage('session')?.getItem(API_KEY_KEY) ?? ''
}

export function saveAiSettings(settings: AiSettings, apiKey: string): void {
  storage('local')?.setItem(SETTINGS_KEY, JSON.stringify(settings))
  const session = storage('session')
  if (apiKey.trim()) session?.setItem(API_KEY_KEY, apiKey.trim())
  else session?.removeItem(API_KEY_KEY)
  window.dispatchEvent(new CustomEvent('kiwi:settings-changed'))
}

export function aiHeaders(): Record<string, string> {
  const settings = getAiSettings()
  const headers: Record<string, string> = {
    'X-Kiwi-Provider': settings.provider,
    'X-Kiwi-Model': settings.provider === 'ollama' ? settings.ollamaModel : settings.openaiModel,
    'X-Kiwi-Base-URL': settings.provider === 'ollama' ? settings.ollamaUrl : settings.openaiUrl,
  }
  const apiKey = getApiKey()
  if (settings.provider === 'openai' && apiKey) headers['X-Kiwi-API-Key'] = apiKey
  return headers
}
