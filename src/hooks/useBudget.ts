import type { VisionApiAdapter } from '../adapters/vision'
import type { BudgetResult } from '../domain/vision'
import { LEFT_PANEL_POLL_MS, useVisionResource } from './useVisionResource'

const fetchBudget = (api: VisionApiAdapter, signal: AbortSignal) => api.getBudget(signal)

/** Real `GET /budget` snapshot for the Glass HUD's Models card (usage/
 * fallback/budget telemetry) — polled (Batch A/C pattern), same cadence as
 * every other left-panel resource. */
export function useBudget() {
  return useVisionResource<BudgetResult>(fetchBudget, { pollMs: LEFT_PANEL_POLL_MS })
}
