import type { LlmMessage, LlmResult, LlmToolCall } from './ports';
import { buildSystemPrompt } from './prompt';
import { say } from './say';
import { runTool, toolResultForModel } from './run-tool';
import type { AgentDeps } from './agent';

export const MAX_TOOL_STEPS = 5;
export type RunOutcome = 'done' | 'error' | 'cancelled';

type LlmFailure = Extract<LlmResult, { ok: false }>;

function llmFailureText(failure: LlmFailure, model: string): string {
  if (failure.kind === 'unavailable') {
    return 'I can\'t reach Ollama. Start it (open the Ollama app or run "ollama serve") and try again. Quick commands like "open github" still work without it.';
  }
  if (failure.kind === 'model_missing') {
    return `The model ${model} is not installed. Run "ollama pull ${model}" and try again.`;
  }
  return failure.message;
}

const isCancelled = (signal: AbortSignal): boolean => signal.aborted;

interface LoopState {
  messages: LlmMessage[];
  invalidArguments: number;
}

/** Runs the model's tool calls; returns an outcome when the run must stop, otherwise null. */
async function runToolCalls(
  deps: AgentDeps,
  calls: LlmToolCall[],
  loop: LoopState,
  signal: AbortSignal,
): Promise<RunOutcome | null> {
  for (const call of calls) {
    const toolResult = await runTool(call.name, call.arguments, deps);
    if (isCancelled(signal)) return 'cancelled';
    if (toolResult.status === 'invalid') loop.invalidArguments += 1;
    if (loop.invalidArguments > 1) {
      say(deps, "I couldn't work out how to do that. Try rephrasing it.");
      return 'error';
    }
    loop.messages.push({
      role: 'tool',
      toolName: call.name,
      content: toolResultForModel(toolResult, call.name),
    });
  }
  return null;
}

/** The model-driven loop: at most five tool steps, one retry for invalid arguments. */
export async function runModelPath(
  deps: AgentDeps,
  userText: string,
  signal: AbortSignal,
): Promise<RunOutcome> {
  const loop: LoopState = {
    invalidArguments: 0,
    messages: [
      { role: 'system', content: buildSystemPrompt(deps.apps, deps.sites) },
      { role: 'user', content: userText },
    ],
  };

  for (let step = 0; step < MAX_TOOL_STEPS; step += 1) {
    deps.emit({ type: 'thinking' });
    const replyId = deps.newId();
    const result = await deps.llm.chat({
      model: deps.planningModel,
      messages: loop.messages,
      tools: deps.registry.forModel(),
      signal,
      onToken: (text) => deps.emit({ type: 'assistantDelta', id: replyId, text }),
    });
    if (isCancelled(signal)) return 'cancelled';
    if (!result.ok) {
      say(deps, llmFailureText(result, deps.planningModel));
      return 'error';
    }
    deps.emit({ type: 'assistantDone', id: replyId });
    const { content, toolCalls } = result.reply;
    if (toolCalls.length === 0) {
      if (content.trim() === '') say(deps, "I'm not sure how to help with that.");
      return 'done';
    }
    loop.messages.push({ role: 'assistant', content, toolCalls });
    const stopped = await runToolCalls(deps, toolCalls, loop, signal);
    if (stopped) return stopped;
  }
  say(deps, 'That needed more steps than I am allowed to take at once. Try a smaller request.');
  return 'error';
}
