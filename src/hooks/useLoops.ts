import type { VisionApiAdapter } from '../adapters/vision'
import type { LoopsResult } from '../domain/vision'
import { LEFT_PANEL_POLL_MS, useVisionResource } from './useVisionResource'

const fetchLoops = (api: VisionApiAdapter, signal: AbortSignal) => api.getLoops(signal)

/** Real `GET /loops` snapshot for the Glass HUD's left info zone — polled
 * (Batch A) so the card reflects live state, not a one-shot load. */
export function useLoops() {
  return useVisionResource<LoopsResult>(fetchLoops, { pollMs: LEFT_PANEL_POLL_MS })
}
