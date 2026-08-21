import type { VisionApiAdapter } from '../adapters/vision'
import type { LoopsResult } from '../domain/vision'
import { useVisionResource } from './useVisionResource'

const fetchLoops = (api: VisionApiAdapter, signal: AbortSignal) => api.getLoops(signal)

/** Real `GET /loops` snapshot for the Glass HUD's left info zone. */
export function useLoops() {
  return useVisionResource<LoopsResult>(fetchLoops)
}
