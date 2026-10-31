import { randomUUID } from 'node:crypto';
import { BrowserWindow } from 'electron';
import { createAgent, createJournal, defaultRegistry, type Agent } from '@kiwi/core';
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
import { loadConfig } from './adapters/config-files';
import { createConfirmationBridge, type ConfirmationBridge } from './adapters/confirmation';
import { createOllamaClient } from './adapters/ollama-client';
import { createElectronPlatform } from './adapters/platform';

export interface AgentHost {
  send(text: string): void;
  undo(): void;
  confirm(id: string, accepted: boolean): void;
  cancel(): void;
}

function broadcast(event: AgentEvent): void {
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

export function createAgentHost(settings: Settings): AgentHost {
  const { apps, sites, commands } = loadConfigs();
  const confirmation: ConfirmationBridge = createConfirmationBridge();

  const platform = createElectronPlatform({
    apps: apps.value,
    onTimerFinished: (label) => broadcast({ type: 'notice', text: `${label} is done.` }),
  });
  const agent: Agent = createAgent({
    llm: createOllamaClient(settings.ollamaUrl),
    registry: defaultRegistry(),
    context: { platform, apps: apps.value.apps, sites: sites.value },
    confirm: confirmation,
    journal: createJournal(),
    commands: commands.value,
    apps: apps.value.apps,
    sites: sites.value,
    planningModel: settings.planningModel,
    emit: broadcast,
    newId: randomUUID,
  });

  let queue: Promise<void> = Promise.resolve();
  const enqueue = (task: () => Promise<void>): void => {
    queue = queue.then(task).catch((error: unknown) => {
      console.error('Agent run failed', error);
      broadcast({ type: 'runFinished', outcome: 'error' });
    });
  };

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
