import { useState } from 'react'
import { useVisionApi } from '../app/VisionApiProvider'
import type { VisionApiAdapter } from '../adapters/vision'
import { VisionApiError } from '../adapters/vision'
import type { PendingApprovalQueueResult, QueuedActionDetail } from '../domain/vision'
import { useVisionResource } from './useVisionResource'

const fetchQueue = (api: VisionApiAdapter, signal: AbortSignal) => api.getPendingApprovalQueue(signal)

interface UsePendingApprovalQueueResult {
  items: PendingApprovalQueueResult['items']
  loading: boolean
  /** Task id currently mid-approve/reject, if any — disable that one row's
   * actions, not the whole list. */
  pendingId: string | null
  /** Real result of the last resolve action — the caller shows this, then
   * it's the caller's own job to clear it before the next action (see
   * `resolve`'s own doc comment, same convention as `usePendingLearn`). */
  lastResult: { taskId: string; status: string; result: string | null; error: string | null } | null
  resolve: (taskId: string, action: 'approve' | 'reject') => void
  /** Real `GET /queue/pending-approval/{id}` — the richer, one-off detail
   * (result/error, once resolved) a summary row doesn't carry. */
  fetchDetail: (taskId: string) => Promise<QueuedActionDetail>
  refetch: () => void
}

/** Same display window `usePendingLearn` uses — long enough to actually
 * read the real result before the row disappears on refetch. */
const RESULT_DISPLAY_MS = 1400

/**
 * Real `GET /queue/pending-approval` snapshot plus the two real resolve
 * actions — the Governed Action Bridge's own human-approval queue (a real
 * `TaskQueue` record a Law/Contract/Rule verdict deferred), distinct from
 * Learn's new-domain suggestions. Not polled (glance-and-load, same as
 * `usePendingLearn`): `refetch()` runs after every resolve action, delayed
 * briefly so the real result is actually seen first.
 */
export function usePendingApprovalQueue(): UsePendingApprovalQueueResult {
  const api = useVisionApi()
  const resource = useVisionResource<PendingApprovalQueueResult>(fetchQueue)
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [lastResult, setLastResult] = useState<{ taskId: string; status: string; result: string | null; error: string | null } | null>(null)

  const resolve = (taskId: string, action: 'approve' | 'reject') => {
    setPendingId(taskId)
    setLastResult(null)
    const request = action === 'approve' ? api.approvePendingApprovalTask(taskId) : api.rejectPendingApprovalTask(taskId)
    request
      .then((detail) => {
        setLastResult({ taskId, status: detail.status, result: detail.result, error: detail.error })
      })
      .catch((err: unknown) => {
        const detail = err instanceof VisionApiError ? err.detail : 'Something went wrong.'
        setLastResult({ taskId, status: 'failed', result: null, error: detail })
      })
      .finally(() => {
        setPendingId(null)
        setTimeout(() => resource.refetch(), RESULT_DISPLAY_MS)
      })
  }

  return {
    items: resource.data?.items ?? [],
    loading: resource.loading,
    pendingId,
    lastResult,
    resolve,
    fetchDetail: (taskId: string) => api.getPendingApprovalTask(taskId),
    refetch: resource.refetch,
  }
}
