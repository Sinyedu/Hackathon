import type { AppEntry, CommandEntry, CommandsConfig, SitesConfig } from '@kiwi/shared';
import { resolveApp, resolveSite } from './safety';

export interface RoutedCall {
  tool: string;
  args: Record<string, unknown>;
}

const SLOT_PATTERNS: Record<string, string> = {
  amount: '\\d+(?:\\.\\d+)?|[a-z]+',
  unit: '[a-z°]+',
  language: '[a-z]+',
  text: '.+',
  target: '.+',
};

const escapeRegex = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function compile(pattern: string): RegExp {
  const source = pattern
    .split(/(\{\w+\})/)
    .map((part) => {
      const slot = /^\{(\w+)\}$/.exec(part)?.[1];
      if (slot) return `(?<${slot}>${SLOT_PATTERNS[slot] ?? '.+'})`;
      return escapeRegex(part).replace(/\s+/g, '\\s+');
    })
    .join('');
  return new RegExp(`^${source}$`, 'i');
}

function stripFillers(text: string, fillers: string[], trailing: string[]): string {
  const byLength = (list: string[]): string[] => [...list].sort((a, b) => b.length - a.length);
  const lead = byLength(fillers).map(
    (filler) => new RegExp(`^${escapeRegex(filler)}(?:[\\s,]+|$)`, 'i'),
  );
  const tail = byLength(trailing).map(
    (filler) => new RegExp(`(?:^|[\\s,]+)${escapeRegex(filler)}$`, 'i'),
  );
  let current = text;
  for (let changed = true; changed;) {
    changed = false;
    for (const regex of [...lead, ...tail]) {
      const next = current.replace(regex, '').trim();
      if (next !== current) {
        current = next;
        changed = true;
      }
    }
  }
  return current;
}

function parseAmount(raw: string, numberWords: Record<string, number>): number | undefined {
  const value = /^\d+(?:\.\d+)?$/.test(raw) ? Number(raw) : numberWords[raw.toLowerCase()];
  return value !== undefined && value > 0 ? value : undefined;
}

function secondsFor(unit: string, units: CommandsConfig['units']): number | undefined {
  const lower = unit.toLowerCase();
  if (units.seconds.includes(lower)) return 1;
  if (units.minutes.includes(lower)) return 60;
  if (units.hours.includes(lower)) return 3600;
  return undefined;
}

interface Resolvers {
  config: CommandsConfig;
  apps: AppEntry[];
  sites: SitesConfig;
}

function routeOpen(rawTarget: string, { apps, sites }: Resolvers): RoutedCall | null {
  const target = rawTarget.replace(/^(?:the|my|a)\s+/i, '');
  const app = resolveApp(target, apps);
  if (app) return { tool: 'open_app', args: { app: app.name } };
  const site = resolveSite(target, sites.sites);
  if (site) return { tool: 'open_url', args: { url: site.url } };
  if (/^[\w-]+(\.[\w-]+)+(\/\S*)?$/.test(target))
    return { tool: 'open_url', args: { url: `https://${target}` } };
  const looksLikeOneRequest = /^\S+(?: \S+)?$/.test(target) && !/\b(and|then)\b/i.test(target);
  return looksLikeOneRequest ? { tool: 'open_app', args: { app: target } } : null;
}

/** Fills tool arguments from slots using the command's slotArgs mapping. */
function mapSlots(command: CommandEntry, groups: Record<string, string>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(command.slotArgs).map(([slot, arg]) => {
      const raw = (groups[slot] ?? '').trim();
      return [arg, /^-?\d+(?:\.\d+)?$/.test(raw) ? Number(raw) : raw];
    }),
  );
}

function buildCall(
  command: CommandEntry,
  groups: Record<string, string>,
  resolvers: Resolvers,
): RoutedCall | null {
  const { config } = resolvers;
  switch (command.tool) {
    case 'open':
      return routeOpen((groups['target'] ?? '').trim(), resolvers);
    case 'set_timer': {
      const amount = parseAmount(groups['amount'] ?? '', config.numberWords);
      const multiplier = secondsFor(groups['unit'] ?? '', config.units);
      if (amount === undefined || multiplier === undefined) return null;
      const seconds = Math.round(amount * multiplier);
      return seconds >= 1 ? { tool: 'set_timer', args: { seconds, label: 'Timer' } } : null;
    }
    case 'write_note':
      return { tool: 'write_note', args: { text: (groups['text'] ?? '').trim() } };
    case 'web_search':
      return {
        tool: 'web_search',
        args: { ...command.args, query: (groups['text'] ?? '').trim() },
      };
    default:
      return { tool: command.tool, args: { ...command.args, ...mapSlots(command, groups) } };
  }
}

/** Deterministic fast path: returns a tool call, or null when the model should decide. */
export function createRouter(resolvers: Resolvers): (userText: string) => RoutedCall | null {
  const { config } = resolvers;
  const compiled = config.commands.flatMap((command) =>
    command.patterns.map((pattern) => ({ command, regex: compile(pattern) })),
  );

  return (userText) => {
    const cleaned = stripFillers(
      userText
        .trim()
        .replace(/[.!?]+$/, '')
        .replace(/\s+/g, ' '),
      config.fillers,
      config.trailingFillers,
    );
    if (cleaned === '') return null;
    for (const { command, regex } of compiled) {
      const match = regex.exec(cleaned);
      if (!match) continue;
      const call = buildCall(command, match.groups ?? {}, resolvers);
      if (call) return call;
    }
    return null;
  };
}
