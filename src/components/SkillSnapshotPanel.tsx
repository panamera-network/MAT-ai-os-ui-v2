import { useEffect, useState } from 'react'
import { useVisionApi } from '../app/VisionApiProvider'
import { VisionApiError } from '../adapters/vision'
import type { Skill, SkillVersion } from '../domain/vision'
import './SkillSnapshotPanel.css'

/** "View Updated Skill" / "View Diff" — self-contained, on-demand data
 * fetching for one skill_id, the same established pattern `CardDetailOverlay
 * .tsx`'s own `SkillRow` already uses (`useVisionApi()` called directly from
 * a small, independent component) rather than threading a new API call
 * through `ActivityPanel`'s own props, which stays purely presentational for
 * its OWN send/learn/voice logic exactly as before.
 *
 * Reuses `GET /skills` (current state) and `GET /skills/{skill_id}/versions`
 * (history) verbatim — no new backend route. `SkillRegistry.update()`
 * snapshots a skill's state BEFORE applying a change, so the most recent
 * version record's `data` is reliably this skill's "Before" state for
 * whichever update JUST happened, as long as nothing else has touched this
 * skill since (see this feature's own audit for the one disclosed edge case:
 * a STALE receipt, revisited after a LATER unrelated update, would show the
 * diff for that later change instead). A skill with zero version records has
 * never been updated at all — shown as "Created", not an error. */
const DIFF_FIELDS: { key: 'name' | 'description' | 'prompt_fragment' | 'domain'; label: string }[] = [
  { key: 'name', label: 'Name' },
  { key: 'description', label: 'Description' },
  { key: 'prompt_fragment', label: 'Prompt fragment' },
  { key: 'domain', label: 'Domain' },
]

type LoadState = 'loading' | 'loaded' | 'error'

function formatWhen(iso: string | null | undefined): string {
  if (!iso) return 'unknown time'
  const parsed = new Date(iso)
  if (Number.isNaN(parsed.getTime())) return iso
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }).format(parsed)
}

function fieldValue(source: Skill | Record<string, unknown> | null, key: string): string {
  if (!source) return '(empty)'
  const value = (source as Record<string, unknown>)[key]
  if (value === null || value === undefined || value === '') return '(empty)'
  return String(value)
}

export function SkillSnapshotPanel({
  skillId,
  /** Derived by the caller from `receipt.changed` — which of THIS skill_id's
   * two possible real outcomes the backend already confirmed happened.
   * Used only to pick the right message when version history comes back
   * empty (see the render logic below); never used to invent or alter any
   * displayed field value. */
  expectedAction,
}: {
  skillId: string
  expectedAction: 'created' | 'upgraded' | null
}) {
  const api = useVisionApi()
  const [state, setState] = useState<LoadState>('loading')
  const [current, setCurrent] = useState<Skill | null>(null)
  const [versions, setVersions] = useState<SkillVersion[] | null>(null)
  const [diffOpen, setDiffOpen] = useState(false)

  useEffect(() => {
    let cancelled = false
    setState('loading')
    Promise.all([api.getSkills(), api.getSkillVersions(skillId)])
      .then(([skillsResult, versionsResult]) => {
        if (cancelled) return
        setCurrent(skillsResult.skills.find((s) => s.id === skillId) ?? null)
        setVersions(versionsResult.versions)
        setState('loaded')
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setState('error')
        if (!(err instanceof VisionApiError)) throw err
      })
    return () => {
      cancelled = true
    }
  }, [api, skillId])

  if (state === 'loading') {
    return <p className="skill-snapshot__empty">Loading…</p>
  }
  if (state === 'error') {
    return <p className="skill-snapshot__empty">Could not load this skill.</p>
  }
  if (current === null) {
    return <p className="skill-snapshot__empty">This skill is no longer available.</p>
  }

  const before = versions && versions.length > 0 ? versions[versions.length - 1] : null

  // Backend already confirmed this was an upgrade (receipt.changed said so),
  // but no version history is visible to this principal -- owner-scoped
  // filtering (or a genuine data anomaly), never "never upgraded" (that
  // would contradict what the receipt itself already said happened).
  if (expectedAction === 'upgraded' && !before) {
    return <p className="skill-snapshot__empty">Version history isn't visible for your current account.</p>
  }

  if (!before) {
    // Created: no version history at all -- current full snapshot, every
    // field shown (nothing to diff against).
    return (
      <div className="skill-snapshot">
        <div className="skill-snapshot__meta">
          <span className="skill-snapshot__badge skill-snapshot__badge--created">Created</span>
        </div>
        {DIFF_FIELDS.map(({ key, label }) => (
          <div key={key} className="skill-snapshot__field">
            <div className="skill-snapshot__field-label">{label}</div>
            <div className="skill-snapshot__field-value">{fieldValue(current, key)}</div>
          </div>
        ))}
      </div>
    )
  }

  // Upgraded: version history exists -- "View Updated Skill" always shows
  // the current (After) snapshot; "View Diff" is the additional, optional
  // action that reveals the Before/After comparison, changed fields only.
  const changedFields = DIFF_FIELDS.filter(({ key }) => fieldValue(before.data, key) !== fieldValue(current, key))

  return (
    <div className="skill-snapshot">
      <div className="skill-snapshot__meta">
        <span className="skill-snapshot__badge skill-snapshot__badge--upgraded">Upgraded</span>
        <span className="skill-snapshot__meta-detail">
          Version {versions!.length} · {formatWhen(before.created_at)}
        </span>
      </div>
      {DIFF_FIELDS.map(({ key, label }) => (
        <div key={key} className="skill-snapshot__field">
          <div className="skill-snapshot__field-label">{label}</div>
          <div className="skill-snapshot__field-value">{fieldValue(current, key)}</div>
        </div>
      ))}
      {changedFields.length > 0 && (
        <>
          <button type="button" className="skill-snapshot__diff-toggle" onClick={() => setDiffOpen((prev) => !prev)}>
            {diffOpen ? 'Hide diff ▲' : 'View Diff ▼'}
          </button>
          {diffOpen && (
            <div className="skill-snapshot__diff">
              {changedFields.map(({ key, label }) => (
                <div key={key} className="skill-snapshot__diff-field">
                  <div className="skill-snapshot__field-label">{label}</div>
                  <div className="skill-snapshot__diff-before">− {fieldValue(before.data, key)}</div>
                  <div className="skill-snapshot__diff-after">+ {fieldValue(current, key)}</div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
