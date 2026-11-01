export const mascotStates = [
  'sleeping',
  'waking',
  'idle',
  'listening',
  'thinking',
  'working',
  'speaking',
  'done',
  'error',
] as const;

export type MascotState = (typeof mascotStates)[number];

export type MascotEvent =
  | { type: 'wake' }
  | { type: 'listenStart' }
  | { type: 'listenEnd' }
  | { type: 'thinkStart' }
  | { type: 'toolStart' }
  | { type: 'toolEnd' }
  | { type: 'speakStart' }
  | { type: 'speakEnd' }
  | { type: 'succeed' }
  | { type: 'fail' }
  | { type: 'cancel' }
  | { type: 'timeout' };

/** How long a transient state lasts before the `timeout` event moves it on. */
export const mascotTimeoutMs: Partial<Record<MascotState, number>> = {
  waking: 600,
  done: 2500,
  error: 4000,
  idle: 60_000,
};

const timeoutTarget: Partial<Record<MascotState, MascotState>> = {
  waking: 'idle',
  done: 'idle',
  error: 'idle',
  idle: 'sleeping',
};

const isBusy = (state: MascotState): boolean =>
  state === 'listening' || state === 'thinking' || state === 'working' || state === 'speaking';

export function reduceMascot(state: MascotState, event: MascotEvent): MascotState {
  switch (event.type) {
    case 'wake':
      return state === 'sleeping' ? 'waking' : state;
    case 'listenStart':
      return 'listening';
    case 'listenEnd':
      return state === 'listening' ? 'thinking' : state;
    case 'thinkStart':
      return 'thinking';
    case 'toolStart':
      return 'working';
    case 'toolEnd':
      return state === 'working' ? 'thinking' : state;
    case 'speakStart':
      return 'speaking';
    case 'speakEnd':
      return state === 'speaking' ? 'done' : state;
    case 'succeed':
      return 'done';
    case 'fail':
      return 'error';
    case 'cancel':
      return isBusy(state) ? 'idle' : state;
    case 'timeout':
      return timeoutTarget[state] ?? state;
  }
}
