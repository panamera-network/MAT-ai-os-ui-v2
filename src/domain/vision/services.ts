/**
 * Config-driven, fixed set of external processes MAT supervises directly:
 * `vision`, `strategy_engine`, `engine_dashboard`, `os_ui_mobile`, `mk1`,
 * `mk1_mobile`.
 * NOT the same thing as the old MAT-AI-OS-ui's `LauncherContext` (a separate
 * process on port 8050 with its own, differently-shaped service set) — see
 * docs/VISION_API_CONTRACT.md's Services section and
 * docs/OLD_UI_REFERENCE.md's "Two parallel Services concepts" finding.
 */
export interface ServiceStatus {
  id: string
  display_name: string
  /** False if the repo/interpreter wasn't found on this machine. */
  configured: boolean
  state: 'running' | 'degraded' | 'stopped' | 'unconfigured' | 'unknown_service'
  /** Shape varies by service — the `vision` id's `detail` is literally a
   * `BodyStatus` (see shared.ts), every other service's is process/health-port
   * bookkeeping. Left as a bag of fields rather than a false-precision union. */
  detail: Record<string, unknown>
}

export interface ServicesResult {
  services: ServiceStatus[]
}

export interface ServiceStartStopResult {
  id: string
  action: 'start' | 'stop'
  status: string
  detail?: Record<string, unknown>
}

export interface ServiceRestartResult {
  id: string
  action: 'restart'
  stop: ServiceStartStopResult
  start: ServiceStartStopResult
}

export interface ServiceActionResult<T> {
  result: T
}

/** Whether a service reads as "on" — `running` or `degraded` both mean the
 * process is up (even if unhealthy); only `stopped`/`unconfigured`/
 * `unknown_service` read as off. The single source of truth for this: it
 * used to be defined separately in the button-label logic and in
 * `useServiceControl`'s start-vs-stop decision, and those two copies had
 * drifted apart — a service showing "degraded" displayed a Stop button
 * (label logic said `degraded` counts as on) that actually called
 * `startService` (the toggle logic only checked for `running`), so clicking
 * Stop on a degraded service silently restarted it instead. */
export function isServiceOn(state: ServiceStatus['state']): boolean {
  return state === 'running' || state === 'degraded'
}
