import type { BodyScoped } from './shared'

export interface Skill {
  id: string
  name: string
  domain: string
  description: string
  tools_required: string[]
  prompt_fragment: string
  source?: string
  learned_at?: string
  auto_generated?: boolean
  /** MCP server names this skill grants access to. */
  mcp_servers?: string[]
  /** Present only for a personal (non-global) learned skill. */
  owner_user_id?: string
  is_global?: boolean
  // Deliberately no `kind: 'ability' | 'content'` field — the real API
  // doesn't compute or return one (the old MAT-AI-OS-ui's own
  // BackendContext.tsx already documents this as a client-only concept it
  // never got server-side data for). Do not invent a value here.
}

/** One `SkillVersioning` snapshot record. `data` is the full skill-dict
 * snapshot the backend already sends — the skill's state BEFORE the update
 * this record was saved for (`SkillRegistry.update()` snapshots `current`
 * before merging in the new fields). Needed to build a Before/After diff
 * against the skill's CURRENT state (see `SkillSnapshotPanel`); typed loosely
 * since it's an arbitrary-shaped historical snapshot, not guaranteed to match
 * today's `Skill` shape field-for-field. */
export interface SkillVersion {
  version_id: string
  skill_id: string
  owner_user_id: string | null
  provenance: string
  reason: string
  created_at: string
  data: Record<string, unknown>
}

export type SkillsResult = BodyScoped<{
  skills: Skill[]
  /** Batch B telemetry — how many distinct skills have more than one
   * version on record (derived from existing SkillVersioning history). */
  upgraded_count: number
  /** Every version record across every skill that isn't that skill's first
   * save, newest first. */
  recent_upgrades: SkillVersion[]
}>

/** `GET /skills/{skill_id}/versions` — one skill's real upgrade history,
 * owner-scoped exactly like `SkillVersioning.get_versions` itself. */
export type SkillVersionsResult = BodyScoped<{ skill_id: string; versions: SkillVersion[] }>
