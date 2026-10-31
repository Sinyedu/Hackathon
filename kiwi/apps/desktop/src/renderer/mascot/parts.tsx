export type EyeVariant = 'open' | 'closed' | 'happy' | 'cross' | 'half';

interface EyesProps {
  variant: EyeVariant;
  blinking: boolean;
  glance: -1 | 0 | 1;
  lookUp: boolean;
}

const EYE_X = [60, 100] as const;
const EYE_Y = 74;

export function Eyes({ variant, blinking, glance, lookUp }: EyesProps) {
  return (
    <g className="kiwi-eyes" data-part="eyes">
      {EYE_X.map((x) => (
        <Eye key={x} x={x} {...{ variant, blinking, glance, lookUp }} />
      ))}
    </g>
  );
}

function Eye({ x, variant, blinking, glance, lookUp }: EyesProps & { x: number }) {
  if (variant === 'closed')
    return <path d={`M${x - 8} ${EYE_Y} q8 6 16 0`} className="kiwi-line" />;
  if (variant === 'happy')
    return <path d={`M${x - 8} ${EYE_Y + 3} q8 -10 16 0`} className="kiwi-line" />;
  if (variant === 'cross') {
    return (
      <path
        d={`M${x - 6} ${EYE_Y - 6} l12 12 M${x + 6} ${EYE_Y - 6} l-12 12`}
        className="kiwi-line"
      />
    );
  }
  const dx = glance * 3;
  const dy = lookUp ? -3 : 0;
  return (
    <g className={blinking ? 'kiwi-eye kiwi-eye--blink' : 'kiwi-eye'}>
      <ellipse cx={x + dx} cy={EYE_Y + dy} rx="8" ry="10" className="kiwi-eye-fill" />
      <circle cx={x + dx + 3} cy={EYE_Y + dy - 4} r="2.6" className="kiwi-eye-shine" />
      {variant === 'half' && (
        <rect x={x - 10} y={EYE_Y - 12} width="20" height="12" className="kiwi-lid" />
      )}
    </g>
  );
}

export function Beak({ mouthOpen }: { mouthOpen: number }) {
  const drop = Math.min(Math.max(mouthOpen, 0), 1) * 7;
  return (
    <g data-part="beak">
      <ellipse cx="80" cy={94 + drop} rx="7" ry="4" className="kiwi-beak-lower" />
      <path d="M71 88 Q80 82 89 88 Q80 100 71 88 Z" className="kiwi-beak" />
    </g>
  );
}

export function Belly() {
  const seeds = [-24, -12, 0, 12, 24].map((dx, index) => ({
    cx: 80 + dx,
    cy: 112 + (index % 2) * 7,
  }));
  return (
    <g data-part="belly">
      <ellipse cx="80" cy="108" rx="34" ry="28" className="kiwi-belly" />
      <ellipse cx="80" cy="108" rx="34" ry="28" className="kiwi-belly-ring" />
      {seeds.map((seed) => (
        <ellipse key={seed.cx} {...seed} rx="1.8" ry="3" className="kiwi-seed" />
      ))}
    </g>
  );
}

export function Feet() {
  return (
    <g data-part="feet">
      <ellipse cx="60" cy="142" rx="13" ry="6" className="kiwi-foot kiwi-foot--left" />
      <ellipse cx="100" cy="142" rx="13" ry="6" className="kiwi-foot kiwi-foot--right" />
    </g>
  );
}

export function Leaf() {
  return (
    <g data-part="leaf" className="kiwi-leaf-group">
      <path d="M80 36 Q92 18 108 24 Q100 40 80 36 Z" className="kiwi-leaf" />
      <path d="M80 36 L104 26" className="kiwi-leaf-vein" />
    </g>
  );
}
