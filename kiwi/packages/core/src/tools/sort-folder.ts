import { z } from 'zod';
import { planSort, type PlannedMove } from '../files/plan-sort';
import { checkSandboxRelative } from '../safety';
import { defineTool, type ToolContext, type ToolOutcome } from './types';

const movesSchema = z.array(z.object({ from: z.string(), to: z.string() }));

async function applyMoves(moves: PlannedMove[], { services }: ToolContext): Promise<PlannedMove[]> {
  const done: PlannedMove[] = [];
  for (const move of moves) {
    try {
      await services.files.move(move.from, move.to);
      done.push(move);
    } catch (error) {
      await revert(done.reverse(), services);
      throw error;
    }
  }
  return done;
}

async function revert(moves: PlannedMove[], services: ToolContext['services']): Promise<void> {
  for (const move of [...moves].reverse()) await services.files.move(move.to, move.from);
}

export const sortFolder = defineTool({
  name: 'sort_folder',
  description:
    'Plan how to group the files of a sandbox folder, ask for confirmation, then move them. Undoable.',
  risk: 'sensitive',
  selfConfirming: true,
  argsSchema: z.object({ folder: z.string().min(1).max(100).default('Downloads') }),
  describe: ({ folder }) => `Sort the files in ${folder}`,
  async execute({ folder }, context): Promise<ToolOutcome> {
    const checked = checkSandboxRelative(folder);
    if (!checked.ok) return { ok: false, message: checked.message };
    const { services } = context;
    const moves = planSort(checked.value, await services.files.list(checked.value));
    if (moves.length === 0) return { ok: true, summary: `${folder} has nothing to sort` };

    const lines = moves.map(
      (move) =>
        `Move ${move.from.split('/').pop() ?? move.from} to ${move.to.split('/').at(-2) ?? ''}`,
    );
    const planId = services.newId();
    for (const [index, line] of lines.entries()) {
      services.emit({ type: 'receipt', id: `${planId}-${index}`, status: 'PLANNED', text: line });
    }
    services.emit({ type: 'confirmationRequested', id: planId, lines });
    const accepted = await services.confirm.confirm({ id: planId, lines });
    services.emit({ type: 'confirmationResolved', id: planId, accepted });
    if (!accepted) return { ok: false, message: `Cancelled: ${folder} was not changed` };

    const done = await applyMoves(moves, context);
    return {
      ok: true,
      summary: `Sorted ${done.length} files in ${folder}`,
      inverse: {
        tool: 'undo_moves',
        args: { moves: done },
        description: `Move ${done.length} files back`,
      },
    };
  },
});

export const undoMoves = defineTool({
  name: 'undo_moves',
  description: 'Move files back to where they were.',
  risk: 'write',
  internal: true,
  argsSchema: z.object({ moves: movesSchema }),
  describe: ({ moves }) => `Move ${moves.length} files back`,
  async execute({ moves }, { services }) {
    await revert(moves, services);
    return { ok: true, summary: `Moved ${moves.length} files back` };
  },
});
