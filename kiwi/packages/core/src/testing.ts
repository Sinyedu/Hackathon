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

export interface TestAgent {
  agent: Agent;
  events: AgentEvent[];
  platform: FakePlatform;
  llm: FakeLlm;
}

export function createTestAgent(
  options: { llm?: LlmResult[]; confirm?: ConfirmationPort } = {},
): TestAgent {
  const events: AgentEvent[] = [];
  const platform = createFakePlatform();
  const llm = createFakeLlm(options.llm ?? []);
  const apps = appsConfigSchema.parse(defaultAppsJson).apps;
  const sites = sitesConfigSchema.parse(defaultSitesJson);
  let counter = 0;
  const agent = createAgent({
    llm,
    registry: defaultRegistry(),
    context: { platform, apps, sites },
    confirm: options.confirm ?? autoConfirm(true),
    journal: createJournal(),
    commands: commandsConfigSchema.parse(defaultCommandsJson),
    apps,
    sites,
    planningModel: 'fake-model',
    emit: (event) => events.push(event),
    newId: () => `id-${(counter += 1)}`,
  });
  return { agent, events, platform, llm };
}
