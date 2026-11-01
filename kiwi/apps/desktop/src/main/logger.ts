import { appendFileSync, mkdirSync, renameSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { app } from 'electron';

const MAX_BYTES = 1_000_000;

function logPath(): string {
  const dir = join(app.getPath('userData'), 'logs');
  mkdirSync(dir, { recursive: true });
  return join(dir, 'kiwi.log');
}

function write(level: string, message: string): void {
  try {
    const path = logPath();
    const size = statSync(path, { throwIfNoEntry: false })?.size ?? 0;
    if (size > MAX_BYTES) renameSync(path, `${path}.1`);
    appendFileSync(path, `${new Date().toISOString()} ${level} ${message}\n`);
  } catch {
    // Logging must never crash the app; the console still has the message.
  }
}

/** Local, size-capped log. It only ever receives short text messages: never audio or screenshots. */
export const log = {
  info: (message: string): void => write('INFO', message),
  warn(message: string): void {
    console.warn(message);
    write('WARN', message);
  },
  error(message: string, error?: unknown): void {
    const detail = error instanceof Error ? error.message : typeof error === 'string' ? error : '';
    console.error(message, detail);
    write('ERROR', `${message} ${detail}`.trim());
  },
};

export function installCrashLogging(): void {
  process.on('uncaughtException', (error) => log.error('Uncaught exception', error));
  process.on('unhandledRejection', (reason) => log.error('Unhandled rejection', reason));
}
