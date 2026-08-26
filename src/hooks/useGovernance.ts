import type { VisionApiAdapter } from '../adapters/vision'
import type { GovernanceResult } from '../domain/vision'
import { LEFT_PANEL_POLL_MS, useVisionResource } from './useVisionResource'

const fetchGovernance = (api: VisionApiAdapter, signal: AbortSignal) => api.getGovernance(signal)

/** Real `GET /governance` snapshot for the Glass HUD's left info zone —
 * polled (Batch A) so the card reflects live state, not a one-shot load. */
export function useGovernance() {
  return useVisionResource<GovernanceResult>(fetchGovernance, { pollMs: LEFT_PANEL_POLL_MS })
}
