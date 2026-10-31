import { useCallback, useEffect, useState } from 'react'
import { createSession, getResult, getSession, joinSession, API } from '../services/session'
import type { Session } from '../services/session'
import type { Reconciliation } from '../types/reconciliation'

const eventTypes = ['printed_to_dock', 'delivery_received', 'reading', 'extracted', 'matching', 'question', 'answered', 'count_updated', 'verdict', 'signed', 'claim_drafted', 'claim_approved', 'phone_connected', 'failed', 'reset']

export function useLiveSession(isDock: boolean) {
  const [session, setSession] = useState<Session | null>(null)
  const [result, setResult] = useState<Reconciliation | null>(null)
  const [error, setError] = useState('')
  const refresh = useCallback(async (id: string) => {
    try {
      const next = await getSession(id)
      setSession(next)
      if (next.reconciliation_id) setResult(await getResult(next.reconciliation_id))
      else setResult(null)
    } catch (cause) { setError((cause as Error).message) }
  }, [])
  useEffect(() => {
    const paired = new URLSearchParams(location.search).get('s')
    const saved = localStorage.getItem('dockproof.session')
    const id = isDock ? paired : saved
    if (id) {
      if (isDock) void joinSession(id).then(() => refresh(id)).catch(cause => setError((cause as Error).message))
      else void getSession(id).then(() => refresh(id)).catch(() => createSession().then(next => {
        localStorage.setItem('dockproof.session', next.id)
        setSession(next)
      }).catch(cause => setError((cause as Error).message)))
    } else if (!isDock) {
      void createSession().then(next => { localStorage.setItem('dockproof.session', next.id); setSession(next) }).catch(cause => setError((cause as Error).message))
    }
  }, [isDock, refresh])
  useEffect(() => {
    if (!session?.id) return
    const source = new EventSource(`${API}/api/session/${session.id}/events?after=${session.events.length - 1}`)
    for (const type of eventTypes) source.addEventListener(type, () => void refresh(session.id))
    source.onerror = () => setError('Live connection interrupted. Reconnecting…')
    source.onopen = () => setError('')
    return () => source.close()
  }, [session?.id, session?.events.length, refresh])
  return { session, result, error, setError, refresh }
}
