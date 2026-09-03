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
 * MCP section. `POST /mcp/approvals/{id}/approve|deny` resolve one of
 * these — see `McpApprovalActionResult` below.
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

/** Batch B telemetry (`MCPManager.get_activity()`) — real per-server call
 * outcomes only, never a push-based health check (this backend has none).
 * In-memory, resets on restart. */
export interface McpActivity {
  last_success_at: string | null
  last_failure_at: string | null
  success_count: number
  failure_count: number
}

export type McpResult = BodyScoped<{
  servers: McpServer[]
  pending_approvals: McpApproval[]
  /** Keyed by server name — a server with no recorded activity yet is
   * simply absent, never a fabricated zeroed entry. */
  activity: Record<string, McpActivity>
}>

/** `POST /mcp/approvals/{id}/approve|deny`'s own real result — the resolved
 * approval record verbatim (owner-gated; approve actually dispatches the
 * call, deny only discards it). */
export interface McpApprovalActionResult {
  approval: McpApproval
}
