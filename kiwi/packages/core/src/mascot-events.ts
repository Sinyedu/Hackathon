import type { AgentEvent } from '@kiwi/shared';
import type { MascotEvent } from './mascot';

/** Maps agent events onto mascot events so the mascot never needs to know about the agent. */
export function mascotEventsFor(event: AgentEvent): MascotEvent[] {
  switch (event.type) {
    case 'thinking':
    case 'userMessage':
      return [{ type: 'thinkStart' }];
    case 'toolStarted':
      return [{ type: 'toolStart' }];
    case 'toolFinished':
      return [{ type: 'toolEnd' }];
    case 'notice':
      return [{ type: 'succeed' }];
    case 'runFinished':
      if (event.outcome === 'done') return [{ type: 'succeed' }];
      return [{ type: event.outcome === 'error' ? 'fail' : 'cancel' }];
    default:
      return [];
  }
}
