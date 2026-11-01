import { z } from 'zod';
import { defineTool } from './types';

/** Opens a blank page in the user's default browser. */
export const openBlankTab = defineTool({
  name: 'open_blank_tab',
  description: 'Open a new blank tab in the default web browser.',
  risk: 'read',
  argsSchema: z.object({}),
  describe: () => 'Open a new browser tab',
  async execute(_args, { platform }) {
    await platform.openUrl('about:blank');
    return { ok: true, summary: 'Opened a new browser tab' };
  },
});
