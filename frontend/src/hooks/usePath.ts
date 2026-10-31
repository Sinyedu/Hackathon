import { useEffect, useState } from 'react'

/** Minimal pathname routing; Vercel rewrites every path to index.html. */
export function usePath(): [string, (path: string) => void] {
  const [path, setPath] = useState(window.location.pathname)
  useEffect(() => {
    const onPop = () => setPath(window.location.pathname)
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])
  const go = (next: string) => {
    if (next === window.location.pathname) return
    window.history.pushState(null, '', next + window.location.search)
    setPath(next)
    window.scrollTo(0, 0)
  }
  return [path, go]
}
