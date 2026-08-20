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

export type SkillsResult = BodyScoped<{ skills: Skill[] }>
