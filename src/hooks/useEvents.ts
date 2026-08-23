import type { VisionApiAdapter } from '../adapters/vision'
import type { EventsResult } from '../domain/vision'
import { useVisionResource } from './useVisionResource'

/** Matches `HomeScreen`'s own cap on session-local events — the merged
 * Recent Events list stays a fixed, bounded size either way. */
const EVENTS_LIMIT = 24

const fetchEvents = (api: VisionApiAdapter, signal: AbortSignal) => api.getEvents(EVENTS_LIMIT, signal)

/** Real `GET /events` snapshot — MAT's own merged error-log/learning-analytics
 * history, for the Glass HUD's Recent Events card. See `useVisionResource`'s
 * own doc comment for why this self-heals if it first loads before MAT does. */
export function useEvents() {
  return useVisionResource<EventsResult>(fetchEvents)
}
