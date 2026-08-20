import type { BodyStatus } from './shared'

export interface ControlStatusResult {
  result: BodyStatus
}

export interface StartResult {
  action: 'start'
  status: 'started' | 'already_running' | 'no_body_attached'
}

export interface StopResult {
  action: 'stop'
  status: 'stopped' | 'already_stopped' | 'no_body_attached'
}

export interface RestartResult {
  action: 'restart'
  stop: StopResult
  start: StartResult
}

export interface KillResult {
  action: 'kill'
  status: 'stopped' | 'no_body_attached'
  /** True if the underlying shutdown call itself failed or timed out — kill
   * still reports "stopped" regardless; see docs/VISION_API_CONTRACT.md. */
  forced: boolean
  reason?: string
}

export type WatchdogResult =
  | { healthy: true; action: 'none'; reason: 'no_body_attached' }
  | { healthy: true; action: 'none' }
  | { healthy: true; action: 'recovered'; attempts: RestartResult[] }
  | { healthy: false; action: 'recovery_failed'; attempts: RestartResult[]; kill: KillResult }

export interface ControlActionResult<T> {
  result: T
}
