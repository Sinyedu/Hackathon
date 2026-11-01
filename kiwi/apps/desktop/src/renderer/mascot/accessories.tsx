import type { MascotState } from '@kiwi/core';

/** Small per-state marks that keep silhouettes distinct without relying on color alone. */
export function Accessory({ state }: { state: MascotState }) {
  switch (state) {
    case 'sleeping':
      return (
        <g className="kiwi-mark kiwi-zzz" aria-hidden="true">
          <text x="112" y="40" className="kiwi-glyph">
            z
          </text>
          <text x="124" y="26" className="kiwi-glyph kiwi-glyph--small">
            z
          </text>
        </g>
      );
    case 'thinking':
      return (
        <g className="kiwi-mark kiwi-dots" aria-hidden="true">
          <circle cx="112" cy="30" r="4" />
          <circle cx="124" cy="24" r="4" />
          <circle cx="136" cy="18" r="4" />
        </g>
      );
    case 'working':
      return (
        <path
          d="M118 22 l6 -10 l6 10 m-6 -10 v22"
          className="kiwi-mark kiwi-tool"
          aria-hidden="true"
        />
      );
    case 'done':
      return <path d="M116 26 l8 8 l14 -16" className="kiwi-mark kiwi-check" aria-hidden="true" />;
    case 'error':
      return (
        <g className="kiwi-mark kiwi-alert" aria-hidden="true">
          <path d="M124 10 v18" />
          <circle cx="124" cy="36" r="2.5" />
        </g>
      );
    default:
      return null;
  }
}
