import { z } from 'zod';
import type { LlmToolSpec } from '../ports';
import { codeDiff, codeDiscard, codeKeep, delegateCode } from './delegate-code';
import { calculate, convertUnitsTool, define, getWeather, translate } from './info-extra';
import { research } from './research';
import { screenshotDescribe } from './screenshot';
import { sortFolder, undoMoves } from './sort-folder';
import { clipboardRead, clipboardWrite } from './clipboard';
import { getTime, listAppsAllowed } from './info';
import { openApp } from './open-app';
import { openBlankTab } from './open-blank-tab';
import { openUrl } from './open-url';
import { setTimer, cancelTimer } from './set-timer';
import { setVolume } from './set-volume';
import type { ToolDefinition } from './types';
import { webSearch } from './web-search';
import { trashNote, writeNote } from './write-note';

export interface ToolRegistry {
  get(name: string): ToolDefinition | undefined;
  forModel(): LlmToolSpec[];
}

export function createRegistry(tools: ToolDefinition[]): ToolRegistry {
  const byName = new Map(tools.map((tool) => [tool.name, tool]));
  return {
    get: (name) => byName.get(name),
    forModel: () =>
      tools
        .filter((tool) => !tool.internal)
        .map((tool) => ({
          name: tool.name,
          description: tool.description,
          parameters: z.toJSONSchema(tool.argsSchema),
        })),
  };
}

export const defaultRegistry = (): ToolRegistry =>
  createRegistry([
    openApp,
    openBlankTab,
    openUrl,
    webSearch,
    setTimer,
    cancelTimer,
    writeNote,
    trashNote,
    clipboardRead,
    clipboardWrite,
    setVolume,
    listAppsAllowed,
    getTime,
    research,
    screenshotDescribe,
    sortFolder,
    undoMoves,
    getWeather,
    calculate,
    convertUnitsTool,
    translate,
    define,
    delegateCode,
    codeKeep,
    codeDiff,
    codeDiscard,
  ]);
