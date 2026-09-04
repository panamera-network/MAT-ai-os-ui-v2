import { useState } from 'react'
import type { UseHealthResult } from '../../hooks/useHealth'
import { useSoul } from '../../hooks/useSoul'
import { describeResourceStatus } from '../../hooks/useVisionResource'
import './IAmMatCanvas.css'

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null
  return (
    <div className="iammat-canvas__field">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

/** A faculty's own `configured` sub-signals -- zero, one, or two real flags,
 * never invented ones. Soul carries none (no `soul_configured` field
 * exists); Intelligence/Reasoning both genuinely share the one real
 * `llm_provider_configured` flag (the backend has no per-faculty split);
 * Vision has its own; Voice has two (STT and TTS are independently
 * configurable). */
function FacultyRow({ name, ready, configured }: { name: string; ready: boolean; configured: Array<{ label: string; value: boolean }> }) {
  return (
    <div className="iammat-canvas__faculty-row">
      <span className={`iammat-canvas__faculty-dot is-${ready ? 'ready' : 'unavailable'}`} aria-hidden="true" />
      <span className="iammat-canvas__faculty-name">{name}</span>
      <span className={`iammat-canvas__faculty-state is-${ready ? 'ready' : 'unavailable'}`}>{ready ? 'Ready' : 'Unavailable'}</span>
      {configured.length > 0 && (
        <span className="iammat-canvas__faculty-configured">
          {configured.map((flag) => (
            <span key={flag.label} className={`iammat-canvas__configured-chip is-${flag.value ? 'on' : 'off'}`}>
              {flag.label}: {flag.value ? 'yes' : 'no'}
            </span>
          ))}
        </span>
      )}
    </div>
  )
}

interface IAmMatCanvasProps {
  healthResource: UseHealthResult
}

/**
 * The "I AM MAT" canvas view — identity/faculty inspection, never a
 * dashboard. Every value rendered here comes straight from a real backend
 * field (`GET /health`'s `faculties`/`degraded`/`active_model`, `GET
 * /soul`'s `soul_prompt`/`response_styles`/`safety_rules`/`active_style`
 * plus its nested real `identity`) — a field that isn't present is simply
 * never rendered (see `Field` above), never replaced with a placeholder or
 * a guess. `healthResource` is `HomeScreen`'s own already-polled
 * `useHealth()` result, passed down through `ActiveCanvas` — this view
 * never opens a second poll of the same endpoint. `useSoul()` is its own
 * glance-and-load fetch (same convention `BrainViewCanvas`'s own data
 * already uses): this view isn't always mounted, so no poll.
 *
 * Deliberately NOT a model-management surface -- no capability/tier
 * registry, no provider/model assignment form, no budget/usage breakdown.
 * Those stay exactly where they already are, the Models modal
 * (`CardDetailOverlay`, `cardId: 'models'`) -- this view shows only the
 * single already-active model as a read-only glance, tied to the
 * Intelligence faculty.
 */
export function IAmMatCanvas({ healthResource }: IAmMatCanvasProps) {
  const soul = useSoul()
  const [showSoulPrompt, setShowSoulPrompt] = useState(false)
  const [showSafetyRules, setShowSafetyRules] = useState(false)

  const { health, connection, error } = healthResource
  const healthStatus = describeResourceStatus({ data: health, loading: connection === 'checking', error })
  const soulStatus = describeResourceStatus(soul)

  const identity = soul.data?.soul.identity
  const soulInfo = soul.data?.soul
  const responseStyleEntries = soulInfo ? Object.entries(soulInfo.response_styles) : []

  return (
    <div className="iammat-canvas">
      <div className="iammat-canvas__scroll">
        <header className="iammat-canvas__header">
          <h1>I AM MAT</h1>
          {identity && (
            <p className="iammat-canvas__subtitle">
              {identity.name}
              {identity.nickname ? ` · ${identity.nickname}` : ''}
            </p>
          )}
        </header>

        <section className="iammat-canvas__panel">
          <h2>Identity</h2>
          {!identity ? (
            <span className="iammat-canvas__empty">{soulStatus ?? 'No identity data.'}</span>
          ) : (
            <div className="iammat-canvas__field-grid">
              <Field label="Name" value={identity.name} />
              <Field label="Nickname" value={identity.nickname} />
              <Field label="Persona" value={identity.persona} />
              <Field label="Active mode" value={identity.active_mode} />
              <Field label="Language" value={identity.language} />
              <Field label="Timezone" value={identity.timezone} />
              <Field label="Profession" value={identity.profession.length > 0 ? identity.profession.join(', ') : null} />
              <Field label="Active projects" value={identity.active_projects.length > 0 ? identity.active_projects.join(', ') : null} />
              <Field label="Short-term goals" value={identity.goals.short_term.length > 0 ? identity.goals.short_term.join(', ') : null} />
              <Field label="Long-term goals" value={identity.goals.long_term.length > 0 ? identity.goals.long_term.join(', ') : null} />
              <Field label="Communication style" value={identity.preferences.communication_style} />
              <Field label="Work hours" value={identity.preferences.work_hours} />
            </div>
          )}
        </section>

        <section className="iammat-canvas__panel">
          <h2>Soul</h2>
          {!soulInfo ? (
            <span className="iammat-canvas__empty">{soulStatus ?? 'No soul data.'}</span>
          ) : (
            <>
              <div className="iammat-canvas__field-grid">
                <Field label="Active style" value={soulInfo.active_style} />
              </div>
              {responseStyleEntries.length > 0 && (
                <div className="iammat-canvas__field-grid">
                  {responseStyleEntries.map(([styleName, styleValue]) => (
                    <Field key={styleName} label={styleName} value={styleValue} />
                  ))}
                </div>
              )}
              {soulInfo.soul_prompt && (
                <button type="button" className="iammat-canvas__toggle" onClick={() => setShowSoulPrompt((current) => !current)} aria-expanded={showSoulPrompt}>
                  {showSoulPrompt ? 'Hide soul prompt' : 'View soul prompt'}
                </button>
              )}
              {showSoulPrompt && soulInfo.soul_prompt && <p className="iammat-canvas__text-block">{soulInfo.soul_prompt}</p>}
              {soulInfo.safety_rules && (
                <button type="button" className="iammat-canvas__toggle" onClick={() => setShowSafetyRules((current) => !current)} aria-expanded={showSafetyRules}>
                  {showSafetyRules ? 'Hide safety rules' : 'View safety rules'}
                </button>
              )}
              {showSafetyRules && soulInfo.safety_rules && <p className="iammat-canvas__text-block">{soulInfo.safety_rules}</p>}
            </>
          )}
        </section>

        <section className="iammat-canvas__panel">
          <h2>Faculties</h2>
          {!health ? (
            <span className="iammat-canvas__empty">{healthStatus ?? 'No faculty data.'}</span>
          ) : (
            <>
              <div className="iammat-canvas__faculty-list">
                <FacultyRow name="Soul" ready={health.faculties.soul} configured={[]} />
                <FacultyRow
                  name="Intelligence"
                  ready={health.faculties.intelligence}
                  configured={[{ label: 'LLM provider configured', value: health.degraded.llm_provider_configured }]}
                />
                <FacultyRow
                  name="Reasoning"
                  ready={health.faculties.reasoning}
                  configured={[{ label: 'LLM provider configured', value: health.degraded.llm_provider_configured }]}
                />
                <FacultyRow
                  name="Vision"
                  ready={health.faculties.vision}
                  configured={[{ label: 'Vision configured', value: health.degraded.vision_configured }]}
                />
                <FacultyRow
                  name="Voice"
                  ready={health.faculties.voice}
                  configured={[
                    { label: 'STT configured', value: health.degraded.stt_configured },
                    { label: 'TTS configured', value: health.degraded.tts_configured },
                  ]}
                />
              </div>
              <p className="iammat-canvas__caption">Configuration checks are best-effort presence checks, not confirmed reachability.</p>
            </>
          )}
        </section>

        {health?.active_model && (
          <section className="iammat-canvas__panel">
            <h2>Active Model</h2>
            <div className="iammat-canvas__field-grid">
              <Field label="Provider" value={health.active_model.provider} />
              <Field label="Model" value={health.active_model.model} />
            </div>
          </section>
        )}
      </div>
    </div>
  )
}
