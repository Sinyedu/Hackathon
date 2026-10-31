import type { z } from 'zod';
import type { AppEntry, SitesConfig } from '@kiwi/shared';
import type { InverseAction, PlatformPort } from '../ports';

export type Risk = 'read' | 'write' | 'sensitive';

export interface ToolContext {
  platform: PlatformPort;
  apps: AppEntry[];
  sites: SitesConfig;
}

export type ToolOutcome =
  | { ok: true; summary: string; untrustedData?: string; inverse?: InverseAction }
  | { ok: false; message: string };

export interface ToolDefinition<Args = unknown> {
  name: string;
  description: string;
  risk: Risk;
  /** Internal tools (used for undo) are never offered to the model. */
  internal?: boolean;
  argsSchema: z.ZodType<Args>;
  /** One-line plan shown before confirmation. */
  describe(args: Args): string;
  execute(args: Args, context: ToolContext): Promise<ToolOutcome>;
}

export const defineTool = <Args>(tool: ToolDefinition<Args>): ToolDefinition => tool;
