import type { ChatMessage } from '@kiwi/shared';

/** Static scripted data for the dev gallery. Never shown in the real app. */
export const fakeConversation: ChatMessage[] = [
  { id: '1', role: 'user', text: 'open github and search for electron ipc docs' },
  { id: '2', role: 'receipt', status: 'DONE', text: 'Opened github.com' },
  { id: '3', role: 'receipt', status: 'DONE', text: 'Searched “electron ipc docs”' },
  {
    id: '4',
    role: 'assistant',
    text: 'All set. The results are open in your browser.',
    streaming: false,
  },
  { id: '5', role: 'user', text: 'clean up my downloads' },
  { id: '6', role: 'receipt', status: 'PLANNED', text: 'Move 12 files into 4 folders' },
  {
    id: '7',
    role: 'receipt',
    status: 'FAILED',
    text: 'Could not open Photoshop: not on the allowed list',
  },
  { id: '8', role: 'receipt', status: 'UNDONE', text: 'Restored volume to 40%' },
  { id: '9', role: 'assistant', text: 'Want me to go ahead with the move?', streaming: true },
];
