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
 * knowledge are grouped by real `domain` fields only.
 *
 * `details` (the package's third nesting tier, "nested detail nodes
 * revealed under this leaf while its domain is focused") is populated from
 * the ONE genuine Skill<->Knowledge relationship the backend actually
 * exposes: `KnowledgeItem.promoted_skill_id` — set only once a human calls
 * `POST /knowledge/{id}/promote`, `null` for every note that hasn't been.
 * A knowledge leaf's `details` is the one real skill it was promoted into
 * (at most one, since `promoted_skill_id` is a single id); a skill leaf's
 * `details` is every real knowledge note whose `promoted_skill_id` points
 * back at it (an "improve" promotion can update the same skill from more
 * than one note, so this is genuinely 0-to-many, never assumed to be 0-or-1).
 * Both sides join against this SAME domain's own already visibility-
 * filtered `domainSkills`/`domainKnowledge` below, never the raw unfiltered
 * lists, so a detail node here can never reference a private skill/note
 * this view wouldn't otherwise show on its own. Everything else (e.g. "same
 * domain" alone) is deliberately NOT treated as a relationship — that would
 * be a traced link this codebase can't actually back with a real field. */
export function buildDomains(agents: Agent[], skills: Skill[], knowledge: KnowledgeItem[]): BrainViewDomain[] {
  const domainSlugs = [...new Set(skills.map((skill) => skill.domain))].sort((a, b) => a.localeCompare(b))
  const agentByDomain = new Map(agents.filter((agent) => isPubliclyVisible(agent.user_id, agent.is_global)).map((agent) => [agent.domain, agent]))

  return domainSlugs.map((domainSlug) => {
    const style = DOMAIN_STYLE[domainSlug] ?? FALLBACK_DOMAIN_STYLE
    const agent = agentByDomain.get(domainSlug)
    const domainSkills = skills.filter((skill) => skill.domain === domainSlug && isPubliclyVisible(skill.owner_user_id, skill.is_global))
    const domainKnowledge = knowledge.filter((item) => item.domain === domainSlug && item.active_version !== null)

    const skillById = new Map(domainSkills.map((skill) => [skill.id, skill]))
    const knowledgeByPromotedSkillId = new Map<string, KnowledgeItem[]>()
    for (const item of domainKnowledge) {
      if (!item.promoted_skill_id) continue
      const promotedInto = knowledgeByPromotedSkillId.get(item.promoted_skill_id)
      if (promotedInto) promotedInto.push(item)
      else knowledgeByPromotedSkillId.set(item.promoted_skill_id, [item])
    }

    return {
      id: domainSlug,
      name: agent ? agent.name : humanizeDomainSlug(domainSlug),
      icon: style.icon,
      accent: style.accent,
      skills: domainSkills.map((skill) => ({
        id: skill.id,
        label: skill.name,
        details: (knowledgeByPromotedSkillId.get(skill.id) ?? []).map((item) => ({ id: item.id, label: item.topic })),
      })),
      knowledge: domainKnowledge.map((item) => {
        const promotedSkill = item.promoted_skill_id ? skillById.get(item.promoted_skill_id) : undefined
        return {
          id: item.id,
          label: item.topic,
          details: promotedSkill ? [{ id: promotedSkill.id, label: promotedSkill.name }] : [],
        }
      }),
    }
  })
}

/**
 * The Brain View canvas view. Owns its own real data — `useAgents`/
 * `useSkills`/`useKnowledge`-equivalent fetches, each a single glance-and-
 * load (no polling: "Default Brain View kekal ringan", and this view isn't
 * always mounted). `BrainView` itself is fully prop-driven and untouched
 * from the standalone package (`@mat-ai-os/brain-view`, its own separate
 * repo, `D:\MAT-AI-BrainView` — not modified by this feature) — this file
 * only ever reshapes real VISION API data into its `BrainViewDomain[]`
 * contract, including the real Knowledge<->Skill `details` cross-link (see
 * `buildDomains`), never a fabricated node or connection.
 *
 * Skill/Knowledge tab placement (`tabsPlacement="top-center"` below) is now
 * the package's own owned, prop-driven behavior — this repo no longer
 * ships a CSS override reaching into the package's internal
 * `.brain-view-tabs` class (see `MAT-AI-BrainView`'s own `BrainViewProps`).
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
      tabsPlacement="top-center"
    />
  )
}
