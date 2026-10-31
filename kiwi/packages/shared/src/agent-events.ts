import { z } from 'zod';
import { receiptStatusSchema } from './chat';

/** Everything the agent tells the outside world. The UI never sees anything else. */
export const agentEventSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('userMessage'), id: z.string(), text: z.string() }),
  z.object({ type: z.literal('thinking') }),
  z.object({ type: z.literal('assistantDelta'), id: z.string(), text: z.string() }),
  z.object({ type: z.literal('assistantDone'), id: z.string() }),
  z.object({
    type: z.literal('receipt'),
    id: z.string(),
    status: receiptStatusSchema,
    text: z.string(),
    /** Small proof image (data URL), e.g. a screenshot thumbnail. */
    image: z.string().optional(),
  }),
  z.object({
    type: z.literal('confirmationRequested'),
    id: z.string(),
    lines: z.array(z.string()),
  }),
  z.object({ type: z.literal('confirmationResolved'), id: z.string(), accepted: z.boolean() }),
  z.object({ type: z.literal('toolStarted'), name: z.string() }),
  z.object({ type: z.literal('toolFinished'), name: z.string(), ok: z.boolean() }),
  z.object({ type: z.literal('notice'), text: z.string() }),
  z.object({ type: z.literal('runFinished'), outcome: z.enum(['done', 'error', 'cancelled']) }),
]);

export type AgentEvent = z.infer<typeof agentEventSchema>;
