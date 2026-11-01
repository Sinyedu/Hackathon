import type { OrbPhase } from './agent/ParticleOrb'

interface Props {
  phase?: OrbPhase
  className?: string
}

/** Lightweight mascot animation. The SVG stays a static asset; only the wrapper moves. */
export default function KiwiMascot({ phase = 'idle', className = '' }: Props) {
  return (
    <span className={`kiwi-mascot kiwi-mascot--${phase} ${className}`.trim()}>
      <span className="kiwi-mascot__halo" aria-hidden />
      <img src="/kiwi-mascot.svg" alt="" aria-hidden />
    </span>
  )
}
