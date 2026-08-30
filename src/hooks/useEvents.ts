import type { VisionApiAdapter } from '../adapters/vision'
import type { EventsResult } from '../domain/vision'
import { LEFT_PANEL_POLL_MS, useVisionResource } from './useVisionResource'

/** Matches `HomeScreen`'s own cap on session-local events — the merged
 * Recent Events list stays a fixed, bounded size either way. */
const EVENTS_LIMIT = 24

const fetchEvents = (api: VisionApiAdapter, signal: AbortSignal) => api.getEvents(EVENTS_LIMIT, signal)

/** Real `GET /events` snapshot — MAT's own merged error-log/learning-analytics
 * history, for the Glass HUD's Recent Events card. See `useVisionResource`'s
 * own doc comment for why this self-heals if it first loads before MAT does.
 * Recent Events audit: this used to fetch once on mount and never again --
 * a long session's own client-side events kept growing live while this half
 * of the merged feed silently froze at whatever existed at page load. Polls
 * on the same cadence every other left-panel/HUD resource already uses. */
export function useEvents() {
  return useVisionResource<EventsResult>(fetchEvents, { pollMs: LEFT_PANEL_POLL_MS })
}
