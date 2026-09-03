import { useState } from 'react'
import { useVisionApi } from '../app/VisionApiProvider'
import type { VisionApiAdapter } from '../adapters/vision'
import { VisionApiError } from '../adapters/vision'
import type { McpResult } from '../domain/vision'
import { LEFT_PANEL_POLL_MS, useVisionResource } from './useVisionResource'

const fetchMcp = (api: VisionApiAdapter, signal: AbortSignal) => api.getMcp(signal)

/** Same display window `usePendingLearn` uses — long enough to actually
 * read the real result before the row disappears on refetch. */
const RESULT_DISPLAY_MS = 1400

/** Real `GET /mcp` snapshot for the Glass HUD's left info zone — polled
 * (Batch A) so the card reflects live state, not a one-shot load — plus the
 * two real approve/deny actions for its own `pending_approvals`. Additive
 * to the existing read-only shape (every existing field/behavior
 * unchanged) — `useMcp()` still IS the one poll driving the card, actions
 * just refetch it via its own `refetch()` once a real result is known. */
export function useMcp() {
  const api = useVisionApi()
  const resource = useVisionResource<McpResult>(fetchMcp, { pollMs: LEFT_PANEL_POLL_MS })
  const [pendingApprovalId, setPendingApprovalId] = useState<string | null>(null)
  const [approvalResult, setApprovalResult] = useState<{ approvalId: string; status: string; error: string | null } | null>(null)

  const resolveApproval = (approvalId: string, action: 'approve' | 'deny') => {
    setPendingApprovalId(approvalId)
    setApprovalResult(null)
    const request = action === 'approve' ? api.approveMcpApproval(approvalId) : api.denyMcpApproval(approvalId)
    request
      .then((result) => {
        setApprovalResult({ approvalId, status: result.approval.status, error: result.approval.error })
      })
      .catch((err: unknown) => {
        setApprovalResult({ approvalId, status: 'failed', error: err instanceof VisionApiError ? err.detail : 'Something went wrong.' })
      })
      .finally(() => {
        setPendingApprovalId(null)
        setTimeout(() => resource.refetch(), RESULT_DISPLAY_MS)
      })
  }

  return { ...resource, pendingApprovalId, approvalResult, resolveApproval }
}
