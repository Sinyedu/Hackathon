import { z } from 'zod';
import type { CodingBackendPort, ToolServices } from '../services';
import { defineTool, type ToolContext, type ToolOutcome } from './types';

const DISABLED =
  'Code delegation is off. Turn it on in settings and add a project folder first. Check the hackathon rules about proprietary models before enabling it.';

function resolveProject(requested: string | undefined, projects: string[]): string | null {
  if (projects.length === 0) return null;
  if (!requested) return projects.length === 1 ? (projects[0] ?? null) : null;
  const wanted = requested.toLowerCase();
  return (
    projects.find(
      (path) => path.toLowerCase() === wanted || path.toLowerCase().endsWith(`/${wanted}`),
    ) ?? null
  );
}

/** Running tests executes code from the agent's changes, so it needs its own explicit Yes. */
async function maybeRunTests(services: ToolServices, code: CodingBackendPort): Promise<string> {
  const line = `Run "${services.codeConfig.testCommand}" in the isolated branch? It executes code from the changes.`;
  const id = services.newId();
  services.emit({ type: 'receipt', id, status: 'PLANNED', text: line });
  services.emit({ type: 'confirmationRequested', id, lines: [line] });
  const accepted = await services.confirm.confirm({ id, lines: [line] });
  services.emit({ type: 'confirmationResolved', id, accepted });
  return accepted ? code.runTests() : 'not run';
}

export const delegateCode = defineTool({
  name: 'delegate_code',
  description:
    'Delegate a small coding task to a coding agent in an isolated branch of an allowed project. Nothing changes until the user says keep.',
  risk: 'sensitive',
  selfConfirming: true,
  argsSchema: z.object({
    task: z.string().min(5).max(500),
    project: z.string().max(200).optional(),
  }),
  describe: ({ task }) => `Delegate a coding task: ${task}`,
  async execute({ task, project }, { services }: ToolContext): Promise<ToolOutcome> {
    const { code, codeConfig } = services;
    if (!codeConfig.enabled || !code) return { ok: false, message: DISABLED };
    const path = resolveProject(project, codeConfig.projects);
    if (!path)
      return { ok: false, message: 'Name one of the allowed project folders for this task.' };

    const plan = `Run a ${code.label} coding agent in a new branch of ${path.split('/').pop() ?? path}: ${task}`;
    const id = services.newId();
    services.emit({ type: 'receipt', id, status: 'PLANNED', text: plan });
    services.emit({ type: 'confirmationRequested', id, lines: [plan] });
    const accepted = await services.confirm.confirm({ id, lines: [plan] });
    services.emit({ type: 'confirmationResolved', id, accepted });
    if (!accepted) return { ok: false, message: 'Cancelled: no coding task was started.' };

    const result = await code.run(task, path, (event) =>
      services.emit({
        type: 'receipt',
        id: services.newId(),
        status: 'DONE',
        text: `[${code.label}] ${event.text}`,
      }),
    );
    if (!result.ok) return { ok: false, message: result.message };
    const tests = await maybeRunTests(services, code);
    return {
      ok: true,
      summary: `Coding task finished (${code.label})`,
      receipts: [`Changes: ${result.diffSummary}`, `Tests: ${tests}`],
      say: `${result.summary} Say keep, show diff or discard.`,
    };
  },
});

const requirePending = ({ services }: ToolContext): ToolOutcome | null =>
  services.code?.hasPending()
    ? null
    : { ok: false, message: 'There is no coding result waiting for a decision.' };

export const codeKeep = defineTool({
  name: 'code_keep',
  description: 'Keep the delegated coding result by merging its branch.',
  risk: 'sensitive',
  argsSchema: z.object({}),
  describe: () => 'Merge the coding branch into your project',
  async execute(_args, context) {
    const blocked = requirePending(context);
    if (blocked) return blocked;
    const result = await context.services.code?.keep();
    return result?.ok
      ? { ok: true, summary: result.message }
      : { ok: false, message: result?.message ?? 'No coding backend.' };
  },
});

export const codeDiff = defineTool({
  name: 'code_diff',
  description: 'Show the diff of the delegated coding result.',
  risk: 'read',
  argsSchema: z.object({}),
  describe: () => 'Show the coding diff',
  async execute(_args, context) {
    const blocked = requirePending(context);
    if (blocked) return blocked;
    const diff = (await context.services.code?.diff()) ?? '';
    return { ok: true, summary: 'Showing the diff', say: diff.slice(0, 1500) };
  },
});

export const codeDiscard = defineTool({
  name: 'code_discard',
  description: 'Discard the delegated coding result and delete its branch.',
  risk: 'write',
  argsSchema: z.object({}),
  describe: () => 'Discard the coding branch',
  async execute(_args, context) {
    const blocked = requirePending(context);
    if (blocked) return blocked;
    await context.services.code?.discard();
    return { ok: true, summary: 'Discarded the coding result' };
  },
});
