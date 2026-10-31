import { useEffect, useState } from 'react'

const PATTERN = /^#\/r\/(.+)$/

function currentId(): string | null {
  return PATTERN.exec(window.location.hash)?.[1] ?? null
}

/** Reconciliation id from `#/r/<id>` (null = scan page). Keeps results shareable and refresh-safe. */
export function useHashRoute(): { id: string | null; open: (id: string | null) => void } {
  const [id, setId] = useState<string | null>(currentId)

  useEffect(() => {
    const onChange = () => setId(currentId())
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])

  const open = (next: string | null) => {
    window.location.hash = next ? `/r/${next}` : ''
  }
  return { id, open }
}
