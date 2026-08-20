import type { BodyScoped } from './shared'

export interface McpServer {
  name: string
  url: string
  description: string
  registered_at: string
}

/**
 * The commonly-populated subset of a much larger internal approval record —
 * `mcp_approvals.py` carries additional retry/outbox-delivery bookkeeping
 * that isn't relevant to a UI consumer. See docs/VISION_API_CONTRACT.md's
 * MCP section. Read-only: there is no approve/deny route today.
 */
export interface McpApproval {
  id: string
  status: 'pending' | 'denied' | string
  agent_id: string
  domain: string
  server: string
  tool: string
  params: Record<string, unknown>
  reason: string
  user_id: string
  result: unknown | null
  error: string | null
  created_at: string
  resolved_at: string | null
  granting_skills: { skill_id: string; fingerprint: string }[]
  granting_skills_requested: boolean
}

export type McpResult = BodyScoped<{ servers: McpServer[]; pending_approvals: McpApproval[] }>
