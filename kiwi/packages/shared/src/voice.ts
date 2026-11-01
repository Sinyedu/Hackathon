import { z } from 'zod';

export const voiceStageSchema = z.enum([
  'wake',
  'speechToText',
  'agent',
  'textToSpeech',
  'transcriptToSpeech',
]);
export type VoiceStage = z.infer<typeof voiceStageSchema>;

export const engineSchema = z.enum(['speechToText', 'wakeWord', 'textToSpeech', 'microphone']);

/** Events the voice window reports; main relays them to the overlay and panel. */
export const voiceEventSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('micState'), on: z.boolean() }),
  z.object({ type: z.literal('level'), value: z.number().min(0).max(1) }),
  z.object({ type: z.literal('captureStart'), via: z.enum(['push', 'tap', 'wake']) }),
  z.object({ type: z.literal('captureEnd') }),
  z.object({ type: z.literal('transcript'), text: z.string() }),
  z.object({ type: z.literal('speakStart') }),
  z.object({ type: z.literal('speakEnd') }),
  z.object({ type: z.literal('mouth'), value: z.number().min(0).max(1) }),
  z.object({ type: z.literal('stopped') }),
  z.object({
    type: z.literal('engine'),
    engine: engineSchema,
    status: z.enum(['loading', 'ready', 'fallback', 'unavailable']),
    message: z.string(),
  }),
  z.object({
    type: z.literal('devices'),
    devices: z.array(z.object({ id: z.string(), label: z.string() })),
  }),
  z.object({ type: z.literal('latency'), stage: voiceStageSchema, ms: z.number() }),
]);
export type VoiceEvent = z.infer<typeof voiceEventSchema>;

/** Commands main sends to the voice window. */
export const voiceCommandSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('captureStart'), via: z.enum(['push', 'tap']) }),
  z.object({ type: z.literal('captureEnd') }),
  z.object({ type: z.literal('stopAll') }),
  z.object({ type: z.literal('speakTest') }),
  z.object({
    type: z.literal('configure'),
    wakeWord: z.boolean(),
    speakReplies: z.boolean(),
    inputDeviceId: z.string().nullable(),
  }),
]);
export type VoiceCommand = z.infer<typeof voiceCommandSchema>;
