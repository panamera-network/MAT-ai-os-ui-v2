import type { BodyScoped } from './shared'

export interface MemoryTierCounts {
  hot: number
  warm: number
  cold: number
  archive: number
}

export interface MemoryStats {
  counts: MemoryTierCounts
  total_memories: number
  estimated_size_bytes: number
}

/**
 * `tiers` is a misleading field name inherited from the real API — it's one
 * stats object, not a per-tier map. It can also legitimately be `{}` (a
 * fully empty object, not the shape above) when a body is attached but the
 * memory backend itself is unreachable — see docs/VISION_API_CONTRACT.md's
 * Memory section. Modeled as a union rather than making every field optional
 * so a consumer has to explicitly handle "no stats at all", not just forget
 * to check one field.
 */
export type MemoryTiers = MemoryStats | Record<string, never>

export function hasMemoryStats(tiers: MemoryTiers): tiers is MemoryStats {
  return 'counts' in tiers
}

/**
 * Three independently-grounded signals, never derived from one another or
 * from `tiers` — see docs/VISION_API_CONTRACT.md's Memory section and
 * `api/schemas.py::MemoryHealth` (MAT-AI-OS-V2). Always present, even when
 * `tiers` is `{}` or `body_attached` is `false`.
 */
export interface MemoryHealth {
  /** Did `MemoryManager` construct at all — a structural fact, not a live probe. */
  module_ready: boolean
  /** Live network probe of the Qdrant server itself. `'unknown'` only when no
   * body is attached to check it through — never a guessed `'offline'`. */
  qdrant: 'online' | 'offline' | 'unknown'
  /** THIS manager instance's own current connection state — can lag
   * `qdrant: 'online'` right after Qdrant restarts, until this instance's own
   * lazy reconnect has actually run. */
  vector_store_connected: boolean
}

export type MemoryResult = BodyScoped<{ tiers: MemoryTiers; health: MemoryHealth }>

/**
 * `GET /memory/user` — the caller's own durable (MemoryType.USER) memories
 * only; mem0's own `user_id` filter makes a cross-user result structurally
 * impossible. Excludes the caller's own Conversation Profile record (same
 * memory_type, a different category — see `ConversationProfileDimension`
 * below) — it's a structured dimension blob, not a human-readable fact.
 */
export interface UserMemoryEntry {
  id: string
  content: string
  metadata: Record<string, unknown>
  created_at: string | null
}

export type UserMemoriesResult = BodyScoped<{ memories: UserMemoryEntry[] }>

/**
 * One learned communication-STYLE dimension for the caller — never a fact
 * about them (see `UserMemoryEntry` for that). `source` is `"explicit"`
 * (the user directly stated/corrected this) or `"inferred"` (observed
 * across sessions, evidence-gated before it's ever exposed here — a still-
 * accumulating candidate never appears, same as it's never injected into
 * /think's own context).
 */
export interface ConversationProfileDimension {
  value: string
  confidence: number
  evidence_count: number
  source: string
  last_updated: string
}

/** `GET /memory/profile` — a single point lookup at a fixed, per-user
 * deterministic id (never a listing/search). `exists: false` with an empty
 * `dimensions` is a real, non-error state (no profile learned yet), not
 * distinguishable here from `body_attached: false` — both render the same
 * "nothing to show" case. */
export type ConversationProfileResult = BodyScoped<{
  exists: boolean
  dimensions: Record<string, ConversationProfileDimension>
}>
