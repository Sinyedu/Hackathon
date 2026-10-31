import type { Recording } from '@kiwi/core';

/** A recorded run for rehearsal. It is replayed, not executed, and is always labelled "replay". */
export const demoRecording: Recording = {
  events: [{ text: 'Reading src/greet.ts' }, { text: 'Using Edit' }, { text: 'Running the tests' }],
  result: {
    summary: 'Added a friendly greeting to greet().',
    diffSummary: '1 file changed, 4 insertions(+)',
  },
  testResult: 'passed',
  diff: '--- a/src/greet.ts\n+++ b/src/greet.ts\n@@\n-export const greet = (name: string) => name;\n+export const greet = (name: string) => `Hello, ${name}!`;\n',
};
