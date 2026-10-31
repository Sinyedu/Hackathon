import type { LlmMessage, LlmResult, LlmToolCall } from './ports';
import { buildSystemPrompt } from './prompt';
import { stripReasoning } from './reasoning';
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

/**
 * Shows the model's final reply. A small model sometimes writes "call the X tool" instead of calling
 * it; that is not a result. Only snake_case names count: "research" or "define" are also ordinary words.
 */
function sayFinalAnswer(deps: AgentDeps, content: string): RunOutcome {
  const describesToolCall = deps.registry
    .forModel()
    .some((tool) => tool.name.includes('_') && content.includes(tool.name));
  if (describesToolCall) {
    say(deps, "I couldn't work out how to do that. Try rephrasing it.");
    return 'error';
  }
  say(deps, content === '' ? "I'm not sure how to help with that." : content);
  return 'done';
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
    const result = await deps.llm.chat({
      model: deps.planningModel,
      messages: loop.messages,
      tools: deps.registry.forModel(),
      signal,
    });
    if (isCancelled(signal)) return 'cancelled';
    if (!result.ok) {
      say(deps, llmFailureText(result, deps.planningModel));
      return 'error';
    }
    // Only the final answer is shown. Reasoning and narration before a tool call stay hidden.
    const content = stripReasoning(result.reply.content);
    const { toolCalls } = result.reply;
    if (toolCalls.length === 0) return sayFinalAnswer(deps, content);
    loop.messages.push({ role: 'assistant', content, toolCalls });
    const stopped = await runToolCalls(deps, toolCalls, loop, signal);
    if (stopped) return stopped;
  }
  say(deps, 'That needed more steps than I am allowed to take at once. Try a smaller request.');
  return 'error';
}
