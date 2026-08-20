import { useState } from 'react'
import { AppShell } from '../components/AppShell'
import { TopBar } from '../components/TopBar'
import { ActiveCanvas, type ActiveCanvasView } from '../components/ActiveCanvas'
import { CanvasSwitcher } from '../components/CanvasSwitcher'

// ActivityPanel (chat console) stays hidden from render for now — orb only.
// useThink() and the component itself are untouched; restore by re-adding:
//   import { ActivityPanel } from '../components/ActivityPanel'
//   import { useThink } from '../hooks/useThink'
// and rendering <ActivityPanel online={...} messages={...} pending={...} onSend={...} />
// inside <AppShell>, below <ActiveCanvas>, as before.

/**
 * The one screen this HUD starts with: MAT presence as the hero, mounted
 * via `ActiveCanvas` (today's only registered view — see
 * components/ActiveCanvas.tsx), and one primary activity area (talking to
 * MAT) beneath it. Agents/memory/governance/MCP/skills/models are
 * deliberately not screens yet — see docs/V2_DATA_SURFACE.md for what
 * exists to build toward.
 *
 * `view` state lives here (not in `ActiveCanvas` or `CanvasSwitcher`) since
 * it's the one thing both need to share; `CanvasSwitcher` is a temporary
 * header-only stand-in until a real navigation system exists.
 */
export function HomeScreen() {
  const [view, setView] = useState<ActiveCanvasView>('presence')

  return (
    <AppShell
      header={
        <>
          <TopBar />
          <CanvasSwitcher view={view} onChange={setView} />
        </>
      }
    >
      <ActiveCanvas view={view} />
    </AppShell>
  )
}
