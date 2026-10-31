import { z } from 'zod';

export const receiptStatusSchema = z.enum(['DONE', 'PLANNED', 'FAILED', 'UNDONE']);
export type ReceiptStatus = z.infer<typeof receiptStatusSchema>;

export const chatMessageSchema = z.discriminatedUnion('role', [
  z.object({ id: z.string(), role: z.literal('user'), text: z.string() }),
  z.object({
    id: z.string(),
    role: z.literal('assistant'),
    text: z.string(),
    streaming: z.boolean(),
  }),
  z.object({
    id: z.string(),
    role: z.literal('receipt'),
    text: z.string(),
    status: receiptStatusSchema,
  }),
]);
export type ChatMessage = z.infer<typeof chatMessageSchema>;
