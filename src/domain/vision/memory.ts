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
