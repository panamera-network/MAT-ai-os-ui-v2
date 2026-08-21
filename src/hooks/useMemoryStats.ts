import type { VisionApiAdapter } from '../adapters/vision'
import type { MemoryResult } from '../domain/vision'
import { useVisionResource } from './useVisionResource'

const fetchMemory = (api: VisionApiAdapter, signal: AbortSignal) => api.getMemory(signal)

/** Real `GET /memory` snapshot for the Glass HUD's right control zone. */
export function useMemoryStats() {
  return useVisionResource<MemoryResult>(fetchMemory)
}
