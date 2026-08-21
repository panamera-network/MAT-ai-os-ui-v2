import { useState } from 'react'
import { useVisionApi } from '../app/VisionApiProvider'
import type { ServiceStatus } from '../domain/vision'

interface UseServiceControlResult {
  /** The service id currently mid-request, if any — disable that one row's
   * toggle, not the whole list. */
  pendingId: string | null
  /** Starts a stopped/degraded service or stops a running one, based on the
   * service's own current `state`. Calls `onSettled` afterward so the
   * caller can refetch the real list rather than guess the new state. */
  toggle: (service: ServiceStatus, onSettled: () => void) => void
}

/** Real per-service `POST /services/{id}/start|stop` for the Glass HUD's
 * Service Controls toggles. */
export function useServiceControl(): UseServiceControlResult {
  const api = useVisionApi()
  const [pendingId, setPendingId] = useState<string | null>(null)

  const toggle = (service: ServiceStatus, onSettled: () => void) => {
    setPendingId(service.id)
    const request = service.state === 'running' ? api.stopService(service.id) : api.startService(service.id)
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

  return { pendingId, toggle }
}
