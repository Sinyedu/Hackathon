import {
  appsConfigSchema,
  commandsConfigSchema,
  defaultAppsJson,
  defaultCommandsJson,
  defaultSitesJson,
  sitesConfigSchema,
} from '@kiwi/shared';
import { describe, expect, it } from 'vitest';
import { createRouter } from './router';

const route = createRouter({
  config: commandsConfigSchema.parse(defaultCommandsJson),
  apps: appsConfigSchema.parse(defaultAppsJson).apps,
  sites: sitesConfigSchema.parse(defaultSitesJson),
});

// The chat panel's quick actions (renderer/chat/QuickActions.tsx) must do what their labels say.
describe('research and notes quick actions', () => {
  it('"Research a topic" runs the research tool on the topic', () => {
    expect(route('research how honeybees make honey')).toEqual({
      tool: 'research',
      args: { topic: 'how honeybees make honey' },
    });
  });

  it('"What am I reading?" describes the screen', () => {
    expect(route('what is on my screen')?.tool).toBe('screenshot_describe');
  });

  it.each(['what am i reading', 'What am I reading?', 'what am i reading right now'])(
    'typing %j also describes the screen without the model',
    (text) => {
      expect(route(text)?.tool).toBe('screenshot_describe');
    },
  );

  it('"Take a note" saves the text as a note', () => {
    expect(route('take a note read the paper on sleep')).toEqual({
      tool: 'write_note',
      args: { text: 'read the paper on sleep' },
    });
  });

  it('"Note my clipboard" is left to the model, so the clipboard is read before it is saved', () => {
    expect(route('read my clipboard and save it as a note')).toBeNull();
  });
});
