import type { ReactNode } from 'react'
import './PresenceHero.css'

interface PresenceHeroProps {
  /** The orb visual itself — this component only centers it. Identity
   * (`MAT`/connection caption) and the model/body readouts that used to live
   * here now render in the Glass HUD instead (see `components/HudStatus.tsx`
   * and `screens/HomeScreen.tsx`), since they're global status, not
   * Presence-specific chrome. */
  orb: ReactNode
}

/** MAT presence — just the orb, centered. See `PresenceHeroProps.orb`. */
export function PresenceHero({ orb }: PresenceHeroProps) {
  return <div className="presence-hero">{orb}</div>
}
