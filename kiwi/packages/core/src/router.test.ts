import {
  appsConfigSchema,
  commandsConfigSchema,
  defaultAppsJson,
  defaultCommandsJson,
  defaultSitesJson,
  sitesConfigSchema,
} from '@kiwi/shared';
import { describe, expect, it } from 'vitest';
import { createRouter, type RoutedCall } from './router';

const route = createRouter({
  config: commandsConfigSchema.parse(defaultCommandsJson),
  apps: appsConfigSchema.parse(defaultAppsJson).apps,
  sites: sitesConfigSchema.parse(defaultSitesJson),
});

const openUrl = (url: string): RoutedCall => ({ tool: 'open_url', args: { url } });
const timer = (seconds: number): RoutedCall => ({
  tool: 'set_timer',
  args: { seconds, label: 'Timer' },
});
const search = (query: string, engine = 'web'): RoutedCall => ({
  tool: 'web_search',
  args: { engine, query },
});
const note = (text: string): RoutedCall => ({ tool: 'write_note', args: { text } });
const volume = (action: string): RoutedCall => ({ tool: 'set_volume', args: { action } });
const app = (name: string): RoutedCall => ({ tool: 'open_app', args: { app: name } });

const cases: [string, RoutedCall][] = [
  ['open github', openUrl('https://github.com')],
  ['Open GitHub', openUrl('https://github.com')],
  ['go to youtube', openUrl('https://www.youtube.com')],
  ['visit wikipedia', openUrl('https://www.wikipedia.org')],
  ['open stack overflow', openUrl('https://stackoverflow.com')],
  ['take me to reddit', openUrl('https://www.reddit.com')],
  ['go to example.com', openUrl('https://example.com')],
  ['open spotify', app('Spotify')],
  ['launch calculator', app('Calculator')],
  ['start vs code', app('VS Code')],
  ['open notepad', app('Text editor')],
  ['hey can you please open spotify', app('Spotify')],
  ['Kiwi, open the calculator', app('Calculator')],
  ['kiwi open calc', app('Calculator')],
  ['could you launch calc please', app('Calculator')],
  ['open photoshop', app('photoshop')],
  ['search electron docs', search('electron docs')],
  ['search for electron ipc docs', search('electron ipc docs')],
  ['google typescript generics', search('typescript generics')],
  ['look up rust lifetimes', search('rust lifetimes')],
  ['hey kiwi search for cat videos please', search('cat videos')],
  ['search youtube lofi beats', search('lofi beats', 'youtube')],
  ['search youtube for lofi beats', search('lofi beats', 'youtube')],
  ['search for lofi beats on youtube', search('lofi beats', 'youtube')],
  ['timer 1 minute', timer(60)],
  ['timer 5 minutes', timer(300)],
  ['set a timer for 10 minutes', timer(600)],
  ['set a timer for one minute', timer(60)],
  ['set a 30 second timer', timer(30)],
  ['2 hour timer', timer(7200)],
  ['timer for 90 seconds', timer(90)],
  ['can you set a timer for twenty minutes please', timer(1200)],
  ['remind me in 5 mins', timer(300)],
  ['note buy milk', note('buy milk')],
  ['take a note call mom tomorrow', note('call mom tomorrow')],
  ['note that the wifi password is on the fridge', note('the wifi password is on the fridge')],
  ['hey please jot down ideas for the demo', note('ideas for the demo')],
  ['volume down', volume('down')],
  ['volume up', volume('up')],
  ['turn the volume down', volume('down')],
  ['louder please', volume('up')],
  ['mute', volume('mute')],
  ['what time is it', { tool: 'get_time', args: {} }],
  ["hey kiwi what's the time", { tool: 'get_time', args: {} }],
];

describe('createRouter', () => {
  it.each(cases)('routes %j', (text, expected) => {
    expect(route(text)).toEqual(expected);
  });

  it('has at least 40 phrase cases', () => {
    expect(cases.length).toBeGreaterThanOrEqual(40);
  });

  it.each([
    'open github and search for electron ipc docs',
    'what is the capital of france',
    'tell me a joke',
    'timer',
    'timer banana minutes',
    'note',
    'summarize my clipboard',
    '',
    '   ',
  ])('leaves %j for the model', (text) => {
    expect(route(text)).toBeNull();
  });
});
