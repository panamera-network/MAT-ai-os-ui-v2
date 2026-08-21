import type { VisionApiAdapter } from '../adapters/vision'
import type { GovernanceResult } from '../domain/vision'
import { useVisionResource } from './useVisionResource'

const fetchGovernance = (api: VisionApiAdapter, signal: AbortSignal) => api.getGovernance(signal)

/** Real `GET /governance` snapshot for the Glass HUD's left info zone. */
export function useGovernance() {
  return useVisionResource<GovernanceResult>(fetchGovernance)
}
