import { useMemo, useState } from 'react'
import { BrainView, type BrainViewDomain, type BrainViewTab } from '@mat-ai-os/brain-view'
import '@mat-ai-os/brain-view/style.css'
import type { VisionApiAdapter } from '../../adapters/vision'
import type { Agent, KnowledgeItem, Skill } from '../../domain/vision'
import { useVisionResource } from '../../hooks/useVisionResource'

const fetchAgents = (api: VisionApiAdapter, signal: AbortSignal) => api.getAgents(signal)
const fetchSkills = (api: VisionApiAdapter, signal: AbortSignal) => api.getSkills(signal)
const fetchKnowledge = (api: VisionApiAdapter, signal: AbortSignal) => api.getKnowledge(undefined, signal)

/**
 * Deliberately presentational only (icon glyph + accent color) — carries no
 * claim about relationships or structure, unlike the node data itself.
 * Curated for the domains observed in real skill data; any domain not
 * listed here (a new one, or one this list hasn't caught up with) safely
 * falls back to a generic glyph rather than crashing or guessing.
 */
const DOMAIN_STYLE: Record<string, { icon: string; accent: string }> = {
  personal: { icon: '◐', accent: '#5cc8ff' },
  coding: { icon: '{ }', accent: '#4de3a8' },
  creative: { icon: '✦', accent: '#ff8fd6' },
  business: { icon: '▣', accent: '#ffb85c' },
  web3_blockchain: { icon: '⬡', accent: '#9b6cff' },
  ai_automation: { icon: '⚙', accent: '#7ad1ff' },
  data_analytics: { icon: '▤', accent: '#6ce3c8' },
  legal: { icon: '⚖', accent: '#c8a2ff' },
  pet_care: { icon: '❖', accent: '#ffcf8f' },
}
const FALLBACK_DOMAIN_STYLE = { icon: '●', accent: '#8fa6c9' }

function humanizeDomainSlug(slug: string): string {
  return slug.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
}

/** A skill/knowledge item is safe to show here only if it's genuinely
 * global or carries no owner at all — this view has no authenticated
 * caller identity to scope a private item against, so anything else is
 * skipped rather than risk surfacing another user's private data. */
function isPubliclyVisible(ownerUserId?: string | null, isGlobal?: boolean): boolean {
  return isGlobal === true || !ownerUserId
}

/** Real domains derived from `Skill.domain` (the complete set — some
 * domains don't have a dedicated Agent yet, see `agentForDomain`) — never a
 * fixed/fabricated list. Each domain's real Agent (if one exists) supplies
 * its display name; otherwise the raw domain slug is humanized. Skills and
 * knowledge are grouped by real `domain` fields only. `details` (the
 * package's third nesting tier, meant for a traced relation) is left empty
 * for every leaf: no genuine Skill<->Knowledge relationship exists in the
 * backend today (KnowledgeEngine and the skill/agent registries share no
 * field, and the one adjacent mechanism, KnowledgeGraph, is unpopulated in
 * production and out of scope here) — populating it with e.g. "same
 * domain" would imply a specific traced relation that isn't real. */
function buildDomains(agents: Agent[], skills: Skill[], knowledge: KnowledgeItem[]): BrainViewDomain[] {
  const domainSlugs = [...new Set(skills.map((skill) => skill.domain))].sort((a, b) => a.localeCompare(b))
  const agentByDomain = new Map(agents.filter((agent) => isPubliclyVisible(agent.user_id, agent.is_global)).map((agent) => [agent.domain, agent]))

  return domainSlugs.map((domainSlug) => {
    const style = DOMAIN_STYLE[domainSlug] ?? FALLBACK_DOMAIN_STYLE
    const agent = agentByDomain.get(domainSlug)
    const domainSkills = skills.filter((skill) => skill.domain === domainSlug && isPubliclyVisible(skill.owner_user_id, skill.is_global))
    const domainKnowledge = knowledge.filter((item) => item.domain === domainSlug && item.active_version !== null)

    return {
      id: domainSlug,
      name: agent ? agent.name : humanizeDomainSlug(domainSlug),
      icon: style.icon,
      accent: style.accent,
      skills: domainSkills.map((skill) => ({ id: skill.id, label: skill.name })),
      knowledge: domainKnowledge.map((item) => ({ id: item.id, label: item.topic })),
    }
  })
}

/**
 * The Brain View canvas view. Owns its own real data — `useAgents`/
 * `useSkills`/`useKnowledge`-equivalent fetches, each a single glance-and-
 * load (no polling: "Default Brain View kekal ringan", and this view isn't
 * always mounted). `BrainView` itself is fully prop-driven and untouched
 * from the standalone package — this file only ever reshapes real VISION
 * API data into its `BrainViewDomain[]` contract, never fabricates a node
 * or a connection that isn't backed by real data (see `buildDomains`).
 */
export function BrainViewCanvas() {
  const [tab, setTab] = useState<BrainViewTab>('skills')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const agents = useVisionResource(fetchAgents)
  const skills = useVisionResource(fetchSkills)
  const knowledge = useVisionResource(fetchKnowledge)

  const domains = useMemo(
    () => buildDomains(agents.data?.agents ?? [], skills.data?.skills ?? [], knowledge.data?.knowledge ?? []),
    [agents.data, skills.data, knowledge.data],
  )

  return (
    <BrainView
      domains={domains}
      tab={tab}
      onTabChange={setTab}
      selectedId={selectedId}
      onSelect={(selection) => setSelectedId(selection.id)}
      onExplore={() => setSelectedId(null)}
    />
  )
}
