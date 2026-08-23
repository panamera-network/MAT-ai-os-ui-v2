import type { BodyScoped } from './shared'

/**
 * One normalized entry merged server-side from two independent, already
 * -persisted backend logs (`ErrorLogManager`/`LearningAnalytics`) — never
 * invented client-side. `source` names which log it came from; `id` is
 * globally unique across the merged list (see `api/schemas.py::EventEntry`).
 * `timestamp` is an ISO 8601 string, not epoch millis — convert with
 * `new Date(timestamp).getTime()` where a number is needed (see
 * `HudEvent` in `components/hudEvents.ts`, the session-local sibling type
 * this gets merged into for display).
 */
export interface VisionEventEntry {
  id: string
  timestamp: string
  source: 'error' | 'learning'
  type: string
  message: string
  severity: 'info' | 'success' | 'warning' | 'danger'
}

export type EventsResult = BodyScoped<{ events: VisionEventEntry[] }>
