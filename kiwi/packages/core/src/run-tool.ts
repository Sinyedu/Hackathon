import type { AgentEvent } from '@kiwi/shared';
import type { ActionJournal, ConfirmationPort, InverseAction } from './ports';
import { wrapUntrusted } from './safety';
import type { ToolContext } from './tools/types';
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
  if (tool.risk !== 'read' && !options.skipConfirmation) {
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

async function execute(
  name: string,
  args: unknown,
  receiptId: string,
  deps: ToolRunDeps,
): Promise<ToolRunResult> {
  const tool = deps.registry.get(name);
  if (!tool) return { status: 'failed', message: `Unknown tool “${name}”.` };
  deps.emit({ type: 'toolStarted', name });
  let outcome;
  try {
    outcome = await tool.execute(args, deps.context);
  } catch (error) {
    outcome = {
      ok: false as const,
      message: error instanceof Error ? error.message : String(error),
    };
  }
  deps.emit({ type: 'toolFinished', name, ok: outcome.ok });
  if (!outcome.ok) {
    deps.emit({ type: 'receipt', id: receiptId, status: 'FAILED', text: outcome.message });
    return { status: 'failed', message: outcome.message };
  }
  deps.emit({ type: 'receipt', id: receiptId, status: 'DONE', text: outcome.summary });
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
