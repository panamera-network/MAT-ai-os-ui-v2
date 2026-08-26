import { useEffect, useState } from 'react'
import { CAPABILITIES, TIERS, type Health, type SkillVersion } from '../domain/vision'
import type { useAgents } from '../hooks/useAgents'
import type { useLoops } from '../hooks/useLoops'
import type { useModels } from '../hooks/useModels'
import type { useGovernance } from '../hooks/useGovernance'
import type { useMcp } from '../hooks/useMcp'
import type { useSkills } from '../hooks/useSkills'
import type { useBudget } from '../hooks/useBudget'
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

function AgentsDetail({ agents }: { agents: ReturnType<typeof useAgents> }) {
  const list = agents.data?.agents ?? []
  const activeIds = new Set(agents.data?.active_agent_ids ?? [])
  const unresolved = agents.data?.unresolved_cases ?? []
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
      {list.length === 0 ? (
        <EmptyRow>No agents yet.</EmptyRow>
      ) : (
        <div className="card-detail-overlay__list">
          {list.map((agent) => (
            <div key={agent.agent_id} className="card-detail-overlay__row">
              <span className="card-detail-overlay__row-primary">{agent.name}</span>
              {activeIds.has(agent.agent_id) && <span className="card-detail-overlay__badge card-detail-overlay__badge--ok">active</span>}
              <span className="card-detail-overlay__row-tag">{agent.domain}</span>
              <span className="card-detail-overlay__row-meta">{agent.is_global ? 'Global' : 'Personal'}</span>
              <span className="card-detail-overlay__row-meta">{agent.skill_ids.length} skill{agent.skill_ids.length === 1 ? '' : 's'}</span>
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
          <span className="card-detail-overlay__row-meta">{today.completed} completed</span>
          <span className="card-detail-overlay__row-meta">{today.failed} failed</span>
        </div>
      )}
      {list.length === 0 ? <EmptyRow>No loops configured.</EmptyRow> : <LoopsListBody list={list} />}
    </>
  )
}

function LoopsListBody({ list }: { list: NonNullable<ReturnType<typeof useLoops>['data']>['loops'] }) {
  return (
    <div className="card-detail-overlay__list">
      {list.map((loop) => (
        <div key={loop.id} className="card-detail-overlay__row">
          <span className="card-detail-overlay__row-primary">{loop.name}</span>
          <span className={`card-detail-overlay__badge card-detail-overlay__badge--${loop.status === 'active' ? 'ok' : 'muted'}`}>{loop.status}</span>
          <span className="card-detail-overlay__row-meta">{loop.trigger} · {loop.schedule}</span>
          <span className="card-detail-overlay__row-meta">last: {formatWhen(loop.last_run)}</span>
          <span className="card-detail-overlay__row-meta">{loop.run_count} run{loop.run_count === 1 ? '' : 's'}</span>
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
          <span className="card-detail-overlay__row-primary">Active now</span>
          <span className="card-detail-overlay__row-meta">{health.active_model.provider}/{health.active_model.model}</span>
        </div>
      )}
      {budget.data && (
        <div className="card-detail-overlay__row">
          <span className="card-detail-overlay__row-primary">Budget</span>
          <span className="card-detail-overlay__row-meta">${budget.data.used_usd.toFixed(4)} used</span>
          <span className="card-detail-overlay__row-meta">${budget.data.available_usd.toFixed(4)} available</span>
          <span className="card-detail-overlay__row-meta">${budget.data.limit_usd.toFixed(4)} limit</span>
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
                  return (
                    <span key={tier} className={`card-detail-overlay__slot${isActive ? ' is-active' : ''}`}>
                      <span className="card-detail-overlay__slot-tier">{tier.replace('fallback_', 'fb ')}</span>
                      <span>{slot?.provider}/{slot?.model}</span>
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
  const learning = governance.data?.learning_stats
  return (
    <>
      {(blocked.length > 0 || warnings.length > 0) && (
        <>
          <h3 className="card-detail-overlay__section-title">Blocked today</h3>
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
          <h3 className="card-detail-overlay__section-title">Warnings today</h3>
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
          <span className="card-detail-overlay__row-meta">{learning.total_approved ?? 0} approved</span>
          <span className="card-detail-overlay__row-meta">{learning.total_rejected ?? 0} rejected</span>
          <span className="card-detail-overlay__row-meta">{learning.total_skills_learned ?? 0} learned</span>
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

function McpDetail({ mcp }: { mcp: ReturnType<typeof useMcp> }) {
  const servers = mcp.data?.servers ?? []
  const pending = mcp.data?.pending_approvals ?? []
  const activity = mcp.data?.activity ?? {}
  return (
    <>
      <h3 className="card-detail-overlay__section-title">Servers</h3>
      {servers.length === 0 ? (
        <EmptyRow>No MCP servers registered.</EmptyRow>
      ) : (
        <div className="card-detail-overlay__list">
          {servers.map((server) => {
            const stats = activity[server.name]
            return (
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
                <span className="card-detail-overlay__row-meta">{server.url}</span>
                {server.description && <span className="card-detail-overlay__row-meta">{server.description}</span>}
              </div>
            )
          })}
        </div>
      )}
      <h3 className="card-detail-overlay__section-title">Pending approvals</h3>
      {pending.length === 0 ? (
        <EmptyRow>Nothing pending.</EmptyRow>
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
export function CardDetailOverlay({ cardId, agents, loops, models, governance, mcp, skills, budget, health, onClose }: CardDetailOverlayProps) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  return (
    <div className="card-detail-overlay" role="dialog" aria-label={`${TITLES[cardId]} details`}>
      <header className="card-detail-overlay__header">
        <span>{TITLES[cardId]}</span>
        <button type="button" className="card-detail-overlay__close" onClick={onClose} aria-label="Close">
          <CloseIcon />
        </button>
      </header>
      <div className="card-detail-overlay__body">
        {cardId === 'agents' && <AgentsDetail agents={agents} />}
        {cardId === 'loops' && <LoopsDetail loops={loops} />}
        {cardId === 'models' && <ModelsDetail models={models} budget={budget} health={health} />}
        {cardId === 'governance' && <GovernanceDetail governance={governance} />}
        {cardId === 'mcp' && <McpDetail mcp={mcp} />}
        {cardId === 'skills' && <SkillsDetail skills={skills} />}
      </div>
    </div>
  )
}
