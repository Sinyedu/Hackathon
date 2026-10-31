import { z } from 'zod';
import { checkUrl } from '../safety';
import { defineTool } from './types';

export const webSearch = defineTool({
  name: 'web_search',
  description: 'Search the web (engine "web") or YouTube (engine "youtube") in the browser.',
  risk: 'read',
  argsSchema: z.object({
    query: z.string().min(1).max(300),
    engine: z.enum(['web', 'youtube']).default('web'),
  }),
  describe: ({ query, engine }) =>
    `Search ${engine === 'youtube' ? 'YouTube' : 'the web'} for “${query}”`,
  async execute({ query, engine }, { platform, sites }) {
    const url = sites.searchUrls[engine].replace('{q}', encodeURIComponent(query));
    const checked = checkUrl(url);
    if (!checked.ok) return { ok: false, message: checked.message };
    await platform.openUrl(checked.value);
    return {
      ok: true,
      summary: `Searched ${engine === 'youtube' ? 'YouTube' : 'the web'} for “${query}”`,
    };
  },
});
