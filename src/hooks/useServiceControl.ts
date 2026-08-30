import { useState } from 'react'
import { useVisionApi } from '../app/VisionApiProvider'
import { VisionApiError } from '../adapters/vision'
import { isServiceOn, type ServiceStatus } from '../domain/vision'

/** The real outcome of one service action — `ok: false` always carries the
 * real `detail` (or a generic fallback for a non-API failure), never a
 * fabricated one. Service Controls audit: this used to be swallowed
 * entirely on failure ("nothing to fabricate here") — honest in that it
 * never faked success, but it also never surfaced the real failure. Now
 * reported back to the caller either way. */
export interface ServiceActionResult {
  ok: boolean
  detail: string
}

interface UseServiceControlResult {
  /** The service id currently mid-request, if any — disable that one row's
   * controls, not the whole list. */
  pendingId: string | null
  /** Starts a stopped/degraded service or stops a running one, based on the
   * service's own current `state`. Calls `onSettled` with the real outcome
   * afterward so the caller can refetch the real list and surface it —
   * never a guess at the new state, never a silently-dropped failure. */
  toggle: (service: ServiceStatus, onSettled: (result: ServiceActionResult) => void) => void
  /** Real `POST /services/{id}/restart` — same settle-then-refetch pattern
   * as `toggle`, no optimistic state either. */
  restart: (service: ServiceStatus, onSettled: (result: ServiceActionResult) => void) => void
}

/** Real per-service `POST /services/{id}/start|stop|restart` for the Glass
 * HUD's Service Controls rows. */
export function useServiceControl(): UseServiceControlResult {
  const api = useVisionApi()
  const [pendingId, setPendingId] = useState<string | null>(null)

  const run = (id: string, request: Promise<unknown>, onSettled: (result: ServiceActionResult) => void) => {
    setPendingId(id)
    request
      .then(() => onSettled({ ok: true, detail: '' }))
      .catch((err: unknown) => {
        onSettled({ ok: false, detail: err instanceof VisionApiError ? err.detail : 'Request failed' })
      })
      .finally(() => {
        setPendingId(null)
      })
  }

  const toggle = (service: ServiceStatus, onSettled: (result: ServiceActionResult) => void) => {
    run(service.id, isServiceOn(service.state) ? api.stopService(service.id) : api.startService(service.id), onSettled)
  }

  const restart = (service: ServiceStatus, onSettled: (result: ServiceActionResult) => void) => {
    run(service.id, api.restartService(service.id), onSettled)
  }

  return { pendingId, toggle, restart }
}
