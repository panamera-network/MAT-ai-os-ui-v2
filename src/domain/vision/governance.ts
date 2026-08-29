import type { BodyScoped } from './shared'

export interface Law {
  id: string
  action: string
  rule: 'allow' | 'queue' | 'deny'
}

export interface LawStatus {
  total: number
  active_count: number
  inactive_count: number
  active_laws: Law[]
}

export interface LifecycleStatus {
  total_cases: number
  by_state: Record<string, number>
}

/**
 * One `GovernanceLifecycleEngine` case record — the commonly-populated
 * subset (matches `McpApproval`'s own "trimmed for review" precedent). Used
 * for `AgentsResult.unresolved_cases` (entity_type "agent" only, server-
 * filtered) — see `GET /agents`'s own docstring in api/app.py.
 */
export interface GovernanceCase {
  case_id: string
  entity_type: string
  entity_id: string
  state: string
  source_module: string
  issue: string
  severity: string
  updated_at: string
}

/**
 * One real `GuardrailPipelineCoordinator` block/warning outcome (Batch B:
 * `GuardrailBlockLog`) — `severity: "block"` is a genuine stop (the task did
 * not run), `"warning"` is a non-fatal queue/alert outcome. `source` is a
 * best-effort 2-way classification only (`"system"` for internal loop-driven
 * tasks, `"user"` otherwise) — never a genuine 3-way User/MAT/Agent split,
 * see the backend's own `GuardrailBlockLog` docstring.
 */
export interface GuardrailBlockEvent {
  stage: string
  action: string | null
  reason: unknown
  source: 'user' | 'system'
  severity: 'block' | 'warning'
  at: string
}

/** `LearningAnalytics.get_stats()`'s own real fields, verbatim — the
 * commonly-populated subset this UI actually renders. Mandatory Knowledge
 * Note gate: `total_skills_learned`/`total_improved`/`total_approved` are
 * all dead counters today — no real `track_event()` call site anywhere
 * tracks "learned"/"improved"/"approved" anymore (confirmed against every
 * call site in api/app.py and governance.py), so these only ever hold
 * whatever count existed before that rename. `total_reviewed` is the real,
 * currently-live successor (folds "learned" in for historical continuity —
 * see `get_stats()`'s own comment); `total_rejected`/`total_discarded` were
 * never renamed and stay genuinely live. */
export interface LearningStats {
  total_reviewed?: number
  total_skills_learned?: number
  total_improved?: number
  total_rejected?: number
  total_approved?: number
  total_discarded?: number
  most_active_domain?: string | null
}

export type GovernanceResult = BodyScoped<{
  laws: LawStatus
  lifecycle: LifecycleStatus
  /** Batch B telemetry — real Law/Contract/Rule block outcomes recorded
   * today (KL calendar day). Empty until `GuardrailPipelineCoordinator` is
   * wired with a `block_log` — never fabricated. */
  blocked_today: GuardrailBlockEvent[]
  warnings_today: GuardrailBlockEvent[]
  /** Real `RuleEngine.evaluate()` matches logged today (KL calendar day). */
  rules_triggered_today: number
  learning_stats: LearningStats
}>
