import type { ReactNode } from 'react'
import './GlassHud.css'

interface GlassHudProps {
  header: ReactNode
  left?: ReactNode
  right?: ReactNode
  centerChat?: ReactNode
  /** Batch A: a card's lightweight frosted detail overlay, rendered in the
   * SAME deliberately-empty center cell `centerChat` already floats over —
   * never a new zone, never a new page. `chatMinimized` visually de-
   * emphasizes (not unmounts) `centerChat` while this is present, so
   * closing the detail restores the exact same chat state it had before. */
  centerDetail?: ReactNode
  chatMinimized?: boolean
}

/**
 * The glass HUD overlay — a layer stacked visually above Active Canvas in
 * `AppShell`, never a container around it (see AppShell.tsx: this and
 * `<ActiveCanvas>` are separate siblings, not parent/child). Four fixed
 * zones around a deliberately empty center, so whatever Active Canvas is
 * showing (Presence, Brain View, ...) stays fully visible and unobstructed
 * behind the HUD.
 */
export function GlassHud({ header, left, right, centerChat, centerDetail, chatMinimized }: GlassHudProps) {
  return (
    <div className="glass-hud">
      <div className="glass-hud__header">{header}</div>
      {left && <div className="glass-hud__left">{left}</div>}
      {right && <div className="glass-hud__right">{right}</div>}
      {centerChat && <div className={`glass-hud__chat${chatMinimized ? ' is-minimized' : ''}`}>{centerChat}</div>}
      {centerDetail && <div className="glass-hud__detail">{centerDetail}</div>}
    </div>
  )
}
