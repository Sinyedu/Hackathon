import type { AgentEvent } from '@kiwi/shared';
import type { ConfirmationPort } from './ports';

export type Fallible<T> = ({ ok: true } & T) | { ok: false; message: string };

export interface WebPort {
  /** Top result URLs for a query (http/https only). */
  search(query: string): Promise<Fallible<{ urls: string[] }>>;
  /** Main text of a page, size and time limited. Always untrusted. */
  fetchText(url: string): Promise<Fallible<{ text: string }>>;
  fetchJson(url: string): Promise<Fallible<{ json: unknown }>>;
}

export type ModelKind = 'fast' | 'vision';

export interface ModelPort {
  generate(kind: ModelKind, prompt: string, images?: string[]): Promise<Fallible<{ text: string }>>;
}

export interface ScreenPort {
  /** Full screenshot for the model and a small data-URL thumbnail as proof. */
  capture(): Promise<{ imageBase64: string; thumbnailDataUrl: string }>;
}

export interface SandboxFilesPort {
  list(folder: string): Promise<string[]>;
  /** Moves a file inside the sandbox; never overwrites. */
  move(fromRelative: string, toRelative: string): Promise<void>;
}

export interface CodingEvent {
  text: string;
}

export interface CodingResult {
  summary: string;
  diffSummary: string;
}

/** Runs a coding task in an isolated branch. Nothing touches the main copy until `keep`. */
export interface CodingBackendPort {
  readonly label: string;
  run(
    task: string,
    project: string,
    onProgress: (event: CodingEvent) => void,
  ): Promise<Fallible<CodingResult>>;
  diff(): Promise<string>;
  /** Runs the project's tests in the isolated branch. Only called after the user agrees. */
  runTests(): Promise<string>;
  keep(): Promise<Fallible<{ message: string }>>;
  discard(): Promise<void>;
  hasPending(): boolean;
}

export interface CodeDelegationConfig {
  enabled: boolean;
  projects: string[];
  testCommand: string;
}

export interface ToolServices {
  web: WebPort;
  model: ModelPort;
  screen: ScreenPort;
  files: SandboxFilesPort;
  code: CodingBackendPort | null;
  codeConfig: CodeDelegationConfig;
  confirm: ConfirmationPort;
  emit: (event: AgentEvent) => void;
  newId: () => string;
}
