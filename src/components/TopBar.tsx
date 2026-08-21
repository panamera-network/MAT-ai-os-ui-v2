import './TopBar.css'
import type { ConnectionState } from '../hooks/useHealth'

interface TopBarProps {
  connection: ConnectionState
}

const CORE_STATUS: Record<ConnectionState, string> = {
  checking: 'CONNECTING',
  online: 'ONLINE',
  offline: 'OFFLINE',
}

function MatMark() {
  return (
    <svg viewBox="0 0 28 28" width="26" height="26" fill="none" aria-hidden="true">
      <path d="M14 2.5 24 8.2v11.6L14 25.5 4 19.8V8.2L14 2.5Z" stroke="currentColor" strokeWidth="1" />
      <path d="m9 18.5 1.2-9 3.8 5 3.8-5 1.2 9" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
      <circle cx="14" cy="14" r="9" stroke="currentColor" strokeWidth="0.6" strokeDasharray="2 2" opacity="0.55" />
    </svg>
  )
}

function UtilityIcon({ type }: { type: 'alerts' | 'settings' }) {
  if (type === 'alerts') {
    return <svg viewBox="0 0 16 16" width="14" height="14" fill="none"><path d="M3.7 11.2h8.6l-1.1-1.6V6.8A3.2 3.2 0 0 0 8 3.5a3.2 3.2 0 0 0-3.2 3.3v2.8l-1.1 1.6Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/><path d="M6.7 13.1h2.6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>
  }
  return <svg viewBox="0 0 16 16" width="14" height="14" fill="none"><circle cx="8" cy="8" r="2.2" stroke="currentColor" strokeWidth="1.2"/><path d="M8 1.8v1.5M8 12.7v1.5M14.2 8h-1.5M3.3 8H1.8M12.4 3.6l-1.1 1.1M4.7 11.3l-1.1 1.1M12.4 12.4l-1.1-1.1M4.7 4.7 3.6 3.6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>
}

/** Header masthead only. Empty utility positions are intentionally visual
 * placeholders until real controls exist; they have no interaction or data. */
export function TopBar({ connection }: TopBarProps) {
  return (
    <div className="top-bar">
      <div className="top-bar__brand">
        <span className="top-bar__mark"><MatMark /></span>
        <span className="top-bar__name">MAT OS</span>
        <span className="top-bar__build">BUILD —</span>
      </div>
      <div className="top-bar__identity">
        <strong>MAT OS UI</strong>
        <span>MODEL · AUTONOMY · TOOLS</span>
      </div>
      <div className="top-bar__utilities">
        <span className={`top-bar__core-status is-${connection}`} role="status" aria-live="polite">
          <span className="top-bar__core-dot" />
          <span>MAT CORE</span>
          <strong>{CORE_STATUS[connection]}</strong>
        </span>
        <span className="top-bar__utility" aria-hidden="true"><UtilityIcon type="alerts" /></span>
        <span className="top-bar__utility" aria-hidden="true"><UtilityIcon type="settings" /></span>
      </div>
    </div>
  )
}
