import type { MascotState } from '@kiwi/core';
import './mascot.css';
import { Accessory } from './accessories';
import { Beak, Belly, Eyes, Feet, Leaf, type EyeVariant } from './parts';
import { useIdleBehaviors } from './use-idle-behaviors';
import { useReducedMotion } from './use-reduced-motion';

export interface MascotProps {
  state: MascotState;
  /** 0-1, drives the listening ring. */
  micLevel?: number;
  /** 0-1, drives the beak while speaking. */
  mouthOpen?: number;
  reducedMotion?: boolean;
}

const eyeVariants: Record<MascotState, EyeVariant> = {
  sleeping: 'closed',
  waking: 'half',
  idle: 'open',
  listening: 'open',
  thinking: 'open',
  working: 'open',
  speaking: 'open',
  done: 'happy',
  error: 'cross',
};

const stateLabels: Record<MascotState, string> = {
  sleeping: 'Kiwi is asleep',
  waking: 'Kiwi is waking up',
  idle: 'Kiwi is ready',
  listening: 'Kiwi is listening',
  thinking: 'Kiwi is thinking',
  working: 'Kiwi is working',
  speaking: 'Kiwi is speaking',
  done: 'Kiwi is done',
  error: 'Kiwi hit a problem',
};

export function Mascot({ state, micLevel = 0, mouthOpen = 0, reducedMotion }: MascotProps) {
  const systemReduced = useReducedMotion();
  const reduced = reducedMotion ?? systemReduced;
  const idle = useIdleBehaviors(state === 'idle' && !reduced);
  const classes = [
    'kiwi',
    `kiwi--${state}`,
    reduced && 'kiwi--reduced',
    idle.hopping && 'kiwi--hop',
  ];

  return (
    <svg
      className={classes.filter(Boolean).join(' ')}
      viewBox="0 0 160 160"
      role="img"
      aria-label={stateLabels[state]}
    >
      <ellipse cx="80" cy="150" rx="46" ry="6" className="kiwi-shadow" />
      {state === 'listening' && (
        <circle
          cx="80"
          cy="88"
          r="64"
          className="kiwi-ring"
          style={{ transform: `scale(${1 + Math.min(Math.max(micLevel, 0), 1) * 0.12})` }}
        />
      )}
      <g className="kiwi-body-group">
        <Feet />
        <Leaf />
        <ellipse cx="80" cy="88" rx="58" ry="54" className="kiwi-body" data-part="body" />
        <Belly />
        <Eyes
          variant={eyeVariants[state]}
          blinking={idle.blinking}
          glance={idle.glance}
          lookUp={state === 'thinking'}
        />
        <circle cx="46" cy="90" r="6" className="kiwi-blush" />
        <circle cx="114" cy="90" r="6" className="kiwi-blush" />
        <Beak mouthOpen={state === 'speaking' ? mouthOpen : 0} />
      </g>
      <Accessory state={state} />
    </svg>
  );
}
