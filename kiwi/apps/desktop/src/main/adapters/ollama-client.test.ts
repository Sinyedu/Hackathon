import { describe, expect, it } from 'vitest';
import { createOllamaClient } from './ollama-client';

const ndjson = (...objects: unknown[]): Response =>
  new Response(objects.map((o) => JSON.stringify(o)).join('\n') + '\n');

const request = { model: 'm', messages: [{ role: 'user' as const, content: 'hi' }], tools: [] };

describe('createOllamaClient', () => {
  it('streams tokens and collects tool calls', async () => {
    const tokens: string[] = [];
    const client = createOllamaClient('http://x', () =>
      Promise.resolve(
        ndjson(
          { message: { content: 'Hel' } },
          { message: { content: 'lo' } },
          {
            message: { tool_calls: [{ function: { name: 'get_time', arguments: {} } }] },
            done: true,
          },
        ),
      ),
    );
    const result = await client.chat({ ...request, onToken: (t) => tokens.push(t) });
    expect(tokens).toEqual(['Hel', 'lo']);
    expect(result).toEqual({
      ok: true,
      reply: { content: 'Hello', toolCalls: [{ name: 'get_time', arguments: {} }] },
    });
  });

  it('sends tools, tool results and think:false in the documented shape', async () => {
    let body: Record<string, unknown> = {};
    const client = createOllamaClient('http://x', (_url, init) => {
      body = JSON.parse(typeof init?.body === 'string' ? init.body : '{}') as Record<
        string,
        unknown
      >;
      return Promise.resolve(ndjson({ message: { content: 'ok' } }));
    });
    await client.chat({
      model: 'm',
      messages: [
        { role: 'assistant', content: '', toolCalls: [{ name: 'get_time', arguments: {} }] },
        { role: 'tool', toolName: 'get_time', content: '9:05' },
      ],
      tools: [{ name: 'get_time', description: 'd', parameters: { type: 'object' } }],
    });
    expect(body['think']).toBe(false);
    expect(body['stream']).toBe(true);
    expect(body['tools']).toEqual([
      {
        type: 'function',
        function: { name: 'get_time', description: 'd', parameters: { type: 'object' } },
      },
    ]);
    expect(body['messages']).toEqual([
      {
        role: 'assistant',
        content: '',
        tool_calls: [{ function: { name: 'get_time', arguments: {} } }],
      },
      { role: 'tool', tool_name: 'get_time', content: '9:05' },
    ]);
  });

  it('reports an unreachable server as unavailable', async () => {
    const client = createOllamaClient('http://x', () =>
      Promise.reject(new TypeError('fetch failed')),
    );
    expect(await client.chat(request)).toMatchObject({ ok: false, kind: 'unavailable' });
  });

  it('reports a missing model', async () => {
    const client = createOllamaClient('http://x', () =>
      Promise.resolve(new Response('model not found', { status: 404 })),
    );
    expect(await client.chat(request)).toMatchObject({ ok: false, kind: 'model_missing' });
  });

  it('rejects malformed stream data', async () => {
    const client = createOllamaClient('http://x', () =>
      Promise.resolve(new Response('not json\n')),
    );
    expect(await client.chat(request)).toMatchObject({ ok: false, kind: 'bad_response' });
  });

  it('reports health and installed models', async () => {
    const up = createOllamaClient('http://x', () =>
      Promise.resolve(Response.json({ models: [{ name: 'qwen3:1.7b' }] })),
    );
    expect(await up.health()).toEqual({ running: true, models: ['qwen3:1.7b'] });
    const down = createOllamaClient('http://x', () => Promise.reject(new TypeError('down')));
    expect(await down.health()).toEqual({ running: false, models: [] });
  });
});
