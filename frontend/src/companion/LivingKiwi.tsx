import { useEffect, useRef } from 'react'
import original from '../../../fixtures/samples/kiwi-mascot-transparent.svg?raw'
import { desktop } from './desktop'

// The supplied artwork is preserved; all three eye layers move together, including the glow.
const artwork = original.replaceAll('d="M713 575V622M820 575V622"', 'class="kiwi-eyes" d="M713 575V622M820 575V622"')
  .replace('</svg>', '<path class="kiwi-mouth" d="M746 668Q766 682 787 668" fill="none" stroke="#d5ff7d" stroke-width="12" stroke-linecap="round"/></svg>')

export default function LivingKiwi({ phase, onClick }: { phase: string; onClick: () => void }) {
  const face = useRef<HTMLButtonElement>(null)
  useEffect(() => desktop.onEvent((event) => {
    if (event.type !== 'cursor' || !face.current) return
    const rect = face.current.getBoundingClientRect()
    const dx = (event.x ?? 0) - rect.left - rect.width / 2
    const dy = (event.y ?? 0) - rect.top - rect.height * .65
    face.current.style.setProperty('--gaze-x', `${Math.tanh(dx / 300) * 18}px`)
    face.current.style.setProperty('--gaze-y', `${Math.tanh(dy / 240) * 12}px`)
  }), [])
  return <button ref={face} className={`living-kiwi living-kiwi--${phase}`} onClick={onClick} aria-label="Talk to Kiwi" title="Click to chat · Ctrl+Shift+Space to talk">
    <span className="living-kiwi__art" dangerouslySetInnerHTML={{ __html: artwork }} />
    <span className="living-kiwi__shadow" aria-hidden />
  </button>
}
