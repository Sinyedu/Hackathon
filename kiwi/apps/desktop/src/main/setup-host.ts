import { totalmem } from 'node:os';
import { BrowserWindow } from 'electron';
import { recommendModels, type LlmClient } from '@kiwi/core';
import { ipcChannels, pullProgressSchema, type PullProgress, type SetupStatus } from '@kiwi/shared';
import { z } from 'zod';

const pullLineSchema = z.object({
  status: z.string(),
  total: z.number().optional(),
  completed: z.number().optional(),
  error: z.string().optional(),
});

export interface SetupHost {
  status(): Promise<SetupStatus>;
  pull(model: string): void;
}

function report(progress: PullProgress): void {
  for (const window of BrowserWindow.getAllWindows()) {
    if (!window.isDestroyed())
      window.webContents.send(ipcChannels.setupProgress, pullProgressSchema.parse(progress));
  }
}

async function streamPullProgress(
  body: ReadableStream<Uint8Array>,
  model: string,
  fail: (message: string) => void,
): Promise<void> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    for (const line of lines.filter((l) => l.trim() !== '')) {
      const parsed = pullLineSchema.safeParse(JSON.parse(line));
      if (!parsed.success) continue;
      if (parsed.data.error) {
        fail(parsed.data.error);
        return;
      }
      const { total, completed, status } = parsed.data;
      const percent =
        total && completed !== undefined ? Math.round((completed / total) * 100) : null;
      report({ model, status, percent, done: false, error: null });
    }
  }
  report({ model, status: 'ready', percent: 100, done: true, error: null });
}

async function pullModel(baseUrl: string, model: string): Promise<void> {
  const fail = (message: string): void =>
    report({ model, status: 'failed', percent: null, done: true, error: message });
  let response: Response;
  try {
    response = await fetch(`${baseUrl}/api/pull`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, stream: true }),
    });
  } catch {
    fail('Could not reach Ollama. Start it and try again.');
    return;
  }
  if (!response.ok || !response.body) {
    fail(`Ollama answered with HTTP ${response.status}.`);
    return;
  }
  await streamPullProgress(response.body, model, fail);
}

export function createSetupHost(llm: LlmClient, ollamaUrl: () => string): SetupHost {
  return {
    async status() {
      const health = await llm.health();
      const ramGb = Math.round((totalmem() / 1024 ** 3) * 10) / 10;
      return {
        ollamaRunning: health.running,
        installedModels: health.models,
        ramGb,
        platform: process.platform,
        recommended: recommendModels(ramGb),
      };
    },
    pull(model) {
      void pullModel(ollamaUrl(), model);
    },
  };
}
