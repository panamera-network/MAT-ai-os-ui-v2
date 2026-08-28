import type { BodyStatus } from './shared'
import type { IdentityProfile } from './identity'

export interface ActiveModel {
  provider: string
  model: string
}

export interface Health {
  status: 'ok'
  is_running: boolean
  active_model: ActiveModel
  faculties: {
    soul: boolean
    intelligence: boolean
    reasoning: boolean
    vision: boolean
    voice: boolean
  }
  /** Best-effort config *presence* checks only — never a live provider call,
   * never "confirmed reachable". `vision_configured` mirrors this exactly:
   * true the moment any real VISION candidate (primary/fallback_cloud/...)
   * has its credential env var present, never proof `/see` will actually
   * succeed. */
  degraded: {
    llm_provider_configured: boolean
    stt_configured: boolean
    tts_configured: boolean
    vision_configured: boolean
  }
  body: BodyStatus
}

export interface ThinkRequest {
  text: string
  tier?: string
  style?: string
  context?: string
}

export interface ThinkResult {
  response: string
}

export interface SeeRequest {
  prompt: string
  /** At least one required — enforced server-side with a 422, not here. */
  images: Blob[]
}

export interface SeeResult {
  response: string
}

/** `POST /read`'s own real fields, verbatim -- a document (PDF/TXT/MD/CSV)
 * attachment, parsed server-side. No persistence, no `/learn` involvement:
 * the caller (this app's own chat session state) holds `content` for as
 * long as it wants it and no longer. */
export interface DocumentReadResult {
  filename: string
  content: string
  truncated: boolean
  char_count: number
}

export interface ListenRequest {
  audio: Blob
  filename?: string
  session_id?: string
}

export interface ListenResult {
  transcribed_text: string
  response_text: string
  /** Present only if TTS produced a spoken reply. */
  audio_base64: string | null
  session_id: string | null
  /** True if governance blocked the request. */
  blocked: boolean
  stage: string | null
  detail: string | null
}

export interface SpeakRequest {
  text: string
}

export interface LearnRequest {
  content: string
  /** Bounded recent-conversation text, caller-assembled — same "hand it in
   * already assembled" contract as `ThinkRequest.context`. */
  context?: string
}

/**
 * The Learning Receipt — `GovernanceLayer.evaluate()`'s own real
 * found/learned/why/source, with `changed` filled in by the backend's
 * `/learn` route only once the real apply outcome is known ("created skill
 * X" / "upgraded skill Y" / "pending approval" / "rejected" / "failed").
 * `changed` must always be rendered verbatim — never re-derived client-side.
 */
export interface LearnReceipt {
  found: string | null
  learned: string | null
  changed: string | null
  why: string | null
  source: string
}

/**
 * One decision's real outcome from a multi-skill `/learn` batch — the SAME
 * data `receipt.changed` already flattens into one string, structured
 * instead so a "one row per skill" UI can iterate it directly. `status`:
 * "applied" (created/upgraded a real skill), "ignored" (a per-pattern
 * reject or batch-local dedup/cap drop — deliberately never registered),
 * "pending" (a new_domain decision, always held for separate human
 * review), "failed" (governance passed but this ONE apply raised), or
 * "not_applied" (defensive fallback, should not occur in practice).
 */
export interface LearnDecisionSummary {
  status: 'applied' | 'ignored' | 'pending' | 'failed' | 'not_applied'
  action: 'create' | 'improve' | 'new_domain' | 'reject' | null
  skill_id: string | null
  domain: string | null
  name: string | null
  reason: string
}

export interface LearnResult {
  /** "learned": actually applied to the skill registry. "pending_approval":
   * governance passed but the decision (a new domain) is consequential
   * enough to hold as an unresolved suggestion. "rejected": failed
   * security/quality/relevance. "failed": governance passed but applying it
   * raised. */
  status: 'learned' | 'pending_approval' | 'rejected' | 'failed'
  reason: string
  suggestion_id: string | null
  skill_id: string | null
  domain: string | null
  /** `null` only for the earliest failure modes (content never fetched, no
   * Body attached, governance unavailable) — no evaluation ever ran. */
  receipt: LearnReceipt | null
  /** Present only for a genuine multi-decision batch — `null`/absent for the
   * common single-skill case, which keeps using `skill_id`/`domain` above
   * unchanged. */
  decisions?: LearnDecisionSummary[] | null
}

/** One `LearnSuggestionManager` record's own real fields, trimmed for review
 * — a `new_domain` decision `/learn` left pending. `status` is `"pending"`
 * (still within its active 15-minute window) or `"deferred"` (TTL elapsed —
 * never discarded/auto-applied, still fully approvable/rejectable). */
export interface LearnSuggestionSummary {
  id: string
  status: 'pending' | 'deferred'
  operation: string
  target_skill_id: string | null
  domain: string | null
  reason: string
  source: string
  requested_by: string
  created_at: string
  expires_at: string
}

/** Same fields as the summary, plus the complete governance decision
 * snapshot (`GovernanceLayer.evaluate()`'s own "suggest" shape) this
 * suggestion would apply on approval. */
export interface LearnSuggestionDetail extends LearnSuggestionSummary {
  proposed: {
    name?: string
    description?: string
    prompt_fragment?: string
    tools_required?: string[]
    [key: string]: unknown
  }
}

export interface PendingLearnSuggestionsResult {
  suggestions: LearnSuggestionSummary[]
}

/** `/speak` responds with raw audio bytes, not JSON — this is what the
 * adapter turns that into. */
export interface SpeakResult {
  audio: Blob
  contentType: string
}

export interface SoulInfo {
  soul_prompt: string
  response_styles: Record<string, string>
  safety_rules: string
  active_style: string
  /** Embedded in every real `/soul` response even though nothing consumes it
   * from here today — `GET /identity` is the field callers actually want. */
  identity: IdentityProfile
}

export interface SoulResult {
  soul: SoulInfo
}
