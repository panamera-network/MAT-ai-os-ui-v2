import { useEffect, useState } from 'react'
import { CAPABILITIES, TIERS, type Health, type KnowledgeItem, type KnowledgeWorkflowStatus, type SkillVersion } from '../domain/vision'
import type { useAgents } from '../hooks/useAgents'
import type { useLoops } from '../hooks/useLoops'
import type { useModels } from '../hooks/useModels'
import type { useGovernance } from '../hooks/useGovernance'
import type { useMcp } from '../hooks/useMcp'
import type { useSkills } from '../hooks/useSkills'
import type { useKnowledgeNotes } from '../hooks/useKnowledgeNotes'
import type { useBudget } from '../hooks/useBudget'
import { countKnowledgeByWorkflowStatus } from './HudLeftPanel'
import { useVisionApi } from '../app/VisionApiProvider'
import { VisionApiError } from '../adapters/vision'
import type { DetailCardId } from './detailCardId'
import './CardDetailOverlay.css'

interface CardDetailOverlayProps {
  cardId: DetailCardId
  agents: ReturnType<typeof useAgents>
  loops: ReturnType<typeof useLoops>
  models: ReturnType<typeof useModels>
  governance: ReturnType<typeof useGovernance>
  mcp: ReturnType<typeof useMcp>
  skills: ReturnType<typeof useSkills>
  knowledgeNotes: ReturnType<typeof useKnowledgeNotes>
  budget: ReturnType<typeof useBudget>
  health: Health | null
  onClose: () => void
}

const TITLES: Record<DetailCardId, string> = {
  agents: 'Agents',
  loops: 'Loops',
  models: 'Models',
  governance: 'Read Laws',
  mcp: 'MCP',
  skills: 'Skill Library',
  knowledge: 'Knowledge Notes',
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 16 16" width="13" height="13" fill="none" aria-hidden="true">
      <path stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" d="M4 4l8 8M12 4l-8 8" />
    </svg>
  )
}

function EmptyRow({ children }: { children: string }) {
  return <p className="card-detail-overlay__empty">{children}</p>
}

/** Most-recently-updated/created match only — a compact row shows one
 * current situation per agent, never a sub-list. `GovernanceCase.updated_at`
 * / `McpApproval.created_at` are both ISO strings, so string comparison
 * sorts correctly the same way `sortKnowledgeNotes` already relies on. */
function mostRecent<T>(items: T[], at: (item: T) => string): T | null {
  if (items.length === 0) return null
  return items.reduce((a, b) => (at(a) > at(b) ? a : b))
}

/** Surfacing priority: an agent with a real unresolved/failed governance
 * case first, then a currently-active one, then everything else — real
 * telemetry (`active_agent_ids` membership, `unresolved_cases`), never a
 * guessed health signal. */
function agentPriority(hasUnresolvedCase: boolean, isActive: boolean): number {
  if (hasUnresolvedCase) return 0
  if (isActive) return 1
  return 2
}

function AgentsDetail({ agents, mcp }: { agents: ReturnType<typeof useAgents>; mcp: ReturnType<typeof useMcp> }) {
  const list = agents.data?.agents ?? []
  const activeIds = new Set(agents.data?.active_agent_ids ?? [])
  const unresolved = agents.data?.unresolved_cases ?? []
  // `Agent` itself carries no status/task/activity field at all (confirmed
  // against `base_agent.py::to_dict()` — the real API never returns one) —
  // these are the only two OTHER already-fetched, real per-agent signals
  // that exist anywhere: a still-open governance case, and an in-flight MCP
  // tool-access request. Neither is fabricated; both are simply cross-
  // referenced by `agent_id`/`entity_id` here rather than re-fetched.
  const pendingApprovals = (mcp.data?.pending_approvals ?? []).filter((approval) => approval.status === 'pending')

  const rows = list
    .map((agent) => {
      const latestCase = mostRecent(
        unresolved.filter((c) => c.entity_id === agent.agent_id),
        (c) => c.updated_at,
      )
      const latestApproval = mostRecent(
        pendingApprovals.filter((approval) => approval.agent_id === agent.agent_id),
        (approval) => approval.created_at,
      )
      const isActive = activeIds.has(agent.agent_id)
      const lastActivity = mostRecent(
        [latestCase?.updated_at, latestApproval?.created_at].filter((value): value is string => Boolean(value)),
        (value) => value,
      )
      return { agent, latestCase, latestApproval, isActive, lastActivity, priority: agentPriority(Boolean(latestCase), isActive) }
    })
    .sort((a, b) => a.priority - b.priority)

  return (
    <>
      {unresolved.length > 0 && (
        <>
          <h3 className="card-detail-overlay__section-title">Unresolved cases</h3>
          <div className="card-detail-overlay__list">
            {unresolved.map((c) => (
              <div key={c.case_id} className="card-detail-overlay__row">
                <span className="card-detail-overlay__row-primary">{c.entity_id}</span>
                <span className="card-detail-overlay__badge card-detail-overlay__badge--warning">{c.state}</span>
                <span className="card-detail-overlay__row-meta">{c.issue}</span>
                <span className="card-detail-overlay__row-meta">via {c.source_module}</span>
              </div>
            ))}
          </div>
        </>
      )}
      <h3 className="card-detail-overlay__section-title">Agents</h3>
      {rows.length === 0 ? (
        <EmptyRow>No active agents. MAT will spawn agents when a task requires delegation.</EmptyRow>
      ) : (
        <div className="card-detail-overlay__list">
          {rows.map(({ agent, latestCase, latestApproval, isActive, lastActivity }) => (
            <div key={agent.agent_id} className="card-detail-overlay__row">
              <span className="card-detail-overlay__row-primary">{agent.name}</span>
              <span className={`card-detail-overlay__badge card-detail-overlay__badge--${latestCase ? 'warning' : isActive ? 'ok' : 'muted'}`}>
                {latestCase ? latestCase.state : isActive ? 'active' : 'idle'}
              </span>
              <span className="card-detail-overlay__row-tag">{agent.domain}</span>
              <span className="card-detail-overlay__row-meta">{agent.is_global ? 'Global' : 'Personal'}</span>
              <span className="card-detail-overlay__row-meta">{agent.skill_ids.length} skill{agent.skill_ids.length === 1 ? '' : 's'}</span>
              {latestApproval && (
                <span className="card-detail-overlay__row-meta">{latestApproval.tool} via {latestApproval.server}</span>
              )}
              {lastActivity && <span className="card-detail-overlay__row-meta">{formatWhen(lastActivity)}</span>}
            </div>
          ))}
        </div>
      )}
    </>
  )
}

function formatWhen(iso: string | null): string {
  if (!iso) return 'never'
  const parsed = new Date(iso)
  if (Number.isNaN(parsed.getTime())) return iso
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }).format(parsed)
}

function LoopsDetail({ loops }: { loops: ReturnType<typeof useLoops> }) {
  const list = loops.data?.loops ?? []
  const today = loops.data?.today
  return (
    <>
      {today && (
        <div className="card-detail-overlay__row card-detail-overlay__row--highlight">
          <span className="card-detail-overlay__row-primary">Today</span>
          <span className="card-detail-overlay__row-meta">· {today.completed} completed</span>
          <span className="card-detail-overlay__row-meta">· {today.failed} failed</span>
        </div>
      )}
      {list.length === 0 ? <EmptyRow>No loops configured.</EmptyRow> : <LoopsListBody list={list} />}
    </>
  )
}

/** `trigger === 'interval'`: `schedule` is a raw seconds count straight from
 * `LoopsEngine` (`IntervalTrigger(seconds=float(schedule))` — confirmed in
 * loops.py), never pre-formatted server-side, so this is the one place that
 * turns it into "Every Nh/Nm/Ns" — the raw value itself is never altered,
 * only ever read (see the row's own `title` attribute below, which still
 * shows it verbatim on hover). `cron`/`event` schedules are shown verbatim
 * too — decoding a cron expression into English risks silently
 * misrepresenting the real schedule, which this phase's own "do not invent"
 * rule out; a cron string is already a real, precise schedule as-is. */
function formatSchedule(trigger: string, schedule: string): string {
  if (trigger === 'interval') {
    const seconds = Number(schedule)
    if (Number.isFinite(seconds) && seconds > 0) {
      if (seconds % 3600 === 0) return `Every ${seconds / 3600}h`
      if (seconds % 60 === 0) return `Every ${seconds / 60}m`
      return `Every ${seconds}s`
    }
    return `Every ${schedule}`
  }
  if (trigger === 'cron') return `Cron: ${schedule}`
  return `On: ${schedule}`
}

/** "Attention first" using only what's real: `LoopsEngine`'s own two status
 * values are "active"/"paused" (confirmed in loops.py) — there is no
 * per-loop failed/health field anywhere in the real `Loop` shape, and
 * `today.failed` is a global daily count with no per-loop attribution. A
 * paused loop needing a human to re-enable it is the one genuine
 * "needs attention" signal this data actually carries. */
function loopPriority(status: string): number {
  return status === 'paused' ? 0 : 1
}

function LoopsListBody({ list }: { list: NonNullable<ReturnType<typeof useLoops>['data']>['loops'] }) {
  const sorted = [...list].sort((a, b) => loopPriority(a.status) - loopPriority(b.status))
  return (
    <div className="card-detail-overlay__list">
      {sorted.map((loop) => (
        <div key={loop.id} className="card-detail-overlay__row">
          <span className="card-detail-overlay__row-primary">{loop.name}</span>
          <span className={`card-detail-overlay__badge card-detail-overlay__badge--${loop.status === 'active' ? 'ok' : 'muted'}`}>{loop.status}</span>
          <span className="card-detail-overlay__row-meta" title={loop.schedule}>{formatSchedule(loop.trigger, loop.schedule)}</span>
          <span className="card-detail-overlay__row-meta">Last run: {loop.last_run ? formatWhen(loop.last_run) : 'Never'}</span>
          <span className="card-detail-overlay__row-meta">Runs: {loop.run_count}</span>
        </div>
      ))}
    </div>
  )
}

function ModelsDetail({ models, budget, health }: { models: ReturnType<typeof useModels>; budget: ReturnType<typeof useBudget>; health: Health | null }) {
  const profiles = models.data?.profiles
  const configuredCapabilities = profiles ? CAPABILITIES.filter((capability) => TIERS.some((tier) => Boolean(profiles[capability]?.[tier]))) : []
  const usage = budget.data ? Object.entries(budget.data.model_usage).sort(([, a], [, b]) => b - a) : []
  const fallbacks = budget.data ? Object.entries(budget.data.fallback_counts).filter(([, count]) => count > 0) : []

  return (
    <div className="card-detail-overlay__list">
      {health && (
        <div className="card-detail-overlay__row card-detail-overlay__row--highlight">
          <span className="card-detail-overlay__row-primary">{health.active_model.model}</span>
          <span className="card-detail-overlay__row-tag">{health.active_model.provider}</span>
          <span className="card-detail-overlay__row-meta">Active now</span>
        </div>
      )}
      {budget.data && (
        <div className="card-detail-overlay__row">
          <span className="card-detail-overlay__row-primary">Budget</span>
          <span className="card-detail-overlay__row-meta">Used ${budget.data.used_usd.toFixed(4)}</span>
          <span className="card-detail-overlay__row-meta">· Available ${budget.data.available_usd.toFixed(4)}</span>
          <span className="card-detail-overlay__row-meta">· Limit ${budget.data.limit_usd.toFixed(4)}</span>
        </div>
      )}
      {usage.length > 0 && (
        <>
          <h3 className="card-detail-overlay__section-title">Usage by model</h3>
          {usage.map(([key, count]) => (
            <div key={key} className="card-detail-overlay__row">
              <span className="card-detail-overlay__row-primary">{key}</span>
              <span className="card-detail-overlay__row-meta">{count} call{count === 1 ? '' : 's'} today</span>
            </div>
          ))}
        </>
      )}
      {fallbacks.length > 0 && (
        <>
          <h3 className="card-detail-overlay__section-title">Fallbacks by capability</h3>
          {fallbacks.map(([capability, count]) => (
            <div key={capability} className="card-detail-overlay__row">
              <span className="card-detail-overlay__row-tag">{capability}</span>
              <span className="card-detail-overlay__row-meta">{count} fallback{count === 1 ? '' : 's'}</span>
            </div>
          ))}
        </>
      )}
      {configuredCapabilities.length > 0 && (
        <>
          <h3 className="card-detail-overlay__section-title">Registry</h3>
          {configuredCapabilities.map((capability) => (
            <div key={capability} className="card-detail-overlay__capability">
              <span className="card-detail-overlay__row-tag">{capability}</span>
              <div className="card-detail-overlay__tiers">
                {TIERS.filter((tier) => Boolean(profiles?.[capability]?.[tier])).map((tier) => {
                  const slot = profiles?.[capability]?.[tier]
                  const isActive = health && slot && slot.provider === health.active_model.provider && slot.model === health.active_model.model
                  // PRIMARY stays the strongest-weight entry; every FB
                  // tier (local/cloud/api) is visually secondary/muted —
                  // the currently active model still gets `.is-active`
                  // regardless of which tier it's sitting in.
                  const isFallback = tier !== 'primary'
                  return (
                    <span
                      key={tier}
                      className={`card-detail-overlay__slot${isFallback ? ' card-detail-overlay__slot--fallback' : ''}${isActive ? ' is-active' : ''}`}
                    >
                      <span className="card-detail-overlay__slot-tier">{tier.replace('fallback_', 'fb ')}</span>
                      <span className="card-detail-overlay__slot-model">{slot?.provider}/{slot?.model}</span>
                    </span>
                  )
                })}
              </div>
            </div>
          ))}
        </>
      )}
      {!profiles && usage.length === 0 && !budget.data && <EmptyRow>Model data unavailable.</EmptyRow>}
    </div>
  )
}

function GovernanceDetail({ governance }: { governance: ReturnType<typeof useGovernance> }) {
  const laws = governance.data?.laws.active_laws ?? []
  const blocked = governance.data?.blocked_today ?? []
  const warnings = governance.data?.warnings_today ?? []
  const rulesTriggeredToday = governance.data?.rules_triggered_today
  const learning = governance.data?.learning_stats
  return (
    <>
      {typeof rulesTriggeredToday === 'number' && (
        <div className="card-detail-overlay__row card-detail-overlay__row--highlight">
          <span className="card-detail-overlay__row-primary">Rules triggered today</span>
          <span className="card-detail-overlay__row-meta">{rulesTriggeredToday}</span>
        </div>
      )}
      {(blocked.length > 0 || warnings.length > 0) && (
        <>
          <h3 className="card-detail-overlay__section-title">Blocked today · {blocked.length}</h3>
          {blocked.length === 0 ? (
            <EmptyRow>Nothing blocked today.</EmptyRow>
          ) : (
            <div className="card-detail-overlay__list">
              {blocked.map((event, index) => (
                <div key={`${event.stage}-${event.at}-${index}`} className="card-detail-overlay__row">
                  <span className="card-detail-overlay__row-tag">{event.stage}</span>
                  <span className={`card-detail-overlay__badge card-detail-overlay__badge--${event.source === 'system' ? 'muted' : 'danger'}`}>{event.source}</span>
                  <span className="card-detail-overlay__row-meta">{String(event.reason)}</span>
                </div>
              ))}
            </div>
          )}
          <h3 className="card-detail-overlay__section-title">Warnings today · {warnings.length}</h3>
          {warnings.length === 0 ? (
            <EmptyRow>No warnings today.</EmptyRow>
          ) : (
            <div className="card-detail-overlay__list">
              {warnings.map((event, index) => (
                <div key={`${event.stage}-${event.at}-${index}`} className="card-detail-overlay__row">
                  <span className="card-detail-overlay__row-tag">{event.stage}</span>
                  <span className={`card-detail-overlay__badge card-detail-overlay__badge--${event.source === 'system' ? 'muted' : 'warning'}`}>{event.source}</span>
                  <span className="card-detail-overlay__row-meta">{String(event.reason)}</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
      {learning && (
        <div className="card-detail-overlay__row card-detail-overlay__row--highlight">
          <span className="card-detail-overlay__row-primary">Learning</span>
          <span className="card-detail-overlay__row-meta">{learning.total_reviewed ?? 0} reviewed</span>
          <span className="card-detail-overlay__row-meta">· {learning.total_rejected ?? 0} rejected</span>
          <span className="card-detail-overlay__row-meta">· {learning.total_discarded ?? 0} discarded</span>
        </div>
      )}
      <h3 className="card-detail-overlay__section-title">Read Laws</h3>
      {laws.length === 0 ? (
        <EmptyRow>No active laws.</EmptyRow>
      ) : (
        <div className="card-detail-overlay__list">
          {laws.map((law) => (
            <div key={law.id} className="card-detail-overlay__row">
              <span className="card-detail-overlay__row-primary">{law.action}</span>
              <span className={`card-detail-overlay__badge card-detail-overlay__badge--${law.rule === 'allow' ? 'ok' : law.rule === 'deny' ? 'danger' : 'warning'}`}>
                {law.rule}
              </span>
              <span className="card-detail-overlay__row-meta">{law.id}</span>
            </div>
          ))}
        </div>
      )}
    </>
  )
}

/** "Attention first" using only what's real: `MCPManager.get_activity()` is
 * "real per-server call outcomes only, never a push-based health check
 * (this backend has none)" (see `McpActivity`'s own doc comment) — there is
 * no real connected/offline flag to sort on. A server that has actually
 * failed a real call, or has a real pending approval waiting on it, is the
 * genuine "needs a human" signal this data carries; a server with zero
 * calls yet is neither healthy nor unhealthy, just unproven, so it sorts
 * with the healthy group rather than the attention one. */
function mcpServerPriority(hasFailure: boolean, hasPending: boolean): number {
  return hasFailure || hasPending ? 0 : 1
}

function McpDetail({ mcp }: { mcp: ReturnType<typeof useMcp> }) {
  const servers = mcp.data?.servers ?? []
  const pending = mcp.data?.pending_approvals ?? []
  const activity = mcp.data?.activity ?? {}

  const serverRows = servers
    .map((server) => {
      const stats = activity[server.name]
      const pendingForServer = pending.filter((approval) => approval.server === server.name).length
      const lastActivity = stats
        ? mostRecent([stats.last_success_at, stats.last_failure_at].filter((v): v is string => Boolean(v)), (v) => v)
        : null
      const hasFailure = Boolean(stats && stats.failure_count > 0)
      return { server, stats, pendingForServer, lastActivity, priority: mcpServerPriority(hasFailure, pendingForServer > 0) }
    })
    .sort((a, b) => a.priority - b.priority)

  return (
    <>
      <h3 className="card-detail-overlay__section-title">Servers</h3>
      {serverRows.length === 0 ? (
        <EmptyRow>No MCP servers registered. Connect an MCP server to give MAT access to external tools and services.</EmptyRow>
      ) : (
        <div className="card-detail-overlay__list">
          {serverRows.map(({ server, stats, pendingForServer, lastActivity }) => (
            <div key={server.name} className="card-detail-overlay__row">
              <span className="card-detail-overlay__row-primary">{server.name}</span>
              {stats ? (
                <>
                  {stats.success_count > 0 && <span className="card-detail-overlay__badge card-detail-overlay__badge--ok">{stats.success_count} ok</span>}
                  {stats.failure_count > 0 && <span className="card-detail-overlay__badge card-detail-overlay__badge--danger">{stats.failure_count} failed</span>}
                </>
              ) : (
                <span className="card-detail-overlay__badge card-detail-overlay__badge--muted">no activity yet</span>
              )}
              {pendingForServer > 0 && (
                <span className="card-detail-overlay__badge card-detail-overlay__badge--warning">{pendingForServer} pending</span>
              )}
              <span className="card-detail-overlay__row-meta">{server.url}</span>
              {server.description && <span className="card-detail-overlay__row-meta">{server.description}</span>}
              {lastActivity && <span className="card-detail-overlay__row-meta">Last activity: {formatWhen(lastActivity)}</span>}
            </div>
          ))}
        </div>
      )}
      <h3 className="card-detail-overlay__section-title">Pending approvals</h3>
      {pending.length === 0 ? (
        <EmptyRow>No pending approvals.</EmptyRow>
      ) : (
        <div className="card-detail-overlay__list">
          {pending.map((approval) => (
            <div key={approval.id} className="card-detail-overlay__row">
              <span className="card-detail-overlay__row-primary">{approval.server} · {approval.tool}</span>
              <span className="card-detail-overlay__row-meta">{approval.reason}</span>
              <span className="card-detail-overlay__row-meta">agent: {approval.agent_id}</span>
            </div>
          ))}
        </div>
      )}
    </>
  )
}

/** One skill row in the Skill Library — click to fetch and reveal its real
 * upgrade history via `GET /skills/{skill_id}/versions`, on demand (never
 * polled, never fetched for every skill up front). */
function SkillRow({ skillId, name, autoGenerated }: { skillId: string; name: string; autoGenerated?: boolean }) {
  const api = useVisionApi()
  const [expanded, setExpanded] = useState(false)
  const [versions, setVersions] = useState<SkillVersion[] | null>(null)
  const [loadError, setLoadError] = useState(false)

  const toggle = () => {
    const next = !expanded
    setExpanded(next)
    if (next && versions === null) {
      api
        .getSkillVersions(skillId)
        .then((result) => setVersions(result.versions))
        .catch((err: unknown) => {
          setLoadError(true)
          if (!(err instanceof VisionApiError)) throw err
        })
    }
  }

  return (
    <div className="card-detail-overlay__group">
      <div
        className="card-detail-overlay__row card-detail-overlay__row--clickable"
        role="button"
        tabIndex={0}
        onClick={toggle}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            toggle()
          }
        }}
      >
        <span className="card-detail-overlay__row-primary">{name}</span>
        {autoGenerated && <span className="card-detail-overlay__badge card-detail-overlay__badge--muted">learned</span>}
        <span className="card-detail-overlay__row-meta">{expanded ? 'hide history ▲' : 'version history ▼'}</span>
      </div>
      {expanded && (
        loadError ? (
          <EmptyRow>Could not load version history.</EmptyRow>
        ) : versions === null ? (
          <EmptyRow>Loading…</EmptyRow>
        ) : versions.length === 0 ? (
          <EmptyRow>No versions on record.</EmptyRow>
        ) : (
          <div className="card-detail-overlay__list">
            {versions.map((version) => (
              <div key={version.version_id} className="card-detail-overlay__row">
                <span className="card-detail-overlay__row-meta">{formatWhen(version.created_at)}</span>
                <span className="card-detail-overlay__row-meta">{version.reason || 'no reason given'}</span>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  )
}

function SkillsDetail({ skills }: { skills: ReturnType<typeof useSkills> }) {
  const list = skills.data?.skills ?? []
  const recentUpgrades = skills.data?.recent_upgrades ?? []
  const byDomain = new Map<string, typeof list>()
  for (const skill of list) {
    const group = byDomain.get(skill.domain) ?? []
    group.push(skill)
    byDomain.set(skill.domain, group)
  }
  const domains = [...byDomain.keys()].sort((a, b) => a.localeCompare(b))
  return (
    <>
      {recentUpgrades.length > 0 && (
        <>
          <h3 className="card-detail-overlay__section-title">Recent upgrades</h3>
          <div className="card-detail-overlay__list">
            {recentUpgrades.map((version) => (
              <div key={version.version_id} className="card-detail-overlay__row">
                <span className="card-detail-overlay__row-primary">{version.skill_id}</span>
                <span className="card-detail-overlay__row-meta">{formatWhen(version.created_at)}</span>
                <span className="card-detail-overlay__row-meta">{version.reason || 'no reason given'}</span>
              </div>
            ))}
          </div>
        </>
      )}
      <h3 className="card-detail-overlay__section-title">Skill Library</h3>
      {list.length === 0 ? (
        <EmptyRow>No skills learned yet.</EmptyRow>
      ) : (
        <div className="card-detail-overlay__list">
          {domains.map((domain) => (
            <div key={domain} className="card-detail-overlay__group">
              <h3 className="card-detail-overlay__section-title">{domain} <span className="card-detail-overlay__row-meta">({byDomain.get(domain)?.length})</span></h3>
              {byDomain.get(domain)?.map((skill) => (
                <SkillRow key={skill.id} skillId={skill.id} name={skill.name} autoGenerated={skill.auto_generated} />
              ))}
            </div>
          ))}
        </div>
      )}
    </>
  )
}

/** Exported for reuse by `ActivityPanel`'s Learn Receipt rendering (chat) and
 * `HomeScreen`'s Recent Events synthesis — same five user-facing states, one
 * shared label/tone mapping so the two surfaces can never drift apart. */
export const WORKFLOW_STATUS_LABEL: Record<KnowledgeWorkflowStatus, string> = {
  new: 'New',
  reviewed: 'Reviewed',
  practicing: 'Practicing',
  validated: 'Validated',
  ready_for_promotion: 'Ready for Promotion',
  promoted: 'Promoted',
  rejected: 'Rejected',
  needs_relearn: 'Needs Relearn',
}

export function workflowBadgeTone(status: KnowledgeWorkflowStatus): 'ok' | 'warning' | 'danger' | 'muted' {
  if (status === 'ready_for_promotion' || status === 'promoted') return 'ok'
  if (status === 'needs_relearn') return 'danger'
  if (status === 'practicing') return 'warning'
  return 'muted'
}

/** Priority order for the Practice/Sparring -> Validate phase's five
 * user-facing states — most-actionable first (something needing a human
 * decision), so a long list doesn't bury a `ready_for_promotion`/
 * `needs_relearn` note under a page of already-`promoted` ones. `new`/
 * `validated`/`rejected` are filtered out entirely — see
 * `countKnowledgeByWorkflowStatus`'s own doc comment for why. */
const KNOWLEDGE_STATUS_PRIORITY: Partial<Record<KnowledgeWorkflowStatus, number>> = {
  ready_for_promotion: 0,
  needs_relearn: 1,
  practicing: 2,
  reviewed: 3,
  promoted: 4,
}

/** A note's `source` field is genuinely one of two different things
 * depending on what `/learn` was given — a real URL/repo link that was
 * fetched, or the raw pasted text itself (already fully shown as this
 * note's own `statement`/"Extracted knowledge" a row above) — see
 * `V2Body.propose_learning`'s own `extract_source_and_instruction`/
 * `fetch_content`. Labeling both cases "Source" reads as if they're the
 * same kind of thing; they aren't, and must never be presented as one
 * merged field with "Extracted knowledge" either — this only ever decides
 * the LABEL and a concise DISPLAY string for the source row, never touches
 * the statement row next to it. */
function classifySource(source: string): { label: string; display: string } {
  const trimmed = source.trim()
  if (/^https?:\/\//i.test(trimmed)) {
    // "Ringkas": the scheme adds nothing a reader needs — domain + path is
    // the concise, recognizable form (e.g. "github.com/OpenHands/sdk").
    return { label: 'Origin', display: trimmed.replace(/^https?:\/\//i, '').replace(/\/$/, '') }
  }
  return { label: 'Source Context', display: source }
}

/** Long enough that a real Verifier/Sparring failure reason (these run to a
 * full sentence or more, e.g. a dispatch error) reads as a wall of text
 * inside a single row — collapsed to this many characters by default, with
 * a click to reveal the rest. Short reasons never show a toggle at all. */
const WHY_TRUNCATE_LENGTH = 120

function sortKnowledgeNotes(notes: KnowledgeItem[]): KnowledgeItem[] {
  return notes
    .filter((note) => note.workflow_status in KNOWLEDGE_STATUS_PRIORITY)
    .sort((a, b) => {
      const byPriority = (KNOWLEDGE_STATUS_PRIORITY[a.workflow_status] ?? 99) - (KNOWLEDGE_STATUS_PRIORITY[b.workflow_status] ?? 99)
      return byPriority !== 0 ? byPriority : b.updated_at.localeCompare(a.updated_at)
    })
}

/** One Knowledge Note — collapsed shows just enough to recognize/triage it
 * (topic, workflow_status badge, domain), matching `SkillRow`'s own
 * collapsed shape. Expanding fetches a FRESH `GET /knowledge/{id}` (rather
 * than trusting the list snapshot's own poll cadence — important right
 * after a promote action, or if an overnight practice sweep touched it) and
 * reveals source/statement/practice history/validation/promoted skill. A
 * `ready_for_promotion` note additionally shows the one write action this
 * whole gate has: `POST /knowledge/{id}/promote`, human-triggered, exactly
 * like `PendingLearnRow`'s own Approve/Reject buttons elsewhere in this HUD. */
function KnowledgeNoteRow({ note, onChanged }: { note: KnowledgeItem; onChanged: () => void }) {
  const api = useVisionApi()
  const [expanded, setExpanded] = useState(false)
  const [detail, setDetail] = useState<KnowledgeItem>(note)
  const [detailLoading, setDetailLoading] = useState(false)
  const [promoteBusy, setPromoteBusy] = useState(false)
  const [promoteResult, setPromoteResult] = useState<{ status: string; reason: string } | null>(null)
  const [whyExpanded, setWhyExpanded] = useState(false)

  const toggle = () => {
    const next = !expanded
    setExpanded(next)
    if (next) {
      setDetailLoading(true)
      api
        .getKnowledgeItem(note.id)
        .then((result) => {
          if (result.knowledge) setDetail(result.knowledge)
        })
        .catch((err: unknown) => {
          // A failed detail fetch just means the row keeps showing whatever
          // it already had (the list snapshot, or a prior successful fetch)
          // — the collapsed summary is still real either way.
          if (!(err instanceof VisionApiError)) throw err
        })
        .finally(() => setDetailLoading(false))
    }
  }

  const handlePromote = () => {
    setPromoteBusy(true)
    setPromoteResult(null)
    api
      .promoteKnowledge(detail.id)
      .then((result) => {
        setPromoteResult({ status: result.status, reason: result.reason })
        return api.getKnowledgeItem(detail.id)
      })
      .then((result) => {
        if (result.knowledge) setDetail(result.knowledge)
      })
      .catch((err: unknown) => {
        setPromoteResult({ status: 'failed', reason: err instanceof VisionApiError ? err.detail : 'Something went wrong.' })
      })
      .finally(() => {
        setPromoteBusy(false)
        onChanged()
      })
  }

  const latestVersion = detail.versions.length > 0 ? detail.versions[detail.versions.length - 1] : null
  const sourceInfo = latestVersion ? classifySource(latestVersion.source) : null
  const passCount = detail.practice_history.filter((attempt) => attempt.result === 'pass').length
  const whyReason = detail.workflow_status === 'needs_relearn' ? detail.workflow_reason : null
  const whyIsLong = Boolean(whyReason && whyReason.length > WHY_TRUNCATE_LENGTH)

  return (
    <div className="card-detail-overlay__group">
      <div
        className="card-detail-overlay__row card-detail-overlay__row--clickable"
        role="button"
        tabIndex={0}
        onClick={toggle}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            toggle()
          }
        }}
      >
        <span className="card-detail-overlay__row-primary">{note.topic}</span>
        <span className={`card-detail-overlay__badge card-detail-overlay__badge--${workflowBadgeTone(note.workflow_status)}`}>
          {WORKFLOW_STATUS_LABEL[note.workflow_status]}
        </span>
        {note.domain && <span className="card-detail-overlay__row-tag">{note.domain}</span>}
        <span className="card-detail-overlay__row-meta">{expanded ? 'hide detail ▲' : 'detail ▼'}</span>
      </div>
      {expanded && (
        <div className="card-detail-overlay__list">
          {detailLoading && detail === note && <EmptyRow>Loading…</EmptyRow>}
          {latestVersion && (
            <div className="card-detail-overlay__row">
              <span className="card-detail-overlay__row-primary">Extracted knowledge</span>
              <span className="card-detail-overlay__row-meta">{latestVersion.statement}</span>
            </div>
          )}
          {sourceInfo && (
            <div className="card-detail-overlay__row">
              <span className="card-detail-overlay__row-primary">{sourceInfo.label}</span>
              <span className="card-detail-overlay__row-meta">{sourceInfo.display}</span>
            </div>
          )}
          {whyReason && whyIsLong && (
            <div
              className="card-detail-overlay__row card-detail-overlay__row--clickable"
              role="button"
              tabIndex={0}
              onClick={() => setWhyExpanded((prev) => !prev)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  setWhyExpanded((prev) => !prev)
                }
              }}
            >
              <span className="card-detail-overlay__row-primary">Why</span>
              <span className="card-detail-overlay__badge card-detail-overlay__badge--danger">Failed</span>
              <span className="card-detail-overlay__row-meta">
                {whyExpanded ? whyReason : `${whyReason.slice(0, WHY_TRUNCATE_LENGTH)}…`}
              </span>
              <span className="card-detail-overlay__row-meta">{whyExpanded ? 'less ▲' : 'more ▼'}</span>
            </div>
          )}
          {whyReason && !whyIsLong && (
            <div className="card-detail-overlay__row">
              <span className="card-detail-overlay__row-primary">Why</span>
              <span className="card-detail-overlay__badge card-detail-overlay__badge--danger">Failed</span>
              <span className="card-detail-overlay__row-meta">{whyReason}</span>
            </div>
          )}
          {(detail.workflow_status === 'practicing' || detail.practice_history.length > 0) && (
            <div className="card-detail-overlay__row">
              <span className="card-detail-overlay__row-primary">Practice</span>
              <span className="card-detail-overlay__row-meta">
                {detail.practice_history.length} attempt{detail.practice_history.length === 1 ? '' : 's'}
              </span>
              <span className="card-detail-overlay__row-meta">{passCount} passed</span>
            </div>
          )}
          {detail.practice_history.map((attempt) => (
            <div key={attempt.attempt_id} className="card-detail-overlay__row">
              <span className="card-detail-overlay__row-tag">{attempt.engine}</span>
              <span
                className={`card-detail-overlay__badge card-detail-overlay__badge--${
                  attempt.result === 'pass' ? 'ok' : attempt.result === 'disputed' ? 'warning' : 'danger'
                }`}
              >
                {attempt.result}
              </span>
              <span className="card-detail-overlay__row-meta">{attempt.use_case_or_domain}</span>
              <span className="card-detail-overlay__row-meta">{formatWhen(attempt.timestamp)}</span>
            </div>
          ))}
          {detail.validation_result && (
            <div className="card-detail-overlay__row">
              <span className="card-detail-overlay__row-primary">Validation</span>
              <span className="card-detail-overlay__row-meta">{JSON.stringify(detail.validation_result)}</span>
            </div>
          )}
          {detail.promoted_skill_id && (
            <div className="card-detail-overlay__row card-detail-overlay__row--highlight">
              <span className="card-detail-overlay__row-primary">Promoted skill</span>
              <span className="card-detail-overlay__row-meta">{detail.promoted_skill_id}</span>
            </div>
          )}
          {detail.workflow_status === 'ready_for_promotion' &&
            (promoteResult ? (
              <span className={`card-detail-overlay__badge card-detail-overlay__badge--${promoteResult.status === 'promoted' ? 'ok' : 'danger'}`}>
                {promoteResult.status === 'promoted' ? 'Promoted.' : `${promoteResult.status} — ${promoteResult.reason}`}
              </span>
            ) : (
              <button type="button" className="card-detail-overlay__promote-button" disabled={promoteBusy} onClick={handlePromote}>
                {promoteBusy ? 'Promoting…' : 'Approve / Promote'}
              </button>
            ))}
        </div>
      )}
    </div>
  )
}

function KnowledgeNotesDetail({ knowledgeNotes }: { knowledgeNotes: ReturnType<typeof useKnowledgeNotes> }) {
  const list = knowledgeNotes.data?.knowledge ?? []
  const counts = countKnowledgeByWorkflowStatus(list)
  const sorted = sortKnowledgeNotes(list)

  return (
    <>
      <div className="card-detail-overlay__row card-detail-overlay__row--highlight">
        <span className="card-detail-overlay__row-primary">By status</span>
        <span className="card-detail-overlay__row-meta">{counts.reviewed} reviewed</span>
        <span className="card-detail-overlay__row-meta">{counts.practicing} practicing</span>
        <span className="card-detail-overlay__row-meta">{counts.readyForPromotion} ready for promotion</span>
        <span className="card-detail-overlay__row-meta">{counts.needsRelearn} needs relearn</span>
        <span className="card-detail-overlay__row-meta">{counts.promoted} promoted</span>
      </div>
      <h3 className="card-detail-overlay__section-title">Knowledge Notes</h3>
      {sorted.length === 0 ? (
        <EmptyRow>No knowledge notes yet.</EmptyRow>
      ) : (
        <div className="card-detail-overlay__list">
          {sorted.map((note) => (
            <KnowledgeNoteRow key={note.id} note={note} onChanged={knowledgeNotes.refetch} />
          ))}
        </div>
      )}
    </>
  )
}

/**
 * Batch A: lightweight frosted detail overlay for the left panel's cards —
 * rendered in `GlassHud`'s already-empty center cell (never a new page/
 * route, never covering the orb underneath). Reads the SAME resource
 * objects `HudLeftPanel` already fetched (passed down from `HomeScreen`),
 * never a second independent fetch. Only ever shows fields the real API
 * actually returns — no per-card action beyond what already exists
 * elsewhere (MCP's pending approvals are read-only here: there is no
 * approve/deny route for them today, unlike Learn suggestions).
 */
export function CardDetailOverlay({ cardId, agents, loops, models, governance, mcp, skills, knowledgeNotes, budget, health, onClose }: CardDetailOverlayProps) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  return (
    // Click-outside-to-close: this backdrop fills the whole detail zone
    // (transparent — the orb stays visible behind it, matching this HUD's
    // own "deliberately empty center" design, this is a click target only,
    // never a dimming layer). `onClick` fires for a click that lands here
    // directly; the panel below stops it from ever bubbling up from inside.
    <div className="card-detail-overlay-backdrop" onClick={onClose}>
      <div
        className="card-detail-overlay"
        role="dialog"
        aria-label={`${TITLES[cardId]} details`}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="card-detail-overlay__header">
          <span>{TITLES[cardId]}</span>
          <button type="button" className="card-detail-overlay__close" onClick={onClose} aria-label="Close">
            <CloseIcon />
          </button>
        </header>
        <div className="card-detail-overlay__body">
          {cardId === 'agents' && <AgentsDetail agents={agents} mcp={mcp} />}
          {cardId === 'loops' && <LoopsDetail loops={loops} />}
          {cardId === 'models' && <ModelsDetail models={models} budget={budget} health={health} />}
          {cardId === 'governance' && <GovernanceDetail governance={governance} />}
          {cardId === 'mcp' && <McpDetail mcp={mcp} />}
          {cardId === 'skills' && <SkillsDetail skills={skills} />}
          {cardId === 'knowledge' && <KnowledgeNotesDetail knowledgeNotes={knowledgeNotes} />}
        </div>
      </div>
    </div>
  )
}
