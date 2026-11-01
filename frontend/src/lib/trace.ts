interface AuditSpan { span: string; durationMs: number; requestId: string }
const bridge = (window as unknown as { kiwiAudit?: { span: (row: AuditSpan) => void } }).kiwiAudit

/** Opt-in metadata only; the desktop main process owns the diagnostic file. */
export function traceSpan(span: string, started: number, requestId: string): void {
  bridge?.span({ span, durationMs: performance.now() - started, requestId })
}

export function voiceRequestId(): string { return crypto.randomUUID() }
