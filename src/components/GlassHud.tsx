import type { ReactNode } from 'react'
import './GlassHud.css'

interface GlassHudProps {
  header: ReactNode
  left?: ReactNode
  right?: ReactNode
  centerChat?: ReactNode
}

/**
 * The glass HUD overlay — a layer stacked visually above Active Canvas in
 * `AppShell`, never a container around it (see AppShell.tsx: this and
 * `<ActiveCanvas>` are separate siblings, not parent/child). Four fixed
 * zones around a deliberately empty center, so whatever Active Canvas is
 * showing (Presence, Brain View, ...) stays fully visible and unobstructed
 * behind the HUD.
 */
export function GlassHud({ header, left, right, centerChat }: GlassHudProps) {
  return (
    <div className="glass-hud">
      <div className="glass-hud__header">{header}</div>
      {left && <div className="glass-hud__left">{left}</div>}
      {right && <div className="glass-hud__right">{right}</div>}
      {centerChat && <div className="glass-hud__chat">{centerChat}</div>}
    </div>
  )
}
