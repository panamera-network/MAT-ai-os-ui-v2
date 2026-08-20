import type { ConnectionState } from '../hooks/useHealth'
import './PresenceOrb.css'

interface PresenceOrbProps {
  connection: ConnectionState
}

const TICK_COUNT = 24

/**
 * MAT's hero presence mark — a technical instrument-style emblem (bezel
 * ticks, concentric rings, a glowing core), not a literal status readout.
 * Color, glow, and motion all derive from `connection`; every visual state
 * has a calm, deliberate rendering rather than a generic spinner.
 */
export function PresenceOrb({ connection }: PresenceOrbProps) {
  return (
    <svg className={`presence-orb presence-orb--${connection}`} viewBox="0 0 200 200" width="240" height="240" aria-hidden="true">
      <defs>
        <radialGradient id="presence-orb-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.85" />
          <stop offset="65%" stopColor="currentColor" stopOpacity="0.25" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
        </radialGradient>
      </defs>

      <circle cx="100" cy="100" r="98" className="presence-orb__ambient" fill="url(#presence-orb-glow)" />

      <g className="presence-orb__ticks">
        {Array.from({ length: TICK_COUNT }, (_, i) => (
          <line
            key={i}
            x1="100"
            y1="8"
            x2="100"
            y2="16"
            transform={`rotate(${(i / TICK_COUNT) * 360} 100 100)`}
            className="presence-orb__tick"
          />
        ))}
      </g>

      <circle cx="100" cy="100" r="86" className="presence-orb__ring presence-orb__ring--outer" />

      <g className="presence-orb__rotor">
        <circle cx="100" cy="100" r="66" className="presence-orb__ring presence-orb__ring--mid" strokeDasharray="4 9" />
      </g>

      <circle cx="100" cy="100" r="46" className="presence-orb__ring presence-orb__ring--inner" />
      <circle cx="100" cy="100" r="32" className="presence-orb__core" />
      <text x="100" y="108" textAnchor="middle" className="presence-orb__mark">
        M
      </text>
    </svg>
  )
}
