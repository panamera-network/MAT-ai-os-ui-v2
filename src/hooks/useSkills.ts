import type { VisionApiAdapter } from '../adapters/vision'
import type { SkillsResult } from '../domain/vision'
import { useVisionResource } from './useVisionResource'

const fetchSkills = (api: VisionApiAdapter, signal: AbortSignal) => api.getSkills(signal)

/** Real `GET /skills` snapshot — data path for the Glass HUD's left info
 * zone (a compact count today; ready to feed a real skills drawer/list
 * later without changing how the data is fetched). */
export function useSkills() {
  return useVisionResource<SkillsResult>(fetchSkills)
}
