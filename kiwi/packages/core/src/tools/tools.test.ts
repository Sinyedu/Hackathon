import {
  appsConfigSchema,
  defaultAppsJson,
  defaultSitesJson,
  sitesConfigSchema,
} from '@kiwi/shared';
import { describe, expect, it } from 'vitest';
import { createFakePlatform } from '../testing';
import { clipboardRead, clipboardWrite } from './clipboard';
import { getTime, listAppsAllowed } from './info';
import { openUrl } from './open-url';
import { cancelTimer, formatDuration, setTimer } from './set-timer';
import type { ToolContext } from './types';
import { webSearch } from './web-search';

const context = (): ToolContext & { platform: ReturnType<typeof createFakePlatform> } => ({
  platform: createFakePlatform(),
  apps: appsConfigSchema.parse(defaultAppsJson).apps,
  sites: sitesConfigSchema.parse(defaultSitesJson),
});

describe('tools', () => {
  it('encodes search queries into the configured URL', async () => {
    const ctx = context();
    await webSearch.execute({ query: 'a&b c', engine: 'youtube' }, ctx);
    expect(ctx.platform.calls).toEqual([
      'openUrl:https://www.youtube.com/results?search_query=a%26b%20c',
    ]);
  });

  it('refuses non-http URLs', async () => {
    const ctx = context();
    expect(await openUrl.execute({ url: 'file:///etc/passwd' }, ctx)).toMatchObject({ ok: false });
    expect(ctx.platform.calls).toEqual([]);
  });

  it('validates timer bounds', () => {
    expect(setTimer.argsSchema.safeParse({ seconds: 0 }).success).toBe(false);
    expect(setTimer.argsSchema.safeParse({ seconds: 86_401 }).success).toBe(false);
    expect(setTimer.argsSchema.parse({ seconds: 5 })).toEqual({ seconds: 5, label: 'Timer' });
  });

  it('starts a timer with a cancel inverse', async () => {
    const ctx = context();
    const outcome = await setTimer.execute({ seconds: 90, label: 'Tea' }, ctx);
    expect(outcome).toMatchObject({ ok: true, inverse: { tool: 'cancel_timer' } });
    expect(await cancelTimer.execute({ timerId: 't' }, ctx)).toMatchObject({ ok: true });
  });

  it.each([
    [1, '1 second'],
    [45, '45 seconds'],
    [60, '1 minute'],
    [300, '5 minutes'],
    [3600, '1 hour'],
    [7200, '2 hours'],
  ])('formats %i seconds as %s', (seconds, text) => {
    expect(formatDuration(seconds)).toBe(text);
  });

  it('returns clipboard text as untrusted data and restores it on undo', async () => {
    const ctx = context();
    ctx.platform.clipboard = 'old';
    expect(await clipboardRead.execute({}, ctx)).toMatchObject({ ok: true, untrustedData: 'old' });
    const written = await clipboardWrite.execute({ text: 'new' }, ctx);
    expect(written).toMatchObject({
      ok: true,
      inverse: { tool: 'clipboard_write', args: { text: 'old' } },
    });
  });

  it('lists allowed apps and tells the time', async () => {
    const ctx = context();
    expect(await listAppsAllowed.execute({}, ctx)).toMatchObject({
      summary: expect.stringContaining('Calculator') as string,
    });
    expect(await getTime.execute({}, ctx)).toMatchObject({ ok: true });
  });
});
