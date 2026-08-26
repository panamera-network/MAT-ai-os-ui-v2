import type { BodyScoped } from './shared'
import type { GovernanceCase } from './governance'

export interface Agent {
  agent_id: string
  name: string
  domain: string
  skill_ids: string[]
  /** `owner_user_id` server-side; `null`/absent means a global agent. */
  user_id: string | null
  is_global: boolean
  // Deliberately no `status` field — the real API never returns one
  // (`base_agent.py::to_dict()` has no such key). Do not add it here even
  // though the old MAT-AI-OS-ui's `Agent` type carries an optional
  // `status?: 'active' | 'idle'` — that field always renders `undefined`
  // there today. See docs/VISION_API_CONTRACT.md's Agents section.
  /** Batch B telemetry — real only for an agent created after that change
   * shipped; `null` for one reconstructed from a pre-existing record. */
  created_at: string | null
}

export type AgentsResult = BodyScoped<{
  agents: Agent[]
  /** Batch B telemetry — real, currently-active agent ids (in-memory,
   * resets on backend restart). */
  active_agent_ids: string[]
  /** Real `GovernanceLifecycleEngine` cases (entity_type "agent") not yet
   * resolved — "failed/unhealthy" is this list being non-empty, never a
   * separate invented flag. */
  unresolved_cases: GovernanceCase[]
}>
