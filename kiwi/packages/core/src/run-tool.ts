import type { AgentEvent } from '@kiwi/shared';
import type { ActionJournal, ConfirmationPort, InverseAction } from './ports';
import { wrapUntrusted } from './safety';
import { say } from './say';
import type { ToolContext, ToolOutcome } from './tools/types';
import type { ToolRegistry } from './tools/registry';

export interface ToolRunDeps {
  registry: ToolRegistry;
  context: ToolContext;
  confirm: ConfirmationPort;
  journal: ActionJournal;
  emit: (event: AgentEvent) => void;
  newId: () => string;
}

export type ToolRunResult =
  | { status: 'done'; summary: string; untrustedData?: string }
  | { status: 'failed'; message: string }
  | { status: 'invalid'; message: string }
  | { status: 'declined' };

interface RunOptions {
  /** Undo actions were explicitly requested, so they skip the confirmation step. */
  skipConfirmation?: boolean;
}

export async function runTool(
  name: string,
  rawArgs: unknown,
  deps: ToolRunDeps,
  options: RunOptions = {},
): Promise<ToolRunResult> {
  const tool = deps.registry.get(name);
  if (!tool) return { status: 'failed', message: `Unknown tool “${name}”.` };
  const parsed = tool.argsSchema.safeParse(rawArgs);
  if (!parsed.success) return { status: 'invalid', message: parsed.error.message };

  const receiptId = deps.newId();
  const planLine = tool.describe(parsed.data);
  if (tool.risk !== 'read' && !tool.selfConfirming && !options.skipConfirmation) {
    deps.emit({ type: 'receipt', id: receiptId, status: 'PLANNED', text: planLine });
    deps.emit({ type: 'confirmationRequested', id: receiptId, lines: [planLine] });
    const accepted = await deps.confirm.confirm({ id: receiptId, lines: [planLine] });
    deps.emit({ type: 'confirmationResolved', id: receiptId, accepted });
    if (!accepted) {
      deps.emit({
        type: 'receipt',
        id: receiptId,
        status: 'FAILED',
        text: `Cancelled: ${planLine}`,
      });
      return { status: 'declined' };
    }
  }
  return execute(tool.name, parsed.data, receiptId, deps);
}

async function attempt(run: () => Promise<ToolOutcome>): Promise<ToolOutcome> {
  try {
    return await run();
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : String(error) };
  }
}

function emitSuccess(
  deps: ToolRunDeps,
  receiptId: string,
  outcome: Extract<ToolOutcome, { ok: true }>,
): void {
  deps.emit({
    type: 'receipt',
    id: receiptId,
    status: 'DONE',
    text: outcome.summary,
    image: outcome.image,
  });
  for (const line of outcome.receipts ?? []) {
    deps.emit({ type: 'receipt', id: deps.newId(), status: 'DONE', text: line });
  }
  if (outcome.say) say(deps, outcome.say);
}

async function execute(
  name: string,
  args: unknown,
  receiptId: string,
  deps: ToolRunDeps,
): Promise<ToolRunResult> {
  const tool = deps.registry.get(name);
  if (!tool) return { status: 'failed', message: `Unknown tool “${name}”.` };
  deps.emit({ type: 'toolStarted', name });
  const outcome = await attempt(() => tool.execute(args, deps.context));
  deps.emit({ type: 'toolFinished', name, ok: outcome.ok });
  if (!outcome.ok) {
    deps.emit({ type: 'receipt', id: receiptId, status: 'FAILED', text: outcome.message });
    return { status: 'failed', message: outcome.message };
  }
  emitSuccess(deps, receiptId, outcome);
  const inverse: InverseAction | undefined = outcome.inverse;
  deps.journal.record({
    id: receiptId,
    tool: name,
    summary: outcome.summary,
    at: Date.now(),
    inverse,
  });
  return { status: 'done', summary: outcome.summary, untrustedData: outcome.untrustedData };
}

/** Text handed back to the model: a summary plus any untrusted payload fenced as data. */
export function toolResultForModel(result: ToolRunResult, name: string): string {
  switch (result.status) {
    case 'done':
      return result.untrustedData === undefined
        ? result.summary
        : `${result.summary}\n${wrapUntrusted(name, result.untrustedData)}`;
    case 'declined':
      return 'The user declined this action.';
    default:
      return `Error: ${result.message}`;
  }
}
