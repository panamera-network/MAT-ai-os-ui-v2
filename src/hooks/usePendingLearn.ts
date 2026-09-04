import { useState } from 'react'
import { useVisionApi } from '../app/VisionApiProvider'
import type { VisionApiAdapter } from '../adapters/vision'
import { VisionApiError } from '../adapters/vision'
import type { LearnSuggestionDetail, PendingLearnSuggestionsResult } from '../domain/vision'
import { useVisionResource } from './useVisionResource'

const fetchPending = (api: VisionApiAdapter, signal: AbortSignal) => api.getPendingLearnSuggestions(signal)

interface UsePendingLearnResult {
  suggestions: PendingLearnSuggestionsResult['suggestions']
  loading: boolean
  /** The real fetch error, if the last load failed — previously computed by
   * `useVisionResource` but never returned, so a genuine backend error was
   * indistinguishable from "zero pending suggestions" to any caller. Needed
   * for the Need Approval card to show the existing offline/error treatment
   * (`describeResourceStatus`) instead of silently reading as empty. */
  error: VisionApiError | null
  /** Suggestion id currently mid-approve/reject, if any — disable that one
   * row's actions, not the whole list. */
  pendingId: string | null
  /** Real result of the last resolve action (approve or reject) — the
   * caller shows this, then it's the caller's own job to clear it before
   * the next action (see `resolve`'s own doc comment). */
  lastResult: { suggestionId: string; status: string; reason: string } | null
  resolve: (suggestionId: string, action: 'approve' | 'reject') => void
  /** Real `GET /learn/pending/{id}` — the richer, one-off detail (proposed
   * name/description/prompt_fragment) a summary row doesn't carry. Called
   * on-demand when a row expands, not prefetched for every row. */
  fetchDetail: (suggestionId: string) => Promise<LearnSuggestionDetail>
  refetch: () => void
}

/** How long a resolved row's real result ("Learned."/"Rejected."/"Failed —
 * ...") stays visible before the list refetch removes it — long enough to
 * actually read, short enough that "remove the resolved item" still feels
 * immediate. Real bug found via live testing: refetching right away removed
 * the row (and the whole card, once it was the last one) before the result
 * could render at all. */
const RESULT_DISPLAY_MS = 1400

/** Real `GET /learn/pending` snapshot plus the two real resolve actions —
 * for the Glass HUD's Pending Learn Approvals card. Not polled (matches
 * `useEvents`' own glance-and-load convention): `refetch()` runs after every
 * resolve action (delayed briefly so the result above is actually seen), and
 * `Recent Events` (a separately-polled resource) picks up the resulting
 * analytics event on its own next fetch. */
export function usePendingLearn(): UsePendingLearnResult {
  const api = useVisionApi()
  const resource = useVisionResource<PendingLearnSuggestionsResult>(fetchPending)
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [lastResult, setLastResult] = useState<{ suggestionId: string; status: string; reason: string } | null>(null)

  const resolve = (suggestionId: string, action: 'approve' | 'reject') => {
    setPendingId(suggestionId)
    setLastResult(null)
    const request = action === 'approve' ? api.approveLearnSuggestion(suggestionId) : api.rejectLearnSuggestion(suggestionId)
    request
      .then((result) => {
        setLastResult({ suggestionId, status: result.status, reason: result.reason })
      })
      .catch((err: unknown) => {
        const detail = err instanceof VisionApiError ? err.detail : 'Something went wrong.'
        setLastResult({ suggestionId, status: 'failed', reason: detail })
      })
      .finally(() => {
        setPendingId(null)
        setTimeout(() => resource.refetch(), RESULT_DISPLAY_MS)
      })
  }

  return {
    suggestions: resource.data?.suggestions ?? [],
    loading: resource.loading,
    error: resource.error,
    pendingId,
    lastResult,
    resolve,
    fetchDetail: (suggestionId: string) => api.getLearnSuggestion(suggestionId),
    refetch: resource.refetch,
  }
}
