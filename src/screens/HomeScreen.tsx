import { AppShell } from '../components/AppShell'
import { TopBar } from '../components/TopBar'

// PresenceHero (orb + health readouts) and ActivityPanel (chat console) are
// temporarily hidden from render — reviewing the ChamberBackground alone.
// Both components, and the useHealth()/useThink() hooks that fed them, are
// untouched; restore by re-adding:
//   import { PresenceHero } from '../components/PresenceHero'
//   import { ActivityPanel } from '../components/ActivityPanel'
//   import { useHealth } from '../hooks/useHealth'
//   import { useThink } from '../hooks/useThink'
// and rendering them inside <AppShell> as before.

/**
 * The one screen this HUD starts with: MAT presence as the hero (identity +
 * core health/status together, around the presence orb), and one primary
 * activity area (talking to MAT) beneath it. Agents/memory/governance/MCP/
 * skills/models are deliberately not screens yet — see
 * docs/V2_DATA_SURFACE.md for what exists to build toward.
 */
export function HomeScreen() {
  return <AppShell header={<TopBar />}>{null}</AppShell>
}
