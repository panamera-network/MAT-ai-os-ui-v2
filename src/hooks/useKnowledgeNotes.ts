import type { VisionApiAdapter } from '../adapters/vision'
import type { KnowledgeResult } from '../domain/vision'
import { LEFT_PANEL_POLL_MS, useVisionResource } from './useVisionResource'

const fetchKnowledgeNotes = (api: VisionApiAdapter, signal: AbortSignal) => api.getKnowledge(undefined, signal)

/** Real `GET /knowledge` snapshot (unfiltered — every workflow_status) —
 * data path for the Glass HUD's left info zone (Knowledge Notes card) and
 * its detail overlay, same "lift the fetch up so both consumers share one
 * poll" convention `useSkills`/`useAgents`/etc. already use. Status counts
 * and the detail list are both derived client-side from this one response
 * rather than issuing five separate `workflow_status`-filtered requests. */
export function useKnowledgeNotes() {
  return useVisionResource<KnowledgeResult>(fetchKnowledgeNotes, { pollMs: LEFT_PANEL_POLL_MS })
}
