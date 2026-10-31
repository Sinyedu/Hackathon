import type { AppEntry, CommandsConfig, SitesConfig } from '@kiwi/shared';
import { runModelPath, type RunOutcome } from './model-path';
import { say } from './say';
import type { LlmClient } from './ports';
import { createRouter, type RoutedCall } from './router';
import { runTool, type ToolRunDeps } from './run-tool';

const UNDO_PATTERN = /^\s*undo(?:\s+(?:that|it|the last (?:action|thing)))?\s*[.!]?\s*$/i;

export interface AgentDeps extends ToolRunDeps {
  llm: LlmClient;
  commands: CommandsConfig;
  apps: AppEntry[];
  sites: SitesConfig;
  planningModel: string;
}

export interface Agent {
  run(userText: string): Promise<void>;
  undo(): Promise<void>;
  cancel(): void;
}

async function undoLast(deps: AgentDeps): Promise<void> {
  const entry = deps.journal.last();
  if (!entry) say(deps, 'There is nothing to undo yet.');
  else if (!entry.inverse) say(deps, `I can't undo “${entry.summary}”.`);
  else {
    const result = await runTool(entry.inverse.tool, entry.inverse.args, deps, {
      skipConfirmation: true,
    });
    if (result.status === 'done') {
      deps.journal.markUndone(entry.id);
      deps.emit({
        type: 'receipt',
        id: deps.newId(),
        status: 'UNDONE',
        text: `Undid: ${entry.summary}`,
      });
    }
  }
  deps.emit({ type: 'runFinished', outcome: 'done' });
}

/** Runs a chain only when every part is a known deterministic command. */
function routeSequence(
  userText: string,
  route: (text: string) => RoutedCall | null,
): RoutedCall[] | null {
  const parts = userText
    .split(/\s+(?:and then|then|and)\s+/i)
    .map((part) => part.trim())
    .filter((part) => part !== '');
  if (parts.length < 2) return null;
  const calls = parts.map((part) => route(part));
  return calls.every((call): call is RoutedCall => call !== null) ? calls : null;
}

export function createAgent(deps: AgentDeps): Agent {
  const route = createRouter({ config: deps.commands, apps: deps.apps, sites: deps.sites });
  let abort: AbortController | null = null;

  async function execute(userText: string, signal: AbortSignal): Promise<RunOutcome> {
    const sequence = routeSequence(userText, route);
    if (sequence) {
      for (const routed of sequence) {
        const result = await runTool(routed.tool, routed.args, deps);
        if (result.status === 'declined') return 'done';
        if (result.status === 'failed' || result.status === 'invalid') return 'error';
        if (signal.aborted) return 'cancelled';
      }
      return 'done';
    }
    const routed = route(userText);
    if (!routed) return runModelPath(deps, userText, signal);
    const result = await runTool(routed.tool, routed.args, deps);
    return result.status === 'failed' || result.status === 'invalid' ? 'error' : 'done';
  }

  return {
    async run(userText) {
      deps.emit({ type: 'userMessage', id: deps.newId(), text: userText });
      if (UNDO_PATTERN.test(userText)) return undoLast(deps);
      abort = new AbortController();
      const { signal } = abort;
      const outcome = await execute(userText, signal);
      deps.emit({ type: 'runFinished', outcome: signal.aborted ? 'cancelled' : outcome });
    },
    async undo() {
      deps.emit({ type: 'userMessage', id: deps.newId(), text: 'undo' });
      await undoLast(deps);
    },
    cancel: () => abort?.abort(),
  };
}
