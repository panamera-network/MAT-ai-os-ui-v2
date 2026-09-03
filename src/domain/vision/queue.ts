/**
 * Governed Action Queue — a real `TaskQueue` record that a Law/Contract/Rule
 * verdict deferred to a human, resolved via `POST /queue/pending-approval/
 * {id}/approve|reject` (owner-gated). Distinct from Learn's own pending-
 * suggestions queue (`PendingLearnSuggestionsResult`) — that's a proposed
 * new-domain skill; this is an ACTION MAT wants to execute, held by the
 * Governed Action Bridge itself. See docs/VISION_API_CONTRACT.md.
 */
export interface QueuedActionSummary {
  id: string
  status: 'pending_approval' | 'running' | 'completed' | 'failed' | 'blocked' | 'timed_out' | 'rejected'
  /** The raw request text — the thing actually being approved, shown
   * verbatim (there is nothing more sanitized to show in its place). */
  task: string
  stage: string | null
  action: string | null
  detail: string | null
  /** Who originally triggered the action — the identity it will still
   * execute AS, once approved. Distinct from `resolved_by` below. */
  user_id: string
  created_at: string
  resolved_by: string | null
  resolved_at: string | null
}

export interface QueuedActionDetail extends QueuedActionSummary {
  /** Populated only once resolved (approved-and-executed, or rejected);
   * `null` while still `pending_approval`. */
  result: string | null
  error: string | null
}

export interface PendingApprovalQueueResult {
  items: QueuedActionSummary[]
}
