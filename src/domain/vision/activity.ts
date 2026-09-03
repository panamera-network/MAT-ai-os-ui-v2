import type { BodyScoped } from './shared'

export interface Loop {
  id: string
  name: string
  description: string
  trigger: 'cron' | 'interval' | 'event'
  schedule: string
  task: string
  domain: string | null
  /** Present server-side; not in the old MAT-AI-OS-ui's `LoopInfo` type. */
  pipeline: 'simple' | 'full'
  /** Present server-side; not in the old MAT-AI-OS-ui's `LoopInfo` type. */
  done_when: string | null
  status: 'active' | 'paused' | string
  last_run: string | null
  next_run: string | null
  run_count: number
  created_at: string
}

export type LoopsResult = BodyScoped<{
  loops: Loop[]
  /** Batch B telemetry — real, persisted day-bucketed counts (KL calendar
   * day), both 0 if no loop has fired yet today. */
  today: { completed: number; failed: number }
}>

/** `GET /loops/{id}`, `POST /loops/{id}/pause|start` — the SAME real `Loop`
 * record `LoopsResult.loops` already carries, one at a time. */
export interface LoopActionResult {
  loop: Loop
}

/** `POST /loops/{id}/run-now` — `outcome` is `LoopsEngine._fire`'s own real
 * string: `"executed"`, `"skipped_not_active"` (paused — never silently
 * reactivated), or `"skipped_already_running"` (overlap guard). Never a bare
 * boolean "success" — the caller needs to know WHY nothing ran, not just
 * that nothing did. */
export interface LoopRunNowResult {
  loop: Loop
  outcome: string
}
