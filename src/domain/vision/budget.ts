import type { BodyScoped } from './shared'

/**
 * V2Body's own intelligence-layer budget/usage telemetry (Batch B) —
 * deliberately a separate route/type from `ModelsResult` (MAT's own model
 * registry, a genuinely different control path — see `ModelsResult`'s own
 * comment). `available_usd` is always computed server-side live as
 * `limit_usd - used_usd`, never a stored "reserve" value — never label it
 * that in the UI either.
 */
export type BudgetResult = BodyScoped<{
  status: Record<string, unknown>
  used_usd: number
  limit_usd: number
  available_usd: number
  /** "provider/model" -> real dispatch count, persisted (day-scoped, KL
   * calendar day) — survives backend restart. */
  model_usage: Record<string, number>
  /** capability -> real count of dispatches that landed on a non-primary
   * tier, in-memory (resets on backend restart). */
  fallback_counts: Record<string, number>
}>
