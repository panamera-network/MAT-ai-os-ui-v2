import type { ConnectionState } from '../hooks/useHealth'
import type { Health } from '../domain/vision'
import './HudStatus.css'

interface HudStatusProps {
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
 * The global `MAT / ONLINE-OFFLINE / MODEL / BODY` identity and health
 * readout — moved here from `PresenceHero` so it lives in the Glass HUD
 * (always visible, independent of whichever canvas view is mounted) instead
 * of inside Presence specifically. Same fields as before, straight from
 * `GET /health`, nothing fabricated; every field reads `'—'` until
 * `connection === 'online'`.
 */
export function HudStatus({ connection, health }: HudStatusProps) {
  const ready = connection === 'online' ? health : null
  const notes = ready ? configNotes(ready) : []

  return (
    <div className="hud-status">
      <div className="hud-status__identity">
        <span className="hud-status__name">MAT</span>
        <span className={`hud-status__connection hud-status__connection--${connection}`}>{CAPTION[connection]}</span>
      </div>
      <div className="hud-status__field">
        <span className="hud-status__field-label">Model</span>
        <span className="hud-status__field-value">{ready ? `${ready.active_model.provider} · ${ready.active_model.model}` : '—'}</span>
      </div>
      <div className="hud-status__field">
        <span className="hud-status__field-label">Body</span>
        <span className="hud-status__field-value">{ready ? bodyLabel(ready) : '—'}</span>
      </div>
      {connection === 'offline' && <span className="hud-status__note">Start the backend to connect.</span>}
      {ready && notes.length > 0 && <span className="hud-status__note hud-status__note--warn">{notes.join(' · ')}</span>}
    </div>
  )
}
