import { useEffect, useRef, useState, type ReactNode } from 'react'
import { type Health, type KnowledgeItem } from '../domain/vision'
import type { useAgents } from '../hooks/useAgents'
import type { useLoops } from '../hooks/useLoops'
import type { useModels } from '../hooks/useModels'
import type { useGovernance } from '../hooks/useGovernance'
import type { useMcp } from '../hooks/useMcp'
import type { useSkills } from '../hooks/useSkills'
import type { useBudget } from '../hooks/useBudget'
import type { useKnowledgeNotes } from '../hooks/useKnowledgeNotes'
import { formatResourceValue } from '../hooks/useVisionResource'
import type { DetailCardId } from './detailCardId'
import './HudLeftPanel.css'

/** The "provider/model" key with the highest real dispatch count — `null`
 * for an empty (or not-yet-populated) usage record, never a guess. */
function mostUsedModel(usage: Record<string, number>): string | null {
  let top: string | null = null
  let topCount = -1
  for (const [key, count] of Object.entries(usage)) {
    if (count > topCount) {
      top = key
      topCount = count
    }
  }
  return top
}

function sumRecordValues(record: Record<string, number>): number {
  return Object.values(record).reduce((sum, value) => sum + value, 0)
}

/** Small enough real costs (a per-token estimate) that 2 decimals often
 * rounds to "$0.00" — 4 decimals stays honest without exaggerating. */
function formatUsd(value: number): string {
  return `$${value.toFixed(4)}`
}

/** Most frequent `domain` among `agents` — a real derivation over the exact
 * roster the card already has, never a fabricated field. Ties resolve to
 * whichever domain was encountered first (stable, not random). */
function computeTopDomain(agents: { domain: string }[]): string {
  if (agents.length === 0) return '—'
  const counts = new Map<string, number>()
  for (const agent of agents) {
    counts.set(agent.domain, (counts.get(agent.domain) ?? 0) + 1)
  }
  let topDomain = agents[0].domain
  let topCount = 0
  for (const [domain, count] of counts) {
    if (count > topCount) {
      topDomain = domain
      topCount = count
    }
  }
  return topDomain
}

const RECENT_LEARNED_WINDOW_MS = 7 * 24 * 60 * 60 * 1000

/** Skills whose real `learned_at` falls within the last 7 days — skills with
 * no `learned_at` at all (built-in, never-learned ones) are never counted,
 * not treated as "not recent". */
function countRecentlyLearned(skills: { learned_at?: string }[]): number {
  const cutoff = Date.now() - RECENT_LEARNED_WINDOW_MS
  return skills.filter((skill) => skill.learned_at && new Date(skill.learned_at).getTime() >= cutoff).length
}

/** Real counts by `workflow_status` — the Practice/Sparring -> Validate
 * pipeline's own five user-facing states; "new"/"validated" (transient —
 * see `KnowledgeWorkflowStatus`'s own doc comment)/"rejected" (not yet used
 * by any real code path) are deliberately not tallied here or shown anywhere
 * in this card/overlay pair, keeping the UI scoped to what's actually
 * actionable today. */
export function countKnowledgeByWorkflowStatus(notes: KnowledgeItem[]) {
  return {
    reviewed: notes.filter((note) => note.workflow_status === 'reviewed').length,
    practicing: notes.filter((note) => note.workflow_status === 'practicing').length,
    readyForPromotion: notes.filter((note) => note.workflow_status === 'ready_for_promotion').length,
    needsRelearn: notes.filter((note) => note.workflow_status === 'needs_relearn').length,
    promoted: notes.filter((note) => note.workflow_status === 'promoted').length,
  }
}

function AgentsIcon() {
  return (
    <svg viewBox="0 0 16 16" width="13" height="13" fill="none" aria-hidden="true">
      <circle cx="8" cy="5.4" r="2.2" stroke="currentColor" strokeWidth="1.3" />
      <path stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" d="M3.2 13.4c.6-2.7 2.5-4.2 4.8-4.2s4.2 1.5 4.8 4.2" />
    </svg>
  )
}

function LoopsIcon() {
  return (
    <svg viewBox="0 0 16 16" width="13" height="13" fill="none" aria-hidden="true">
      <path stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" d="M3 7.2A5 5 0 0 1 12.4 5M13 8.8A5 5 0 0 1 3.6 11" />
      <path stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" d="M12.4 5V2.4M12.4 5H9.8M3.6 11v2.6M3.6 11h2.6" />
    </svg>
  )
}

function ModelsIcon() {
  return (
    <svg viewBox="0 0 16 16" width="13" height="13" fill="none" aria-hidden="true">
      <rect x="4" y="4" width="8" height="8" rx="1.2" stroke="currentColor" strokeWidth="1.3" />
      <path stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" d="M6.4 1.6v2M9.6 1.6v2M6.4 12.4v2M9.6 12.4v2M1.6 6.4h2M1.6 9.6h2M12.4 6.4h2M12.4 9.6h2" />
    </svg>
  )
}

function GovernanceIcon() {
  return (
    <svg viewBox="0 0 16 16" width="13" height="13" fill="none" aria-hidden="true">
      <path
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
        d="M8 1.6 13.2 3.4v3.9c0 3.4-2.2 5.9-5.2 7.1-3-1.2-5.2-3.7-5.2-7.1V3.4L8 1.6Z"
      />
      <path stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" d="M5.6 8.2 7.3 9.9l3.1-3.4" />
    </svg>
  )
}

function McpIcon() {
  return (
    <svg viewBox="0 0 16 16" width="13" height="13" fill="none" aria-hidden="true">
      <circle cx="3.4" cy="12.6" r="1.4" stroke="currentColor" strokeWidth="1.2" />
      <circle cx="12.6" cy="12.6" r="1.4" stroke="currentColor" strokeWidth="1.2" />
      <circle cx="8" cy="3.4" r="1.4" stroke="currentColor" strokeWidth="1.2" />
      <path stroke="currentColor" strokeWidth="1.1" d="M8 4.8v3.4M4.6 11.6 7.3 9M11.4 11.6 8.7 9" />
    </svg>
  )
}

function SkillsIcon() {
  return (
    <svg viewBox="0 0 16 16" width="13" height="13" fill="none" aria-hidden="true">
      <path
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
        d="M8 1.8 14 5v6L8 14.2 2 11V5L8 1.8Z"
      />
      <path stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" d="M8 5.2v5.6M5.6 6.5l4.8 2.8M10.4 6.5 5.6 9.3" />
    </svg>
  )
}

function KnowledgeIcon() {
  return (
    <svg viewBox="0 0 16 16" width="13" height="13" fill="none" aria-hidden="true">
      <path
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3 2.6h6.4L13 6.2v7.2a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V3.6a1 1 0 0 1 1-1Z"
      />
      <path stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" d="M4.6 8h5.2M4.6 10.4h5.2M4.6 5.6h2.4" />
    </svg>
  )
}

interface ResourceStateSource {
  data: unknown
  error: { unreachable: boolean } | null
  loading: boolean
}

/** `true` only for a real `BodyScoped<T>` response that explicitly says
 * `body_attached: false` — a genuine "MAT answered, but no V2Body is
 * running" fact, never guessed for a shape that doesn't carry the field at
 * all (e.g. `ModelsResult`, MAT's own registry, isn't Body-scoped). */
function isBodyDetached(data: unknown): boolean {
  return typeof data === 'object' && data !== null && 'body_attached' in data && (data as { body_attached: unknown }).body_attached === false
}

function getResourceState(resource: ResourceStateSource): { label: string; tone: string } {
  if (resource.data) {
    if (isBodyDetached(resource.data)) return { label: 'no body', tone: 'degraded' }
    return { label: 'ready', tone: 'ready' }
  }
  if (resource.loading) return { label: 'loading', tone: 'loading' }
  if (resource.error) return { label: resource.error.unreachable ? 'offline' : 'error', tone: 'error' }
  return { label: 'empty', tone: 'empty' }
}

/** "3s"/"2m"/"1h" since `timestamp` — recomputed at render time (every poll
 * naturally re-renders this every `LEFT_PANEL_POLL_MS`), never a ticking
 * clock/interval of its own. `null` before the first successful fetch ever
 * lands, same as `lastUpdated` itself. */
function formatRelativeTime(timestamp: number | null): string | null {
  if (timestamp === null) return null
  const deltaSeconds = Math.max(0, Math.round((Date.now() - timestamp) / 1000))
  if (deltaSeconds < 5) return 'now'
  if (deltaSeconds < 60) return `${deltaSeconds}s`
  const deltaMinutes = Math.round(deltaSeconds / 60)
  if (deltaMinutes < 60) return `${deltaMinutes}m`
  return `${Math.round(deltaMinutes / 60)}h`
}

/** Up/down only once two REAL consecutive poll samples actually differ —
 * `null` (no indicator rendered) until then, and again whenever the caller
 * passes `null` (not ready / not a numeric headline, e.g. Models' Active
 * Model string). Never a guess, never shown on the very first sample. */
function useTrend(value: number | null): 'up' | 'down' | null {
  const previousRef = useRef<number | null>(null)
  const [trend, setTrend] = useState<'up' | 'down' | null>(null)

  useEffect(() => {
    if (value === null) return
    const previous = previousRef.current
    if (previous !== null && value !== previous) {
      setTrend(value > previous ? 'up' : 'down')
    }
    previousRef.current = value
  }, [value])

  return trend
}

interface InfoCardProps {
  id: DetailCardId
  accent: 'cyan' | 'blue' | 'violet' | 'green' | 'amber' | 'ice' | 'rose'
  icon: ReactNode
  title: string
  mainLabel: string
  mainValue: string
  /** Raw numeric value backing `mainValue`, for trend tracking only — `null`
   * when not ready, or when the headline isn't a plain count (Models). */
  trendValue: number | null
  metrics: { label: string; value: string }[]
  state: { label: string; tone: string }
  lastUpdated: number | null
  onSelect: (id: DetailCardId) => void
  /** Real, card-specific business-data attention (e.g. unresolved cases,
   * blocked-today > 0) — ORed with the connectivity-derived degraded/error
   * tone below, never a substitute for it. `false`/omitted when the
   * resource isn't ready, so this never flashes ahead of real data. */
  attention?: boolean
}

function InfoCard({ id, accent, icon, title, mainLabel, mainValue, trendValue, metrics, state, lastUpdated, onSelect, attention: dataAttention }: InfoCardProps) {
  const isReady = state.tone === 'ready'
  const trend = useTrend(isReady ? trendValue : null)
  const updated = formatRelativeTime(lastUpdated)
  const attention = state.tone === 'degraded' || state.tone === 'error' || Boolean(dataAttention)

  const handleKeyDown = (event: React.KeyboardEvent<HTMLElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      onSelect(id)
    }
  }

  return (
    <section
      className={`hud-left-panel__card hud-left-panel__card--${accent}${attention ? ' is-attention' : ''}`}
      role="button"
      tabIndex={0}
      onClick={() => onSelect(id)}
      onKeyDown={handleKeyDown}
      aria-label={`Open ${title} details`}
    >
      <header className="hud-left-panel__card-header">
        <span className="hud-left-panel__header-icon">{icon}</span>
        <span>{title}</span>
        <span className={`hud-left-panel__state is-${state.tone}`}>
          <span className="hud-left-panel__state-dot" />
          {state.label}
          {updated && <span className="hud-left-panel__updated"> · {updated}</span>}
        </span>
      </header>
      <div className="hud-left-panel__card-body">
        <div className="hud-left-panel__metric-ring">
          <strong>
            {mainValue}
            {trend && (
              <span className={`hud-left-panel__trend hud-left-panel__trend--${trend}`} aria-hidden="true">
                {trend === 'up' ? '▲' : '▼'}
              </span>
            )}
          </strong>
          <span>{mainLabel}</span>
        </div>
        <dl className="hud-left-panel__metrics">
          {metrics.map((metric) => (
            <div key={metric.label}>
              <dt>{metric.label}</dt>
              <dd>{metric.value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  )
}

interface HudLeftPanelProps {
  agents: ReturnType<typeof useAgents>
  loops: ReturnType<typeof useLoops>
  models: ReturnType<typeof useModels>
  governance: ReturnType<typeof useGovernance>
  mcp: ReturnType<typeof useMcp>
  skills: ReturnType<typeof useSkills>
  knowledgeNotes: ReturnType<typeof useKnowledgeNotes>
  budget: ReturnType<typeof useBudget>
  health: Health | null
  onSelect: (id: DetailCardId) => void
}

/**
 * Left info zone — Batch A (live metrics + drill-down): every card now polls
 * (see `useVisionResource`'s `pollMs`, wired in each `use*` hook), is
 * clickable (opens `CardDetailOverlay` for that card), shows a small
 * up/down trend once two real consecutive polls disagree, and an honest
 * `body_attached: false` no longer renders as green "ready" (see
 * `getResourceState`). Resource hooks are called by `HomeScreen` and handed
 * down as props — `CardDetailOverlay` needs the exact same data, and
 * calling each hook a second time here would double the request rate for
 * no reason.
 */
export function HudLeftPanel({ agents, loops, models, governance, mcp, skills, knowledgeNotes, budget, health, onSelect }: HudLeftPanelProps) {
  const agentsState = getResourceState(agents)
  const loopsState = getResourceState(loops)
  const modelsState = getResourceState(models)
  const governanceState = getResourceState(governance)
  const mcpState = getResourceState(mcp)
  const skillsState = getResourceState(skills)
  const knowledgeState = getResourceState(knowledgeNotes)

  const unresolvedAgentCases = agents.data ? agents.data.unresolved_cases.length : 0
  const failedLoopsToday = loops.data ? loops.data.today.failed : 0
  const blockedToday = governance.data ? governance.data.blocked_today.length : 0
  const mcpFailingCount = mcp.data ? Object.values(mcp.data.activity).filter((entry) => entry.failure_count > 0).length : 0
  const budgetEmergency = budget.data ? Boolean((budget.data.status as { emergency?: unknown }).emergency) : false
  const knowledgeCounts = countKnowledgeByWorkflowStatus(knowledgeNotes.data?.knowledge ?? [])

  return (
    <div className="hud-left-panel">
      <InfoCard
        id="agents"
        accent="cyan"
        icon={<AgentsIcon />}
        title="Agents"
        mainLabel="total"
        mainValue={formatResourceValue(agents, (d) => String(d.agents.length))}
        trendValue={agents.data ? agents.data.agents.length : null}
        metrics={[
          { label: 'Top domain', value: formatResourceValue(agents, (d) => computeTopDomain(d.agents)) },
          { label: 'Active', value: formatResourceValue(agents, (d) => String(d.active_agent_ids.length)) },
          { label: 'Unresolved', value: formatResourceValue(agents, (d) => String(d.unresolved_cases.length)) },
        ]}
        state={agentsState}
        lastUpdated={agents.lastUpdated}
        onSelect={onSelect}
        attention={agentsState.tone === 'ready' && unresolvedAgentCases > 0}
      />
      <InfoCard
        id="loops"
        accent="blue"
        icon={<LoopsIcon />}
        title="Loops"
        mainLabel="active"
        mainValue={formatResourceValue(loops, (d) => String(d.loops.filter((loop) => loop.status === 'active').length))}
        trendValue={loops.data ? loops.data.loops.filter((loop) => loop.status === 'active').length : null}
        metrics={[
          { label: 'Completed today', value: formatResourceValue(loops, (d) => String(d.today.completed)) },
          { label: 'Failed today', value: formatResourceValue(loops, (d) => String(d.today.failed)) },
          { label: 'Paused', value: formatResourceValue(loops, (d) => String(d.loops.filter((loop) => loop.status === 'paused').length)) },
        ]}
        state={loopsState}
        lastUpdated={loops.lastUpdated}
        onSelect={onSelect}
        attention={loopsState.tone === 'ready' && failedLoopsToday > 0}
      />
      <InfoCard
        id="models"
        accent="violet"
        icon={<ModelsIcon />}
        title="Models"
        mainLabel="active model"
        mainValue={health ? `${health.active_model.provider}/${health.active_model.model}` : formatResourceValue(models, () => '—')}
        trendValue={null}
        metrics={[
          { label: 'Most used', value: formatResourceValue(budget, (d) => mostUsedModel(d.model_usage) ?? '—') },
          { label: 'Fallbacks', value: formatResourceValue(budget, (d) => String(sumRecordValues(d.fallback_counts))) },
          { label: 'Budget', value: formatResourceValue(budget, (d) => `${formatUsd(d.used_usd)} / ${formatUsd(d.available_usd)}`) },
        ]}
        state={modelsState}
        lastUpdated={models.lastUpdated}
        onSelect={onSelect}
        attention={budgetEmergency}
      />
      <InfoCard
        id="governance"
        accent="green"
        icon={<GovernanceIcon />}
        title="Governance"
        mainLabel="active"
        mainValue={formatResourceValue(governance, (d) => String(d.laws.active_count))}
        trendValue={governance.data ? governance.data.laws.active_count : null}
        metrics={[
          { label: 'Blocked today', value: formatResourceValue(governance, (d) => String(d.blocked_today.length)) },
          { label: 'Warnings today', value: formatResourceValue(governance, (d) => String(d.warnings_today.length)) },
          { label: 'Rules triggered', value: formatResourceValue(governance, (d) => String(d.rules_triggered_today)) },
        ]}
        state={governanceState}
        lastUpdated={governance.lastUpdated}
        onSelect={onSelect}
        attention={governanceState.tone === 'ready' && blockedToday > 0}
      />
      <InfoCard
        id="mcp"
        accent="amber"
        icon={<McpIcon />}
        title="MCP"
        mainLabel="servers"
        mainValue={formatResourceValue(mcp, (d) => String(d.servers.length))}
        trendValue={mcp.data ? mcp.data.servers.length : null}
        metrics={[
          { label: 'Pending', value: formatResourceValue(mcp, (d) => String(d.pending_approvals.length)) },
          { label: 'Responding', value: formatResourceValue(mcp, (d) => String(Object.values(d.activity).filter((entry) => entry.success_count > 0).length)) },
          { label: 'Has failures', value: formatResourceValue(mcp, (d) => String(Object.values(d.activity).filter((entry) => entry.failure_count > 0).length)) },
        ]}
        state={mcpState}
        lastUpdated={mcp.lastUpdated}
        onSelect={onSelect}
        attention={mcpState.tone === 'ready' && mcpFailingCount > 0}
      />
      <InfoCard
        id="skills"
        accent="ice"
        icon={<SkillsIcon />}
        title="Skills"
        mainLabel="total"
        mainValue={formatResourceValue(skills, (d) => String(d.skills.length))}
        trendValue={skills.data ? skills.data.skills.length : null}
        metrics={[
          { label: 'Domains covered', value: formatResourceValue(skills, (d) => String(new Set(d.skills.map((skill) => skill.domain)).size)) },
          { label: 'Learned recently', value: formatResourceValue(skills, (d) => String(countRecentlyLearned(d.skills))) },
          { label: 'Upgraded', value: formatResourceValue(skills, (d) => String(d.upgraded_count)) },
        ]}
        state={skillsState}
        lastUpdated={skills.lastUpdated}
        onSelect={onSelect}
      />
      <InfoCard
        id="knowledge"
        accent="rose"
        icon={<KnowledgeIcon />}
        title="Knowledge Notes"
        mainLabel="ready for promo"
        mainValue={formatResourceValue(knowledgeNotes, () => String(knowledgeCounts.readyForPromotion))}
        trendValue={knowledgeNotes.data ? knowledgeCounts.readyForPromotion : null}
        metrics={[
          { label: 'Reviewed', value: formatResourceValue(knowledgeNotes, () => String(knowledgeCounts.reviewed)) },
          { label: 'Practicing', value: formatResourceValue(knowledgeNotes, () => String(knowledgeCounts.practicing)) },
          { label: 'Needs relearn', value: formatResourceValue(knowledgeNotes, () => String(knowledgeCounts.needsRelearn)) },
        ]}
        state={knowledgeState}
        lastUpdated={knowledgeNotes.lastUpdated}
        onSelect={onSelect}
        attention={knowledgeState.tone === 'ready' && (knowledgeCounts.readyForPromotion > 0 || knowledgeCounts.needsRelearn > 0)}
      />
    </div>
  )
}
