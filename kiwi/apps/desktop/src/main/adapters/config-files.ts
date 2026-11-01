import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { app } from 'electron';
import type { z } from 'zod';

export interface LoadedConfig<T> {
  value: T;
  /** Set when the file on disk was unusable and defaults were used instead. */
  problem?: string;
}

export const configPath = (fileName: string): string => join(app.getPath('userData'), fileName);

function describeIssues(error: z.ZodError): string {
  return error.issues
    .map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
    .join('; ');
}

/** Reads a zod-validated JSON config from userData, creating it from defaults when missing. */
export function loadConfig<T>(
  fileName: string,
  schema: z.ZodType<T>,
  defaults: unknown,
): LoadedConfig<T> {
  const path = configPath(fileName);
  const fallback = schema.parse(defaults);
  if (!existsSync(path)) {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, JSON.stringify(defaults, null, 2));
    return { value: fallback };
  }
  let json: unknown;
  try {
    json = JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    return {
      value: fallback,
      problem: `${fileName} is not valid JSON (${String(error)}); using defaults.`,
    };
  }
  const parsed = schema.safeParse(json);
  if (parsed.success) return { value: parsed.data };
  return {
    value: fallback,
    problem: `${fileName} is invalid (${describeIssues(parsed.error)}); using defaults.`,
  };
}

export function saveConfig(fileName: string, value: unknown): void {
  writeFileSync(configPath(fileName), JSON.stringify(value, null, 2));
}
