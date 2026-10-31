import type {
  LlmClient,
  LlmHealth,
  LlmMessage,
  LlmRequest,
  LlmResult,
  LlmToolCall,
} from '@kiwi/core';
import { z } from 'zod';

const chunkSchema = z.object({
  message: z
    .object({
      content: z.string().optional(),
      tool_calls: z
        .array(z.object({ function: z.object({ name: z.string(), arguments: z.unknown() }) }))
        .optional(),
    })
    .optional(),
  error: z.string().optional(),
});

const tagsSchema = z.object({ models: z.array(z.object({ name: z.string() })) });

type FetchLike = typeof fetch;

function toOllamaMessage(message: LlmMessage): Record<string, unknown> {
  if (message.role === 'tool')
    return { role: 'tool', tool_name: message.toolName, content: message.content };
  const base = { role: message.role, content: message.content };
  if (!message.toolCalls) return base;
  return {
    ...base,
    tool_calls: message.toolCalls.map((call) => ({
      function: { name: call.name, arguments: call.arguments },
    })),
  };
}

async function* readLines(body: ReadableStream<Uint8Array>): AsyncGenerator<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    for (const line of lines) if (line.trim() !== '') yield line;
  }
  if (buffer.trim() !== '') yield buffer;
}

async function postChat(
  baseUrl: string,
  fetchImpl: FetchLike,
  request: LlmRequest,
): Promise<Response | LlmResult> {
  try {
    return await fetchImpl(`${baseUrl}/api/chat`, {
      method: 'POST',
      signal: request.signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: request.model,
        messages: request.messages.map(toOllamaMessage),
        tools: request.tools.map((tool) => ({ type: 'function', function: tool })),
        stream: true,
        think: false,
      }),
    });
  } catch (error) {
    if (request.signal?.aborted) return { ok: false, kind: 'aborted', message: 'Cancelled' };
    return {
      ok: false,
      kind: 'unavailable',
      message: `Could not reach Ollama at ${baseUrl}: ${String(error)}`,
    };
  }
}

async function collect(body: ReadableStream<Uint8Array>, request: LlmRequest): Promise<LlmResult> {
  let content = '';
  const toolCalls: LlmToolCall[] = [];
  try {
    for await (const line of readLines(body)) {
      const chunk = chunkSchema.safeParse(JSON.parse(line));
      if (!chunk.success)
        return { ok: false, kind: 'bad_response', message: 'Unexpected reply from Ollama.' };
      if (chunk.data.error) return { ok: false, kind: 'bad_response', message: chunk.data.error };
      const text = chunk.data.message?.content ?? '';
      if (text !== '') {
        content += text;
        request.onToken?.(text);
      }
      for (const call of chunk.data.message?.tool_calls ?? []) {
        toolCalls.push({ name: call.function.name, arguments: call.function.arguments });
      }
    }
  } catch (error) {
    if (request.signal?.aborted) return { ok: false, kind: 'aborted', message: 'Cancelled' };
    return { ok: false, kind: 'bad_response', message: `Ollama stream failed: ${String(error)}` };
  }
  return { ok: true, reply: { content, toolCalls } };
}

async function readHealth(baseUrl: string, fetchImpl: FetchLike): Promise<LlmHealth> {
  try {
    const response = await fetchImpl(`${baseUrl}/api/tags`);
    const tags = tagsSchema.safeParse(await response.json());
    return {
      running: response.ok,
      models: tags.success ? tags.data.models.map((m) => m.name) : [],
    };
  } catch {
    return { running: false, models: [] };
  }
}

export function createOllamaClient(baseUrl: string, fetchImpl: FetchLike = fetch): LlmClient {
  return {
    async chat(request) {
      const response = await postChat(baseUrl, fetchImpl, request);
      if (!(response instanceof Response)) return response;
      if (response.status === 404)
        return { ok: false, kind: 'model_missing', message: await response.text() };
      if (!response.ok || !response.body) {
        return {
          ok: false,
          kind: 'bad_response',
          message: `Ollama answered with HTTP ${response.status}`,
        };
      }
      return collect(response.body, request);
    },
    health: () => readHealth(baseUrl, fetchImpl),
  };
}
