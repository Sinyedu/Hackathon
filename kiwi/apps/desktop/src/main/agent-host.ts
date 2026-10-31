import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { app, BrowserWindow } from 'electron';
import {
  ReplayBackend,
  createAgent,
  createJournal,
  defaultRegistry,
  type Agent,
  type CodingBackendPort,
  type LlmClient,
  type ToolServices,
} from '@kiwi/core';
import {
  appsConfigSchema,
  commandsConfigSchema,
  defaultAppsJson,
  defaultCommandsJson,
  defaultSitesJson,
  ipcChannels,
  sitesConfigSchema,
  type AgentEvent,
  type Settings,
} from '@kiwi/shared';
import { log } from './logger';
import { loadConfig } from './adapters/config-files';
import { ClaudeCodeBackend } from './adapters/claude-code-backend';
import { createConfirmationBridge, type ConfirmationBridge } from './adapters/confirmation';
import { createModelPort } from './adapters/model-port';
import { createElectronPlatform } from './adapters/platform';
import { demoRecording } from './adapters/replay-recording';
import { defaultSandboxRoot } from './adapters/sandbox-notes';
import { createSandboxFiles } from './adapters/sandbox-files';
import { createScreenPort } from './adapters/screen';
import { createWebPort } from './adapters/web';

export interface AgentHost {
  send(text: string): void;
  undo(): void;
  confirm(id: string, accepted: boolean): void;
  cancel(): void;
}

export function broadcast(event: AgentEvent): void {
  for (const window of BrowserWindow.getAllWindows()) {
    if (!window.isDestroyed()) window.webContents.send(ipcChannels.agentEvent, event);
  }
}

function loadConfigs() {
  const apps = loadConfig('apps.json', appsConfigSchema, defaultAppsJson);
  const sites = loadConfig('sites.json', sitesConfigSchema, defaultSitesJson);
  const commands = loadConfig('commands.json', commandsConfigSchema, defaultCommandsJson);
  return { apps, sites, commands };
}

/** Surfaces unusable config files in the chat once the panel has had time to load. */
function reportConfigProblems(problems: (string | undefined)[]): void {
  for (const problem of problems) {
    if (problem) setTimeout(() => broadcast({ type: 'notice', text: problem }), 1500);
  }
}

/** The coding backend follows the current settings and is only created when delegation is on. */
function codingBackend(
  settings: Settings,
  cache: { current: CodingBackendPort | null; key: string },
): CodingBackendPort | null {
  const { enabled, backend, testCommand } = settings.codeDelegation;
  if (!enabled) return null;
  const key = `${backend}:${testCommand}`;
  if (cache.key === key && cache.current) return cache.current;
  cache.key = key;
  cache.current =
    backend === 'replay'
      ? new ReplayBackend(demoRecording)
      : new ClaudeCodeBackend({
          worktreeRoot: join(app.getPath('userData'), 'worktrees'),
          testCommand,
        });
  return cache.current;
}

function buildServices(
  settings: Settings,
  llm: LlmClient,
  confirmation: ConfirmationBridge,
): ToolServices {
  const cache: { current: CodingBackendPort | null; key: string } = { current: null, key: '' };
  const sandbox = (): string => settings.sandboxPath ?? defaultSandboxRoot();
  const models = {
    get fast() {
      return settings.fastModel;
    },
    get vision() {
      return settings.visionModel;
    },
  };
  return {
    web: createWebPort(),
    model: createModelPort(llm, models),
    screen: createScreenPort(),
    files: createSandboxFiles(sandbox),
    get code() {
      return codingBackend(settings, cache);
    },
    get codeConfig() {
      return {
        enabled: settings.codeDelegation.enabled,
        projects: settings.codeDelegation.projects,
        testCommand: settings.codeDelegation.testCommand,
      };
    },
    confirm: confirmation,
    emit: broadcast,
    newId: randomUUID,
  };
}

/** Runs agent tasks one at a time; a failed task reports an error instead of breaking the chain. */
function serialQueue(): (task: () => Promise<void>) => void {
  let queue: Promise<void> = Promise.resolve();
  return (task) => {
    queue = queue.then(task).catch((error: unknown) => {
      log.error('Agent run failed', error);
      broadcast({ type: 'runFinished', outcome: 'error' });
    });
  };
}

export function createAgentHost(settings: Settings, llm: LlmClient): AgentHost {
  const { apps, sites, commands } = loadConfigs();
  const confirmation = createConfirmationBridge();
  const platform = createElectronPlatform({
    apps: apps.value,
    sandboxRoot: () => settings.sandboxPath ?? defaultSandboxRoot(),
    onTimerFinished: (label) => broadcast({ type: 'notice', text: `${label} is done.` }),
  });
  const agent: Agent = createAgent({
    llm,
    registry: defaultRegistry(),
    context: {
      platform,
      apps: apps.value.apps,
      sites: sites.value,
      services: buildServices(settings, llm, confirmation),
    },
    confirm: confirmation,
    journal: createJournal(),
    commands: commands.value,
    apps: apps.value.apps,
    sites: sites.value,
    get planningModel() {
      return settings.planningModel;
    },
    emit: broadcast,
    newId: randomUUID,
  });

  const enqueue = serialQueue();
  reportConfigProblems([apps.problem, sites.problem, commands.problem]);

  return {
    send: (text) => enqueue(() => agent.run(text)),
    undo: () => enqueue(() => agent.undo()),
    confirm: (id, accepted) => confirmation.resolve(id, accepted),
    cancel() {
      agent.cancel();
      confirmation.cancelAll();
    },
  };
}
