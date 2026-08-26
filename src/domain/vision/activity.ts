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
