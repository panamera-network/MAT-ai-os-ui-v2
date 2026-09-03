import { useState } from 'react'
import { useVisionApi } from '../app/VisionApiProvider'
import { VisionApiError } from '../adapters/vision'
import type { Loop } from '../domain/vision'

/** The real outcome of one loop action — `ok: false` always carries the
 * real `detail`, never a fabricated one, same honest-failure contract
 * `ServiceActionResult` already established. */
export interface LoopActionOutcome {
  ok: boolean
  detail: string
  /** The action's own real updated loop record, when it succeeded. */
  loop: Loop | null
}

interface UseLoopActionsResult {
  /** The loop id currently mid-request, if any — disable that one row's
   * controls, not the whole list. */
  pendingId: string | null
  pause: (loopId: string, onSettled: (outcome: LoopActionOutcome) => void) => void
  start: (loopId: string, onSettled: (outcome: LoopActionOutcome) => void) => void
  /** Real `POST /loops/{id}/run-now` — `outcome` in the settled result's
   * `detail` is the engine's own real string (`executed`/
   * `skipped_not_active`/`skipped_already_running`), never a guessed
   * "done". */
  runNow: (loopId: string, onSettled: (outcome: LoopActionOutcome) => void) => void
}

/** Real per-loop `POST /loops/{id}/pause|start|run-now` for the Loops card
 * — same settle-then-refetch pattern as `useServiceControl`, no optimistic
 * state either; the caller refetches the real list once `onSettled` fires. */
export function useLoopActions(): UseLoopActionsResult {
  const api = useVisionApi()
  const [pendingId, setPendingId] = useState<string | null>(null)

  const run = (loopId: string, request: Promise<{ loop: Loop }>, onSettled: (outcome: LoopActionOutcome) => void) => {
    setPendingId(loopId)
    request
      .then((result) => onSettled({ ok: true, detail: '', loop: result.loop }))
      .catch((err: unknown) => {
        onSettled({ ok: false, detail: err instanceof VisionApiError ? err.detail : 'Request failed', loop: null })
      })
      .finally(() => setPendingId(null))
  }

  return {
    pendingId,
    pause: (loopId, onSettled) => run(loopId, api.pauseLoop(loopId), onSettled),
    start: (loopId, onSettled) => run(loopId, api.startLoop(loopId), onSettled),
    runNow: (loopId, onSettled) => {
      setPendingId(loopId)
      api
        .runLoopNow(loopId)
        .then((result) => onSettled({ ok: true, detail: result.outcome, loop: result.loop }))
        .catch((err: unknown) => {
          onSettled({ ok: false, detail: err instanceof VisionApiError ? err.detail : 'Request failed', loop: null })
        })
        .finally(() => setPendingId(null))
    },
  }
}
