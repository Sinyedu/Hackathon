import { useEffect, useState } from 'react'
import { getHealth } from '../services/api'
import type { ConnectionState, HealthResponse } from '../types/health'

export function useBackendHealth(): { state: ConnectionState; health: HealthResponse | null } {
  const [state, setState] = useState<ConnectionState>('checking')
  const [health, setHealth] = useState<HealthResponse | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    getHealth(controller.signal)
      .then((data) => {
        setHealth(data)
        setState(data.status === 'ok' ? 'online' : 'offline')
      })
      .catch(() => {
        if (!controller.signal.aborted) setState('offline')
      })
    return () => controller.abort()
  }, [])

  return { state, health }
}
