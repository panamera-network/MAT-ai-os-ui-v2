import type { VisionApiAdapter } from '../adapters/vision'
import type { SkillsResult } from '../domain/vision'
import { LEFT_PANEL_POLL_MS, useVisionResource } from './useVisionResource'

const fetchSkills = (api: VisionApiAdapter, signal: AbortSignal) => api.getSkills(signal)

/** Real `GET /skills` snapshot — data path for the Glass HUD's left info
 * zone, and (Batch A) the Skill Library detail overlay. Polled so both stay
 * live, not a one-shot load. */
export function useSkills() {
  return useVisionResource<SkillsResult>(fetchSkills, { pollMs: LEFT_PANEL_POLL_MS })
}
