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

export type MemoryResult = BodyScoped<{ tiers: MemoryTiers }>
