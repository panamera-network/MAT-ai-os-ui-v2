import { useState } from 'react'
import { useVisionApi } from '../app/VisionApiProvider'
import type { ServiceStatus } from '../domain/vision'

interface UseServiceControlResult {
  /** The service id currently mid-request, if any — disable that one row's
   * controls, not the whole list. */
  pendingId: string | null
  /** Starts a stopped/degraded service or stops a running one, based on the
   * service's own current `state`. Calls `onSettled` afterward so the
   * caller can refetch the real list rather than guess the new state. */
  toggle: (service: ServiceStatus, onSettled: () => void) => void
  /** Real `POST /services/{id}/restart` — same settle-then-refetch pattern
   * as `toggle`, no optimistic state either. */
  restart: (service: ServiceStatus, onSettled: () => void) => void
}

/** Real per-service `POST /services/{id}/start|stop|restart` for the Glass
 * HUD's Service Controls rows. */
export function useServiceControl(): UseServiceControlResult {
  const api = useVisionApi()
  const [pendingId, setPendingId] = useState<string | null>(null)

  const run = (id: string, request: Promise<unknown>, onSettled: () => void) => {
    setPendingId(id)
    request
      .catch(() => {
        // Real failure — the refetch below just leaves the row showing the
        // service's true (unchanged) state; nothing to fabricate here.
      })
      .finally(() => {
        setPendingId(null)
        onSettled()
      })
  }

  const toggle = (service: ServiceStatus, onSettled: () => void) => {
    run(service.id, service.state === 'running' ? api.stopService(service.id) : api.startService(service.id), onSettled)
  }

  const restart = (service: ServiceStatus, onSettled: () => void) => {
    run(service.id, api.restartService(service.id), onSettled)
  }

  return { pendingId, toggle, restart }
}
