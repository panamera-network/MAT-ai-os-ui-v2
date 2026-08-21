import { CAPABILITIES, TIERS, type ModelProfiles } from '../domain/vision'
import { useAgents } from '../hooks/useAgents'
import { useLoops } from '../hooks/useLoops'
import { useModels } from '../hooks/useModels'
import { useGovernance } from '../hooks/useGovernance'
import { useMcp } from '../hooks/useMcp'
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

function GaugeIcon() {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" fill="none" aria-hidden="true">
      <path stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" d="M2.5 12.5a5.5 5.5 0 0 1 11 0" />
      <path stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" d="M8 12.5 10.6 8" />
      <circle cx="8" cy="12.5" r="0.9" fill="currentColor" />
    </svg>
  )
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

/**
 * Left info zone — compact real-data snapshots: Agents, Loops, LLM/model
 * routing, Governance, MCP. Every value is a direct count/derivation from a
 * real VISION API response, formatted through `formatResourceValue` so
 * "still loading", "MAT unreachable", "request failed", and "loaded but
 * genuinely empty" each read distinctly instead of collapsing into one dash
 * — never a placeholder for a field the API doesn't expose.
 */
export function HudLeftPanel() {
  const agents = useAgents()
  const loops = useLoops()
  const models = useModels()
  const governance = useGovernance()
  const mcp = useMcp()

  return (
    <div className="hud-left-panel">
      <section className="hud-left-panel__card">
        <header className="hud-left-panel__card-header">
          <GaugeIcon />
          <span>Snapshot</span>
        </header>
        <div className="hud-left-panel__rows">
          <div className="hud-left-panel__row">
            <span className="hud-left-panel__row-icon">
              <AgentsIcon />
            </span>
            <span className="hud-left-panel__label">Agents</span>
            <span className="hud-left-panel__value">{formatResourceValue(agents, (d) => String(d.agents.length))}</span>
          </div>
          <div className="hud-left-panel__row">
            <span className="hud-left-panel__row-icon">
              <LoopsIcon />
            </span>
            <span className="hud-left-panel__label">Loops</span>
            <span className="hud-left-panel__value">
              {formatResourceValue(loops, (d) => `${d.loops.filter((loop) => loop.status === 'active').length} active / ${d.loops.length}`)}
            </span>
          </div>
          <div className="hud-left-panel__row">
            <span className="hud-left-panel__row-icon">
              <LlmIcon />
            </span>
            <span className="hud-left-panel__label">LLM</span>
            <span className="hud-left-panel__value">
              {formatResourceValue(models, (d) => `${countConfiguredSlots(d.profiles)} configured`)}
            </span>
          </div>
          <div className="hud-left-panel__row">
            <span className="hud-left-panel__row-icon">
              <GovernanceIcon />
            </span>
            <span className="hud-left-panel__label">Governance</span>
            <span className="hud-left-panel__value">
              {formatResourceValue(governance, (d) => `${d.laws.active_count} laws · ${d.lifecycle.total_cases} cases`)}
            </span>
          </div>
          <div className="hud-left-panel__row">
            <span className="hud-left-panel__row-icon">
              <McpIcon />
            </span>
            <span className="hud-left-panel__label">MCP</span>
            <span className="hud-left-panel__value">
              {formatResourceValue(mcp, (d) => `${d.servers.length} servers · ${d.pending_approvals.length} pending`)}
            </span>
          </div>
        </div>
      </section>
    </div>
  )
}
