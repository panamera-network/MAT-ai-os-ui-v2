import type { VisionApiAdapter } from '../adapters/vision'
import type { ModelsResult } from '../domain/vision'
import { LEFT_PANEL_POLL_MS, useVisionResource } from './useVisionResource'

const fetchModels = (api: VisionApiAdapter, signal: AbortSignal) => api.getModels(signal)

/** Real `GET /models` snapshot for the Glass HUD's left info zone — polled
 * (Batch A) so the card reflects live state, not a one-shot load. */
export function useModels() {
  return useVisionResource<ModelsResult>(fetchModels, { pollMs: LEFT_PANEL_POLL_MS })
}
