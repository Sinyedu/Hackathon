import { spawn, type ChildProcess } from 'node:child_process';
import type { CodingEvent, Fallible } from '@kiwi/core';

export interface ClaudeProcessOptions {
  claudeCommand?: string;
  timeoutMs?: number;
  maxMessages?: number;
  maxBudgetUsd?: number;
}

/** Only the variables Claude Code needs to find its own login; no other secrets are passed on. */
const passThroughEnv = (): Record<string, string> =>
  Object.fromEntries(
    ['PATH', 'HOME', 'USERPROFILE', 'APPDATA', 'LANG'].flatMap((key) => {
      const value = process.env[key];
      return value ? [[key, value]] : [];
    }),
  );

function progressFrom(line: string): string | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(line);
  } catch {
    return null;
  }
  const message = parsed as { type?: string; message?: { content?: unknown } };
  if (message.type !== 'assistant' || !Array.isArray(message.message?.content)) return null;
  for (const part of message.message.content as { type?: string; name?: string; text?: string }[]) {
    if (part.type === 'tool_use' && part.name) return `Using ${part.name}`;
    if (part.type === 'text' && part.text) return part.text.slice(0, 100);
  }
  return null;
}

const resultFrom = (line: string): string | null =>
  line.includes('"type":"result"')
    ? ((JSON.parse(line) as { result?: string }).result ?? null)
    : null;

function buildArgs(task: string, options: ClaudeProcessOptions): string[] {
  return [
    '-p',
    `${task}

Make the smallest change that works. You cannot run commands; the user runs the tests afterwards.`,
    '--output-format',
    'stream-json',
    '--verbose',
    '--permission-mode',
    'dontAsk',
    // No shell tool: the agent can only read and edit files in its worktree.
    '--allowedTools',
    'Read',
    'Glob',
    'Grep',
    'Edit',
    'Write',
    '--max-budget-usd',
    String(options.maxBudgetUsd ?? 1),
    '--no-session-persistence',
  ];
}

/** One headless Claude Code run, bounded by time, message count and budget. */
class ClaudeRun {
  private messages = 0;
  private buffer = '';
  private summary = 'Finished.';
  private readonly child: ChildProcess;
  private readonly timer: NodeJS.Timeout;

  constructor(
    task: string,
    cwd: string,
    private readonly options: ClaudeProcessOptions,
    private readonly onProgress: (event: CodingEvent) => void,
    private readonly finish: (result: Fallible<{ summary: string }>) => void,
  ) {
    this.child = spawn(options.claudeCommand ?? 'claude', buildArgs(task, options), {
      cwd,
      env: passThroughEnv(),
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    this.timer = setTimeout(
      () => this.stop('The coding task took too long and was stopped.'),
      options.timeoutMs ?? 300_000,
    );
    this.child.stdout?.on('data', (chunk: Buffer) => this.read(chunk.toString()));
    this.child.once('error', () =>
      this.end({
        ok: false,
        message: 'Could not start Claude Code. Is the "claude" command installed and logged in?',
      }),
    );
    this.child.once('close', (code) =>
      this.end(
        code === 0
          ? { ok: true, summary: this.summary }
          : { ok: false, message: `Claude Code stopped with exit code ${String(code)}.` },
      ),
    );
  }

  private read(text: string): void {
    this.buffer += text;
    const lines = this.buffer.split('\n');
    this.buffer = lines.pop() ?? '';
    lines.forEach((line) => this.handleLine(line));
  }

  private handleLine(line: string): void {
    const progress = progressFrom(line);
    if (progress) {
      this.messages += 1;
      this.onProgress({ text: progress });
      if (this.messages > (this.options.maxMessages ?? 25))
        this.stop('The coding task used too many steps and was stopped.');
    }
    this.summary = resultFrom(line) ?? this.summary;
  }

  private stop(message: string): void {
    this.child.kill();
    this.end({ ok: false, message });
  }

  private end(result: Fallible<{ summary: string }>): void {
    clearTimeout(this.timer);
    this.finish(result);
  }
}

export function runClaudeProcess(
  task: string,
  cwd: string,
  options: ClaudeProcessOptions,
  onProgress: (event: CodingEvent) => void,
): Promise<Fallible<{ summary: string }>> {
  return new Promise((resolve) => {
    new ClaudeRun(task, cwd, options, onProgress, resolve);
  });
}
