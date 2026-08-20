import { useEffect, useState } from 'react'
import { useVisionApi } from '../app/VisionApiProvider'
import { VisionApiError } from '../adapters/vision'
import type { Health } from '../domain/vision'

export type ConnectionState = 'checking' | 'online' | 'offline'

interface UseHealthResult {
  health: Health | null
  connection: ConnectionState
  error: VisionApiError | null
}

const POLL_MS = 5000

/** Polls `GET /health` on a fixed interval — the one always-available signal
 * for "is MAT reachable at all", independent of whether a body is attached.
 * `connection` starts at `'checking'` rather than defaulting to online/offline,
 * so the HUD never flashes a wrong state before the first response lands. */
export function useHealth(): UseHealthResult {
  const api = useVisionApi()
  const [health, setHealth] = useState<Health | null>(null)
  const [connection, setConnection] = useState<ConnectionState>('checking')
  const [error, setError] = useState<VisionApiError | null>(null)

  useEffect(() => {
    let cancelled = false

    const poll = async () => {
      try {
        const result = await api.getHealth()
        if (cancelled) return
        setHealth(result)
        setConnection('online')
        setError(null)
      } catch (err) {
        if (cancelled) return
        setConnection('offline')
        setError(err instanceof VisionApiError ? err : null)
      }
    }

    void poll()
    const id = setInterval(poll, POLL_MS)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [api])

  return { health, connection, error }
}
