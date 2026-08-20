import type { ReactNode } from 'react'
import { ChamberBackground } from './ChamberBackground'
import './AppShell.css'

interface AppShellProps {
  header: ReactNode
  children: ReactNode
}

/**
 * The persistent full-window HUD frame: a wireframe chamber backdrop, one
 * header strip (identity + connection chrome), and one content region. No
 * sidebar, no tab rail — "MAT is a presence, not a dashboard." Deliberately
 * structural only beyond the backdrop (no data fetching, no nav items) so it
 * can host future screens without carrying today's Home-specific content;
 * there is nothing to navigate to yet, so nothing is added here beyond this
 * one persistent header.
 */
export function AppShell({ header, children }: AppShellProps) {
  return (
    <div className="hud-shell">
      <ChamberBackground />
      <span className="hud-shell__corner hud-shell__corner--tl" aria-hidden="true" />
      <span className="hud-shell__corner hud-shell__corner--tr" aria-hidden="true" />
      <span className="hud-shell__corner hud-shell__corner--bl" aria-hidden="true" />
      <span className="hud-shell__corner hud-shell__corner--br" aria-hidden="true" />
      <header className="hud-shell__header">{header}</header>
      <main className="hud-shell__content">{children}</main>
    </div>
  )
}
