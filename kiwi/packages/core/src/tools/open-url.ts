import { z } from 'zod';
import { checkUrl } from '../safety';
import { defineTool } from './types';

export const openUrl = defineTool({
  name: 'open_url',
  description: 'Open a web address (http or https) in the default browser.',
  risk: 'read',
  argsSchema: z.object({ url: z.string().min(1).max(2000) }),
  describe: ({ url }) => `Open ${url}`,
  async execute({ url }, { platform }) {
    const checked = checkUrl(url);
    if (!checked.ok) return { ok: false, message: checked.message };
    await platform.openUrl(checked.value);
    return { ok: true, summary: `Opened ${new URL(checked.value).hostname}` };
  },
});
