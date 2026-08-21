import type { VisionApiAdapter } from '../adapters/vision'
import type { AgentsResult } from '../domain/vision'
import { useVisionResource } from './useVisionResource'

const fetchAgents = (api: VisionApiAdapter, signal: AbortSignal) => api.getAgents(signal)

/** Real `GET /agents` snapshot for the Glass HUD's left info zone. */
export function useAgents() {
  return useVisionResource<AgentsResult>(fetchAgents)
}
