export interface Preferences {
  provider: 'ollama' | 'compatible'
  model: string
  baseUrl: string
  muted: boolean
  wake: boolean
  voice: 'natural' | 'blips'
  hasKey: boolean
}
export interface Turn { role: 'user' | 'assistant'; content: string }
export interface DesktopEvent { type: string; id?: string; text?: string; message?: string; x?: number; y?: number; expanded?: boolean; settings?: Preferences }
interface DesktopApi {
  settings: () => Promise<Preferences>
  save: (input: Partial<Preferences> & { apiKey?: string; forgetKey?: boolean }) => Promise<Preferences>
  health: () => Promise<{ ok: boolean; message: string; models: string[] }>
  send: (input: { text: string; id: string; history: Turn[] }) => Promise<boolean>
  transcribe: (bytes: Uint8Array) => Promise<string>
  downloadSpeech: () => Promise<string>
  expand: (expanded: boolean) => void
  stop: () => void
  hide: () => void
  quit: () => void
  onEvent: (callback: (event: DesktopEvent) => void) => () => void
}
export const desktop = (window as unknown as { kiwiDesktop: DesktopApi }).kiwiDesktop
