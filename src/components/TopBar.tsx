import './TopBar.css'

/**
 * Minimal, quiet chrome — just the product mark. Presence and connection
 * status live in `PresenceHero` now, not duplicated up here; there's nothing
 * else to navigate to yet, so this stays a brand mark, not a nav bar.
 */
export function TopBar() {
  return (
    <div className="top-bar">
      <span className="top-bar__name">
        MAT<span className="top-bar__suffix">·OS</span>
      </span>
    </div>
  )
}
