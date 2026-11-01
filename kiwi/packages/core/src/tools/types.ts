import type { z } from 'zod';
import type { AppEntry, SitesConfig } from '@kiwi/shared';
import type { InverseAction, PlatformPort } from '../ports';
import type { ToolServices } from '../services';

export type Risk = 'read' | 'write' | 'sensitive';

export interface ToolContext {
  platform: PlatformPort;
  apps: AppEntry[];
  sites: SitesConfig;
  services: ToolServices;
}

export type ToolOutcome =
  | {
      ok: true;
      summary: string;
      untrustedData?: string;
      inverse?: InverseAction;
      /** Shown to the user as the assistant's reply. */
      say?: string;
      /** Extra DONE receipt lines, e.g. a list of sources. */
      receipts?: string[];
      /** Small proof image as a data URL. */
      image?: string;
    }
  | { ok: false; message: string };

export interface ToolDefinition<Args = unknown> {
  name: string;
  description: string;
  risk: Risk;
  /** The tool asks for confirmation itself, so the generic Yes/No step is skipped. */
  selfConfirming?: boolean;
  /** Internal tools (used for undo) are never offered to the model. */
  internal?: boolean;
  argsSchema: z.ZodType<Args>;
  /** One-line plan shown before confirmation. */
  describe(args: Args): string;
  execute(args: Args, context: ToolContext): Promise<ToolOutcome>;
}

export const defineTool = <Args>(tool: ToolDefinition<Args>): ToolDefinition => tool;
