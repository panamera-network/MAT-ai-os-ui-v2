import type { VisionApiAdapter } from '../adapters/vision'
import type { AgentsResult } from '../domain/vision'
import { LEFT_PANEL_POLL_MS, useVisionResource } from './useVisionResource'

const fetchAgents = (api: VisionApiAdapter, signal: AbortSignal) => api.getAgents(signal)

/** Real `GET /agents` snapshot for the Glass HUD's left info zone — polled
 * (Batch A) so the card reflects live state, not a one-shot load. */
export function useAgents() {
  return useVisionResource<AgentsResult>(fetchAgents, { pollMs: LEFT_PANEL_POLL_MS })
}
