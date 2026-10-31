import { useCallback, useRef, useState } from 'react'
import { clearSpotlight, spotlight } from '../lib/spotlight'
import type { Step } from '../lib/walkthrough'

/** Runs the spoken tour: for each step, point at the thing on the page, then say why it is there. */
export function useWalkthrough(say: (text: string, onDone: () => void) => void) {
  const [active, setActive] = useState(false)
  const token = useRef(0)

  const stop = useCallback(() => {
    token.current += 1 // any step waiting on speech notices this and quits
    setActive(false)
    clearSpotlight()
  }, [])

  const run = useCallback(async (steps: Step[]) => {
    const mine = ++token.current
    setActive(true)
    for (const step of steps) {
      if (token.current !== mine) return
      spotlight(step.selector, step.terms)
      await new Promise<void>((done) => say(step.text, done))
      await new Promise((r) => window.setTimeout(r, 600)) // let the highlight be read before moving on
    }
    if (token.current === mine) {
      setActive(false)
      clearSpotlight()
    }
  }, [say])

  return { active, run, stop }
}
