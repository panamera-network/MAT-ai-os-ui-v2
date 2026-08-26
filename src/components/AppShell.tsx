import type { ReactNode } from 'react'
import { ChamberBackground } from './ChamberBackground'
import { GlassHud } from './GlassHud'
import './AppShell.css'

interface AppShellProps {
  header: ReactNode
  left?: ReactNode
  right?: ReactNode
  centerChat?: ReactNode
  /** Batch A: passed straight through to `GlassHud` — see its own docstring. */
  centerDetail?: ReactNode
  chatMinimized?: boolean
  children: ReactNode
}

/**
 * The persistent full-window HUD frame — three stacked layers, in order:
 * `ChamberBackground` (locked, decorative), the Active Canvas layer
 * (`children`), and `GlassHud` on top. The HUD overlays Active Canvas; it
 * never wraps or contains it — they're siblings here, not parent/child, so
 * Active Canvas always renders full-bleed underneath whatever the HUD shows.
 */
export function AppShell({ header, left, right, centerChat, centerDetail, chatMinimized, children }: AppShellProps) {
  return (
    <div className="hud-shell">
      <ChamberBackground />
      <span className="hud-shell__corner hud-shell__corner--tl" aria-hidden="true" />
      <span className="hud-shell__corner hud-shell__corner--tr" aria-hidden="true" />
      <span className="hud-shell__corner hud-shell__corner--bl" aria-hidden="true" />
      <span className="hud-shell__corner hud-shell__corner--br" aria-hidden="true" />
      <main className="hud-shell__canvas-layer">{children}</main>
      <GlassHud header={header} left={left} right={right} centerChat={centerChat} centerDetail={centerDetail} chatMinimized={chatMinimized} />
    </div>
  )
}
