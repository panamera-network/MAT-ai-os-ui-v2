import { MatPresence, type MatPresenceState } from '@panamera-network/mat-presence-orb'
import { PresenceHero } from '../PresenceHero'
import { useHealth, type ConnectionState } from '../../hooks/useHealth'
import './MatPresenceView.css'

/**
 * Our only state signal today (`useHealth()`'s connection state) mapped onto
 * the package's five-state vocabulary. `listening`/`speaking` stay unused
 * until a real voice pipeline exists — mapping them to something now would
 * be inventing a signal we don't have, not "no new features."
 */
const CONNECTION_TO_PRESENCE_STATE: Record<ConnectionState, MatPresenceState> = {
  checking: 'thinking',
  online: 'idle',
  offline: 'error',
}

/**
 * The MAT Presence canvas view — today's default. Owns its own data (the
 * health poll, used only to drive the orb's visual state) so `ActiveCanvas`
 * never has to know what any given view needs. Renders the
 * `@panamera-network/mat-presence-orb` package's `MatPresence`, wrapped in
 * `PresenceHero` purely for centering — identity/readout chrome now lives in
 * the Glass HUD (`HudStatus`) instead, fed by `HomeScreen`'s own health poll.
 */
export function MatPresenceView() {
  const { connection } = useHealth()

  return (
    <PresenceHero
      orb={
        <div className="mat-presence-view__orb-frame">
          {/* No real audio/activity signal exists yet (voice pipeline, agent
              activity) — 0 is the honest value, not an invented pulse. */}
          <MatPresence state={CONNECTION_TO_PRESENCE_STATE[connection]} audioLevel={0} activityLevel={0} />
        </div>
      }
    />
  )
}
