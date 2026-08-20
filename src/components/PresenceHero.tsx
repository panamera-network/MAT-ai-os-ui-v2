import type { ConnectionState } from '../hooks/useHealth'
import type { Health } from '../domain/vision'
import { PresenceOrb } from './PresenceOrb'
import './PresenceHero.css'

interface PresenceHeroProps {
  connection: ConnectionState
  health: Health | null
}

const CAPTION: Record<ConnectionState, string> = {
  checking: 'CONNECTING…',
  online: 'ONLINE',
  offline: 'OFFLINE',
}

function bodyLabel(health: Health): string {
  const { body } = health
  if (!body.body_attached) return 'not attached'
  if (!body.running) return 'stopped'
  if (body.degraded.length > 0) return `running · degraded (${body.degraded.join(', ')})`
  return 'running'
}

/** Only surfaces what's actually unconfigured — a healthy backend shows no
 * note at all, matching "core health/status" rather than an exhaustive
 * checklist of things that are fine. */
function configNotes(health: Health): string[] {
  const notes: string[] = []
  if (!health.degraded.llm_provider_configured) notes.push('LLM not configured')
  if (!health.degraded.stt_configured) notes.push('speech-to-text not configured')
  if (!health.degraded.tts_configured) notes.push('text-to-speech not configured')
  return notes
}

/**
 * MAT presence — the hero of this screen. The orb is the visual centerpiece;
 * the two flanking readouts and the caption are the entire "core
 * health/status" surface, all real fields from `GET /health`, never
 * fabricated metrics. Every field is `'—'` until `connection === 'online'`.
 */
export function PresenceHero({ connection, health }: PresenceHeroProps) {
  // Narrowed once here so every usage below gets a real `Health`, not a
  // `Health | null` a reader has to re-check — `null` whenever we're not
  // actually online, regardless of whether a stale `health` value lingers.
  const ready = connection === 'online' ? health : null
  const notes = ready ? configNotes(ready) : []

  return (
    <div className="presence-hero">
      <div className="presence-hero__readout presence-hero__readout--left">
        <span className="presence-hero__readout-label">Model</span>
        <span className="presence-hero__readout-value">{ready ? `${ready.active_model.provider} · ${ready.active_model.model}` : '—'}</span>
      </div>

      <div className="presence-hero__core">
        <PresenceOrb connection={connection} />
        <div className="presence-hero__identity">
          <span className="presence-hero__name">MAT</span>
          <span className={`presence-hero__caption presence-hero__caption--${connection}`}>{CAPTION[connection]}</span>
          {connection === 'offline' && <span className="presence-hero__note">Start the backend to connect.</span>}
          {ready && notes.length > 0 && <span className="presence-hero__note presence-hero__note--warn">{notes.join(' · ')}</span>}
        </div>
      </div>

      <div className="presence-hero__readout presence-hero__readout--right">
        <span className="presence-hero__readout-label">Body</span>
        <span className="presence-hero__readout-value">{ready ? bodyLabel(ready) : '—'}</span>
      </div>
    </div>
  )
}
