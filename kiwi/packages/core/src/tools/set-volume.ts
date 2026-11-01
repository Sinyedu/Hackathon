import { z } from 'zod';
import { defineTool } from './types';

const labels = {
  up: 'Turn the volume up',
  down: 'Turn the volume down',
  mute: 'Mute or unmute the sound',
};
const opposite = { up: 'down', down: 'up', mute: 'mute' } as const;

export const setVolume = defineTool({
  name: 'set_volume',
  description: 'Turn the system volume up or down one step, or toggle mute.',
  risk: 'read',
  argsSchema: z.object({ action: z.enum(['up', 'down', 'mute']) }),
  describe: ({ action }) => labels[action],
  async execute({ action }, { platform }) {
    await platform.adjustVolume(action);
    return {
      ok: true,
      summary: labels[action],
      inverse: {
        tool: 'set_volume',
        args: { action: opposite[action] },
        description: labels[opposite[action]],
      },
    };
  },
});
