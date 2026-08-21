import type { ReactNode } from 'react'
import { CAPABILITIES, TIERS, type ModelProfiles } from '../domain/vision'
import { useAgents } from '../hooks/useAgents'
import { useLoops } from '../hooks/useLoops'
import { useModels } from '../hooks/useModels'
import { useGovernance } from '../hooks/useGovernance'
import { useMcp } from '../hooks/useMcp'
import { useSkills } from '../hooks/useSkills'
import { formatResourceValue } from '../hooks/useVisionResource'
import './HudLeftPanel.css'

function countConfiguredSlots(profiles: ModelProfiles): number {
  let count = 0
  for (const capability of CAPABILITIES) {
    for (const tier of TIERS) {
      if (profiles[capability]?.[tier]) count += 1
    }
  }
  return count
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

function LlmIcon() {
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

interface ResourceStateSource {
  data: unknown
  error: { unreachable: boolean } | null
  loading: boolean
}

function getResourceState(resource: ResourceStateSource): { label: string; tone: string } {
  if (resource.data) return { label: 'ready', tone: 'ready' }
  if (resource.loading) return { label: 'loading', tone: 'loading' }
  if (resource.error) return { label: resource.error.unreachable ? 'offline' : 'error', tone: 'error' }
  return { label: 'empty', tone: 'empty' }
}

interface InfoCardProps {
  accent: 'cyan' | 'blue' | 'violet' | 'green' | 'amber' | 'ice'
  icon: ReactNode
  title: string
  mainLabel: string
  mainValue: string
  metrics: { label: string; value: string }[]
  state: { label: string; tone: string }
}

function InfoCard({ accent, icon, title, mainLabel, mainValue, metrics, state }: InfoCardProps) {
  const hasData = state.tone === 'ready'

  return (
    <section className={`hud-left-panel__card hud-left-panel__card--${accent}`}>
      <header className="hud-left-panel__card-header">
        <span className="hud-left-panel__header-icon">{icon}</span>
        <span>{title}</span>
        <span className={`hud-left-panel__state is-${state.tone}`}>
          <span className="hud-left-panel__state-dot" />
          {state.label}
        </span>
      </header>
      <div className="hud-left-panel__card-body">
        <div className="hud-left-panel__metric-ring">
          <strong>{hasData ? mainValue : '—'}</strong>
          <span>{mainLabel}</span>
        </div>
        <dl className="hud-left-panel__metrics">
          {metrics.map((metric) => (
            <div key={metric.label}>
              <dt>{metric.label}</dt>
              <dd>{hasData ? metric.value : '—'}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  )
}

/**
 * Left info zone — separate real-data cards for Agents, Loops, LLM/model
 * routing, Governance, MCP, and Skills. Every value is a direct count/derivation
 * from a real VISION API response, formatted through `formatResourceValue`
 * so "still loading", "MAT unreachable", "request failed", and "loaded but
 * genuinely empty" each read distinctly instead of collapsing into one dash
 * — never a placeholder for a field the API doesn't expose. Skills is just a
 * count today (`useSkills` is the drawer-ready data path — a real skills
 * list/drawer UI is future work, not this pass's job).
 */
export function HudLeftPanel() {
  const agents = useAgents()
  const loops = useLoops()
  const models = useModels()
  const governance = useGovernance()
  const mcp = useMcp()
  const skills = useSkills()

  return (
    <div className="hud-left-panel">
      <InfoCard
        accent="cyan"
        icon={<AgentsIcon />}
        title="Agents"
        mainLabel="total"
        mainValue={formatResourceValue(agents, (d) => String(d.agents.length))}
        metrics={[
          { label: 'Global', value: formatResourceValue(agents, (d) => String(d.agents.filter((agent) => agent.is_global).length)) },
          { label: 'Domains', value: formatResourceValue(agents, (d) => String(new Set(d.agents.map((agent) => agent.domain)).size)) },
          { label: 'Skill links', value: formatResourceValue(agents, (d) => String(d.agents.reduce((sum, agent) => sum + agent.skill_ids.length, 0))) },
        ]}
        state={getResourceState(agents)}
      />
      <InfoCard
        accent="blue"
        icon={<LoopsIcon />}
        title="Loops"
        mainLabel="active"
        mainValue={formatResourceValue(loops, (d) => String(d.loops.filter((loop) => loop.status === 'active').length))}
        metrics={[
          { label: 'Total', value: formatResourceValue(loops, (d) => String(d.loops.length)) },
          { label: 'Paused', value: formatResourceValue(loops, (d) => String(d.loops.filter((loop) => loop.status === 'paused').length)) },
          { label: 'Runs', value: formatResourceValue(loops, (d) => String(d.loops.reduce((sum, loop) => sum + loop.run_count, 0))) },
        ]}
        state={getResourceState(loops)}
      />
      <InfoCard
        accent="violet"
        icon={<LlmIcon />}
        title="LLM"
        mainLabel="slots"
        mainValue={formatResourceValue(models, (d) => String(countConfiguredSlots(d.profiles)))}
        metrics={[
          { label: 'Capabilities', value: formatResourceValue(models, (d) => String(CAPABILITIES.filter((capability) => TIERS.some((tier) => Boolean(d.profiles[capability]?.[tier]))).length)) },
          { label: 'Primary', value: formatResourceValue(models, (d) => String(CAPABILITIES.filter((capability) => Boolean(d.profiles[capability]?.primary)).length)) },
          { label: 'Fallbacks', value: formatResourceValue(models, (d) => String(CAPABILITIES.reduce((sum, capability) => sum + TIERS.slice(1).filter((tier) => Boolean(d.profiles[capability]?.[tier])).length, 0))) },
        ]}
        state={getResourceState(models)}
      />
      <InfoCard
        accent="green"
        icon={<GovernanceIcon />}
        title="Governance"
        mainLabel="active"
        mainValue={formatResourceValue(governance, (d) => String(d.laws.active_count))}
        metrics={[
          { label: 'Total laws', value: formatResourceValue(governance, (d) => String(d.laws.total)) },
          { label: 'Inactive', value: formatResourceValue(governance, (d) => String(d.laws.inactive_count)) },
          { label: 'Cases', value: formatResourceValue(governance, (d) => String(d.lifecycle.total_cases)) },
        ]}
        state={getResourceState(governance)}
      />
      <InfoCard
        accent="amber"
        icon={<McpIcon />}
        title="MCP"
        mainLabel="servers"
        mainValue={formatResourceValue(mcp, (d) => String(d.servers.length))}
        metrics={[
          { label: 'Pending', value: formatResourceValue(mcp, (d) => String(d.pending_approvals.length)) },
          { label: 'Agents', value: formatResourceValue(mcp, (d) => String(new Set(d.pending_approvals.map((approval) => approval.agent_id)).size)) },
          { label: 'Skill grants', value: formatResourceValue(mcp, (d) => String(d.pending_approvals.reduce((sum, approval) => sum + approval.granting_skills.length, 0))) },
        ]}
        state={getResourceState(mcp)}
      />
      <InfoCard
        accent="ice"
        icon={<SkillsIcon />}
        title="Skills"
        mainLabel="total"
        mainValue={formatResourceValue(skills, (d) => String(d.skills.length))}
        metrics={[
          { label: 'Global', value: formatResourceValue(skills, (d) => String(d.skills.filter((skill) => skill.is_global).length)) },
          { label: 'Personal', value: formatResourceValue(skills, (d) => String(d.skills.filter((skill) => Boolean(skill.owner_user_id)).length)) },
          { label: 'MCP linked', value: formatResourceValue(skills, (d) => String(d.skills.filter((skill) => (skill.mcp_servers?.length ?? 0) > 0).length)) },
        ]}
        state={getResourceState(skills)}
      />
    </div>
  )
}
