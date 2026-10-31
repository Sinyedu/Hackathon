import { useEffect, useRef } from 'react'
import type { RefObject } from 'react'

export type OrbPhase = 'idle' | 'listening' | 'thinking' | 'speaking'

interface Props {
  phase: OrbPhase
  /** Microphone loudness 0..1 while listening. */
  level?: RefObject<number>
  /** Set to 1 on each spoken word; the orb decays it. */
  pulse?: RefObject<number>
  dots?: number
  className?: string
}

const HUE: Record<OrbPhase, number> = { idle: 226, listening: 198, thinking: 252, speaking: 218 }
const GOLDEN = Math.PI * (3 - Math.sqrt(5))

/** A dotted sphere that ripples with real audio energy. Pure canvas, no dependencies. */
export default function ParticleOrb({ phase, level, pulse, dots = 900, className }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const phaseRef = useRef(phase)
  useEffect(() => {
    phaseRef.current = phase
  }, [phase])

  useEffect(() => {
    const el = canvas.current
    const ctx = el?.getContext('2d')
    if (!el || !ctx) return
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const points = Array.from({ length: dots }, (_, i) => {
      const y = 1 - (i / (dots - 1)) * 2
      const r = Math.sqrt(1 - y * y)
      return { x: Math.cos(GOLDEN * i) * r, y, z: Math.sin(GOLDEN * i) * r, seed: (i * 9301 + 49297) % 233280 / 233280 }
    })
    let energy = 0
    let hue = HUE[phaseRef.current]
    let spin = 0
    let frame = 0
    let last = performance.now()

    const draw = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      const t = now / 1000
      const current = phaseRef.current
      if (pulse?.current) pulse.current *= 0.9
      const target = current === 'listening' ? 0.12 + (level?.current ?? 0)
        : current === 'speaking' ? 0.18 + (pulse?.current ?? 0) * 0.7
          : current === 'thinking' ? 0.28 + Math.sin(t * 5) * 0.08
            : 0.06 + Math.sin(t * 1.4) * 0.03
      energy += (target - energy) * Math.min(1, dt * 9)
      hue += (HUE[current] - hue) * Math.min(1, dt * 2.5)
      spin += dt * (still ? 0.05 : current === 'thinking' ? 1.1 : 0.22 + energy * 0.6)

      const { width, height } = el
      ctx.clearRect(0, 0, width, height)
      const cx = width / 2
      const cy = height / 2
      const radius = Math.min(width, height) * 0.34
      const dotScale = Math.max(0.6, Math.min(width, height) / 420)
      const tilt = Math.sin(t * 0.25) * 0.35
      const [sy, cyaw, sx, cx2] = [Math.sin(spin), Math.cos(spin), Math.sin(tilt), Math.cos(tilt)]

      for (const p of points) {
        const x1 = p.x * cyaw + p.z * sy
        const z1 = -p.x * sy + p.z * cyaw
        const y1 = p.y * cx2 - z1 * sx
        const z2 = p.y * sx + z1 * cx2
        const wave = Math.sin(p.seed * 40 + t * 4.2) * Math.cos(p.y * 5 - t * 3)
        const lift = 1 + energy * (0.22 + 0.32 * wave)
        const depth = (z2 + 1) / 2
        const perspective = 2.8 / (2.8 - z2)
        const size = (0.55 + depth * 1.25) * dotScale * (1 + energy * 0.5)
        const h = hue + Math.sin(t * 0.6 + p.y * 2.2) * 18 - energy * 24
        ctx.fillStyle = `hsla(${h}, 92%, ${48 + depth * 10}%, ${0.12 + depth * 0.88})`
        ctx.beginPath()
        ctx.arc(cx + x1 * radius * lift * perspective, cy + y1 * radius * lift * perspective, size, 0, Math.PI * 2)
        ctx.fill()
      }
      frame = requestAnimationFrame(draw)
    }

    const resize = () => {
      const ratio = Math.min(window.devicePixelRatio || 1, 2)
      el.width = Math.round(el.clientWidth * ratio)
      el.height = Math.round(el.clientHeight * ratio)
    }
    const observer = new ResizeObserver(resize)
    observer.observe(el)
    resize()
    frame = requestAnimationFrame(draw)
    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
    }
  }, [dots, level, pulse])

  return <canvas ref={canvas} className={className} aria-hidden="true" />
}
