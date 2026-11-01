import { z } from 'zod';
import { defineTool } from './types';

export const listAppsAllowed = defineTool({
  name: 'list_apps_allowed',
  description: 'List the applications Kiwi is allowed to open.',
  risk: 'read',
  argsSchema: z.object({}),
  describe: () => 'List allowed apps',
  execute: (_args, { apps }) =>
    Promise.resolve({
      ok: true,
      summary: `Allowed apps: ${apps.map((app) => app.name).join(', ')}`,
    }),
});

export const getTime = defineTool({
  name: 'get_time',
  description: 'Get the current local time.',
  risk: 'read',
  argsSchema: z.object({}),
  describe: () => 'Check the time',
  execute: (_args, { platform }) =>
    Promise.resolve({
      ok: true,
      summary: `It is ${platform.now().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`,
    }),
});
