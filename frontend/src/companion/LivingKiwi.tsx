import { useEffect, useRef, type CSSProperties } from 'react'
import original from '../../../fixtures/samples/kiwi-mascot-transparent.svg?raw'
import { desktop } from './desktop'

// The supplied artwork is preserved; all three eye layers move together, including the glow.
const artwork = original.replaceAll('d="M713 575V622M820 575V622"', 'class="kiwi-eyes" d="M713 575V622M820 575V622"')
  .replace('</svg>', '<path class="kiwi-mouth" d="M746 668Q766 682 787 668" fill="none" stroke="#d5ff7d" stroke-width="12" stroke-linecap="round"/><g class="kiwi-speaker" fill="none" stroke="#d5ff7d" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"><path d="M742 657h10l14-11v37l-14-11h-10z" fill="#d5ff7d" stroke-width="3"/><path class="kiwi-speaker-wave kiwi-speaker-wave--near" d="M779 655q13 11 0 22"/><path class="kiwi-speaker-wave kiwi-speaker-wave--far" d="M791 646q22 20 0 40"/></g></svg>')

export default function LivingKiwi({ phase, level = 0, onClick }: { phase: string; level?: number; onClick: () => void }) {
  const face = useRef<HTMLButtonElement>(null)
  useEffect(() => desktop.onEvent((event) => {
    if (event.type !== 'cursor' || !face.current) return
    const rect = face.current.getBoundingClientRect()
    const dx = (event.x ?? 0) - rect.left - rect.width / 2
    const dy = (event.y ?? 0) - rect.top - rect.height * .65
    face.current.style.setProperty('--gaze-x', `${Math.tanh(dx / 300) * 18}px`)
    face.current.style.setProperty('--gaze-y', `${Math.tanh(dy / 240) * 12}px`)
  }), [])
  return <button ref={face} className={`living-kiwi living-kiwi--${phase}`} style={{ '--voice-level': level } as CSSProperties} onClick={onClick} aria-label="Talk to Kiwi" title="Say Hey Kiwi to talk">
    <span className="living-kiwi__art" dangerouslySetInnerHTML={{ __html: artwork }} />
    <span className="living-kiwi__shadow" aria-hidden />
  </button>
}
