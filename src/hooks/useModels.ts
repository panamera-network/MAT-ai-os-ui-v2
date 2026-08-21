import type { VisionApiAdapter } from '../adapters/vision'
import type { ModelsResult } from '../domain/vision'
import { useVisionResource } from './useVisionResource'

const fetchModels = (api: VisionApiAdapter, signal: AbortSignal) => api.getModels(signal)

/** Real `GET /models` snapshot for the Glass HUD's left info zone. */
export function useModels() {
  return useVisionResource<ModelsResult>(fetchModels)
}
