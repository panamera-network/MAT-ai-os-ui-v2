import type { VisionApiAdapter } from '../adapters/vision'
import type { ServicesResult } from '../domain/vision'
import { LEFT_PANEL_POLL_MS, useVisionResource } from './useVisionResource'

const fetchServices = (api: VisionApiAdapter, signal: AbortSignal) => api.getServices(signal)

/** Real `GET /services` snapshot for the Glass HUD's right control zone.
 * Service Controls audit: this used to fetch once on mount and never again
 * -- a service crashing on its own (or being changed from elsewhere) would
 * never be reflected until the user happened to trigger some other action's
 * own refetch, or reloaded the page. Polls on the same cadence every other
 * left-panel resource already uses. */
export function useServices() {
  return useVisionResource<ServicesResult>(fetchServices, { pollMs: LEFT_PANEL_POLL_MS })
}
