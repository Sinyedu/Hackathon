import { z } from 'zod';
import { splitSentences } from '../voice/sentences';
import { defineTool } from './types';

export const screenshotDescribe = defineTool({
  name: 'screenshot_describe',
  description:
    'Take a screenshot and describe what is on the screen, or explain an error message shown on it.',
  risk: 'sensitive',
  argsSchema: z.object({ explainError: z.boolean().default(false) }),
  describe: ({ explainError }) =>
    explainError ? 'Look at your screen and explain the error' : 'Look at your screen',
  async execute({ explainError }, { services }) {
    const shot = await services.screen.capture();
    const prompt = explainError
      ? 'There is an error message on this screen. Say what it means and one thing to try, in at most 2 short sentences.'
      : 'Describe what is on this screen in at most 2 short sentences.';
    const result = await services.model.generate('vision', prompt, [shot.imageBase64]);
    if (!result.ok) return { ok: false, message: result.message };
    return {
      ok: true,
      summary: 'Looked at the screen',
      say: splitSentences(result.text).slice(0, 2).join(' '),
      image: shot.thumbnailDataUrl,
    };
  },
});
