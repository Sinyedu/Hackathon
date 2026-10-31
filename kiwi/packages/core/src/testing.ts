import {
  appsConfigSchema,
  commandsConfigSchema,
  defaultAppsJson,
  defaultCommandsJson,
  defaultSitesJson,
  sitesConfigSchema,
  type AgentEvent,
} from '@kiwi/shared';
import { createAgent, type Agent } from './agent';
import { createJournal } from './journal';
import type { ConfirmationPort, LlmClient, LlmRequest, LlmResult, PlatformPort } from './ports';
import { defaultRegistry } from './tools/registry';
import type { Fallible, ToolServices } from './services';
import type { ToolContext } from './tools/types';

/** Fakes for tests. Every port has one so core never needs a real adapter. */
export interface FakePlatform extends PlatformPort {
  calls: string[];
  clipboard: string;
}

export function createFakePlatform(): FakePlatform {
  const calls: string[] = [];
  const platform: FakePlatform = {
    calls,
    clipboard: '',
    launchApp: (appId) => Promise.resolve(void calls.push(`launchApp:${appId}`)),
    openUrl: (url) => Promise.resolve(void calls.push(`openUrl:${url}`)),
    startTimer(seconds) {
      calls.push(`startTimer:${seconds}`);
      return `timer-${calls.length}`;
    },
    cancelTimer(timerId) {
      calls.push(`cancelTimer:${timerId}`);
      return true;
    },
    writeNote(text) {
      calls.push(`writeNote:${text}`);
      return Promise.resolve('/sandbox/notes/note.md');
    },
    trashNote: (notePath) => Promise.resolve(void calls.push(`trashNote:${notePath}`)),
    readClipboard: () => Promise.resolve(platform.clipboard),
    writeClipboard(text) {
      calls.push(`writeClipboard:${text}`);
      platform.clipboard = text;
      return Promise.resolve();
    },
    adjustVolume: (action) => Promise.resolve(void calls.push(`volume:${action}`)),
    now: () => new Date('2026-01-01T09:05:00'),
  };
  return platform;
}

export interface FakeLlm extends LlmClient {
  requests: LlmRequest[];
}

export function createFakeLlm(results: LlmResult[]): FakeLlm {
  const queue = [...results];
  const requests: LlmRequest[] = [];
  return {
    requests,
    chat(request) {
      requests.push(request);
      const next = queue.shift();
      return Promise.resolve(
        next ?? { ok: false, kind: 'bad_response', message: 'No scripted reply left' },
      );
    },
    health: () => Promise.resolve({ running: true, models: ['fake'] }),
  };
}

export const reply = (
  content: string,
  toolCalls: { name: string; arguments: unknown }[] = [],
): LlmResult => ({
  ok: true,
  reply: { content, toolCalls },
});

export const autoConfirm = (answer: boolean): ConfirmationPort => ({
  confirm: () => Promise.resolve(answer),
});

export interface FakeServices extends ToolServices {
  moves: string[];
  generated: string[];
  pages: Record<string, string>;
  files: ToolServices['files'];
}

export function createFakeServices(overrides: Partial<ToolServices> = {}): FakeServices {
  const moves: string[] = [];
  const generated: string[] = [];
  const pages: Record<string, string> = {};
  const ok = <T extends object>(value: T): Fallible<T> => ({ ok: true, ...value });
  let listing = ['photo.png', 'report.pdf', 'setup.exe', 'notes.txt', 'mystery'];
  const services: FakeServices = {
    moves,
    generated,
    pages,
    web: {
      search: () => Promise.resolve(ok({ urls: Object.keys(pages) })),
      fetchText: (url) =>
        Promise.resolve(
          url in pages ? ok({ text: pages[url] ?? '' }) : { ok: false, message: 'unreachable' },
        ),
      fetchJson: (url) =>
        Promise.resolve(
          ok({
            json: url.includes('geocoding')
              ? { results: [{ name: 'Sofia', latitude: 1, longitude: 2 }] }
              : { current: { temperature_2m: 9.4, weather_code: 3, wind_speed_10m: 3.7 } },
          }),
        ),
    },
    model: {
      generate(_kind, prompt) {
        generated.push(prompt);
        return Promise.resolve(ok({ text: 'First. Second. Third. Fourth.' }));
      },
    },
    screen: {
      capture: () =>
        Promise.resolve({ imageBase64: 'AAAA', thumbnailDataUrl: 'data:image/png;base64,AAAA' }),
    },
    files: {
      list: () => Promise.resolve(listing),
      move(from, to) {
        moves.push(`${from} -> ${to}`);
        listing = listing.filter((name) => !from.endsWith(`/${name}`));
        return Promise.resolve();
      },
    },
    code: null,
    codeConfig: { enabled: false, projects: [], testCommand: 'npm test' },
    confirm: autoConfirm(true),
    emit: () => undefined,
    newId: (() => {
      let n = 0;
      return () => `svc-${(n += 1)}`;
    })(),
    ...overrides,
  };
  return services;
}

export interface TestAgent {
  agent: Agent;
  events: AgentEvent[];
  platform: FakePlatform;
  llm: FakeLlm;
  services: FakeServices;
}

export function createTestAgent(
  options: { llm?: LlmResult[]; confirm?: ConfirmationPort; services?: Partial<ToolServices> } = {},
): TestAgent {
  const events: AgentEvent[] = [];
  const platform = createFakePlatform();
  const llm = createFakeLlm(options.llm ?? []);
  const apps = appsConfigSchema.parse(defaultAppsJson).apps;
  const sites = sitesConfigSchema.parse(defaultSitesJson);
  let counter = 0;
  const services = createFakeServices({
    confirm: options.confirm ?? autoConfirm(true),
    emit: (event) => events.push(event),
    ...options.services,
  });
  const context: ToolContext = { platform, apps, sites, services };
  const agent = createAgent({
    llm,
    registry: defaultRegistry(),
    context,
    confirm: options.confirm ?? autoConfirm(true),
    journal: createJournal(),
    commands: commandsConfigSchema.parse(defaultCommandsJson),
    apps,
    sites,
    planningModel: 'fake-model',
    emit: (event) => events.push(event),
    newId: () => `id-${(counter += 1)}`,
  });
  return { agent, events, platform, llm, services };
}
