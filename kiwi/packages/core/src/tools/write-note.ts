import { z } from 'zod';
import { defineTool } from './types';

export const writeNote = defineTool({
  name: 'write_note',
  description: 'Save a short text note in the Kiwi sandbox folder.',
  risk: 'write',
  argsSchema: z.object({ text: z.string().min(1).max(2000) }),
  describe: ({ text }) => `Save a note: “${text}”`,
  async execute({ text }, { platform }) {
    const notePath = await platform.writeNote(text);
    return {
      ok: true,
      summary: `Saved note “${text}”`,
      inverse: { tool: 'trash_note', args: { notePath }, description: 'Move the note to .trash' },
    };
  },
});

export const trashNote = defineTool({
  name: 'trash_note',
  description: 'Move a note to the sandbox .trash folder.',
  risk: 'write',
  internal: true,
  argsSchema: z.object({ notePath: z.string() }),
  describe: () => 'Move the note to .trash',
  async execute({ notePath }, { platform }) {
    await platform.trashNote(notePath);
    return { ok: true, summary: 'Moved the note to .trash' };
  },
});
