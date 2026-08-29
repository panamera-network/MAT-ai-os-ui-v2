import type { BodyScoped } from './shared'

/** One version of a `KnowledgeEngine` item — the commonly-populated subset. */
export interface KnowledgeVersion {
  version: number
  statement: string
  source: string
  confidence: number
  status: 'candidate' | 'active' | 'deprecated' | 'rejected'
  created_at: string
}

/** Mandatory Knowledge Note gate + Practice/Sparring -> Validate phase: where
 * an item sits in the Source -> Knowledge Note -> Compare -> Practice ->
 * Validate -> Skill pipeline — a DIFFERENT axis from a version's own belief-
 * confidence `status` above (which version currently wins). See
 * `WORKFLOW_STATUSES` in knowledge.py. */
export type KnowledgeWorkflowStatus =
  | 'new'
  | 'reviewed'
  | 'practicing'
  | 'validated'
  | 'ready_for_promotion'
  | 'promoted'
  | 'rejected'
  | 'needs_relearn'

/** One practice attempt recorded on a Knowledge Note — via `VerifierEngine`
 * (coding domain) or `SparringEngine` (every other domain), never both for
 * the same attempt. `evidence_ref`'s shape depends on `engine` (a verifier
 * verdict/reason/model, or a sparring session id/status) — kept as a loose
 * record rather than a discriminated union since the UI only ever surfaces
 * it as read-only detail, never branches logic on its internal shape. */
export interface KnowledgePracticeAttempt {
  attempt_id: string
  engine: 'verifier' | 'sparring'
  use_case_or_domain: string
  result: 'pass' | 'fail' | 'disputed'
  evidence_ref: Record<string, unknown> | null
  timestamp: string
}

/** Exactly what `promote_knowledge_to_skill` needs to write/update a skill —
 * carried on the note, opaque to `KnowledgeEngine` itself. Nullable fields
 * mirror the backend's own `entry.get(...)` shape (an "improve" decision, for
 * one, never carries `name`/`description`). */
export interface KnowledgeSkillPayload {
  action: 'create' | 'improve' | 'new_domain' | null
  skill_id: string | null
  domain: string | null
  name: string | null
  description: string | null
  prompt_fragment: string | null
  tools_required: string[]
}

/**
 * A real `KnowledgeEngine` item (Batch D; Mandatory Knowledge Note gate +
 * Practice/Sparring -> Validate phase) — versioned knowledge claims, NOT a
 * Skill and NOT the (unrelated, unexposed) `KnowledgeGraph` relation module
 * — see `GET /knowledge`'s own comment in api/app.py. No ownership concept
 * exists in this engine at all: every item is global.
 */
export interface KnowledgeItem {
  id: string
  topic: string
  domain: string | null
  tags: string[]
  active_version: number | null
  created_at: string
  updated_at: string
  versions: KnowledgeVersion[]
  workflow_status: KnowledgeWorkflowStatus
  workflow_reason: string | null
  practice_history: KnowledgePracticeAttempt[]
  validation_result: Record<string, unknown> | null
  promoted_skill_id: string | null
  skill_payload: KnowledgeSkillPayload | null
}

export type KnowledgeResult = BodyScoped<{ knowledge: KnowledgeItem[] }>

/** `GET /knowledge/{id}` — a single item, fetched on demand (e.g. to refresh
 * one note's real state right after a promote action) rather than trusting
 * the list snapshot's own poll cadence. `knowledge: null` covers both "no
 * such id" and "no Body attached" (see `body_attached`). */
export type KnowledgeItemResult = BodyScoped<{ knowledge: KnowledgeItem | null }>

/** `POST /knowledge/{id}/promote`'s own real outcome, verbatim — never
 * `BodyScoped` (the route itself never omits these fields, even with no
 * Body attached it still reports `denied`). */
export interface PromoteKnowledgeResult {
  status: 'promoted' | 'denied' | 'conflict' | 'failed'
  reason: string
  knowledge_id: string
  skill_id: string | null
  domain: string | null
  name: string | null
}
