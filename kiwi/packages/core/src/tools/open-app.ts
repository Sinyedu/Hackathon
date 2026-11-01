import { z } from 'zod';
import { resolveApp } from '../safety';
import { defineTool } from './types';

export const openApp = defineTool({
  name: 'open_app',
  description: 'Open an application from the allowed list by name.',
  risk: 'read',
  argsSchema: z.object({ app: z.string().min(1).max(60) }),
  describe: ({ app }) => `Open ${app}`,
  async execute({ app }, { apps, platform }) {
    const entry = resolveApp(app, apps);
    if (!entry) {
      return {
        ok: false,
        message: `“${app}” is not on Kiwi's allowed apps list. Add it to apps.json to allow it.`,
      };
    }
    await platform.launchApp(entry.id);
    return { ok: true, summary: `Opened ${entry.name}` };
  },
});
