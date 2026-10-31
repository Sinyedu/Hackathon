import type { z } from 'zod';

export type LlmRole = 'system' | 'user' | 'assistant' | 'tool';

export interface LlmToolCall {
  name: string;
  arguments: unknown;
}

export interface LlmMessage {
  role: LlmRole;
  content: string;
  toolCalls?: LlmToolCall[];
  toolName?: string;
}

export interface LlmToolSpec {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export interface LlmRequest {
  model: string;
  messages: LlmMessage[];
  tools: LlmToolSpec[];
  signal?: AbortSignal;
  onToken?: (text: string) => void;
}

export interface LlmReply {
  content: string;
  toolCalls: LlmToolCall[];
}

export type LlmErrorKind = 'unavailable' | 'model_missing' | 'bad_response' | 'aborted';

export type LlmResult =
  { ok: true; reply: LlmReply } | { ok: false; kind: LlmErrorKind; message: string };

export interface LlmHealth {
  running: boolean;
  models: string[];
}

export interface LlmClient {
  chat(request: LlmRequest): Promise<LlmResult>;
  health(): Promise<LlmHealth>;
}

export interface ConfirmationRequest {
  id: string;
  lines: string[];
}

export interface ConfirmationPort {
  /** Resolves true only on an explicit yes. Timeouts and cancellations resolve false. */
  confirm(request: ConfirmationRequest): Promise<boolean>;
}

export type VolumeAction = 'up' | 'down' | 'mute';

export interface PlatformPort {
  launchApp(appId: string): Promise<void>;
  openUrl(url: string): Promise<void>;
  startTimer(seconds: number, label: string): string;
  cancelTimer(timerId: string): boolean;
  writeNote(text: string): Promise<string>;
  trashNote(notePath: string): Promise<void>;
  readClipboard(): Promise<string>;
  writeClipboard(text: string): Promise<void>;
  adjustVolume(action: VolumeAction): Promise<void>;
  now(): Date;
}

export interface InverseAction {
  tool: string;
  args: unknown;
  description: string;
}

export interface JournalEntry {
  id: string;
  tool: string;
  summary: string;
  at: number;
  inverse?: InverseAction;
  undone: boolean;
}

export interface ActionJournal {
  record(entry: Omit<JournalEntry, 'undone'>): void;
  last(): JournalEntry | undefined;
  markUndone(id: string): void;
}

export type ArgsSchema<A> = z.ZodType<A>;
