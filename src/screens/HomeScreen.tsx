import { useCallback, useRef, useState } from 'react'
import { AppShell } from '../components/AppShell'
import { TopBar } from '../components/TopBar'
import { ActiveCanvas, type ActiveCanvasView } from '../components/ActiveCanvas'
import { CanvasSwitcher } from '../components/CanvasSwitcher'
import { HudStatus } from '../components/HudStatus'
import { HudLeftPanel } from '../components/HudLeftPanel'
import { HudRightPanel } from '../components/HudRightPanel'
import { GlassChatPanel } from '../components/GlassChatPanel'
import { useHealth } from '../hooks/useHealth'
import { useThink } from '../hooks/useThink'
import type { HudEvent, HudEventTone } from '../components/hudEvents'

/**
 * The one screen this HUD starts with: MAT presence as the Active Canvas
 * layer (today's only registered view — see components/ActiveCanvas.tsx),
 * with the Glass HUD overlaid on top (header status, left view switcher/info zone,
 * right control zone, bottom-center chat). Skills is the one real data group
 * from docs/V2_DATA_SURFACE.md not surfaced anywhere yet.
 *
 * `view` state lives here (not in `ActiveCanvas` or `CanvasSwitcher`) since
 * it's the one thing both need to share; `CanvasSwitcher` is a temporary
 * left-zone stand-in until a real navigation system exists.
 *
 * `useHealth()` here (separate from `MatPresenceView`'s own call) feeds
 * `HudStatus` and `ActivityPanel`'s online/offline gating — each caller owns
 * its own poll, same pattern as every other canvas-view's data.
 */
export function HomeScreen() {
  const [view, setView] = useState<ActiveCanvasView>('presence')
  const { connection, health } = useHealth()
  const { messages, pending, send } = useThink()
  const [hudEvents, setHudEvents] = useState<HudEvent[]>([])
  const eventSequence = useRef(0)

  const addHudEvent = useCallback((message: string, tone: HudEventTone = 'info') => {
    eventSequence.current += 1
    const timestamp = Date.now()
    setHudEvents((current) => [
      { id: `${timestamp}-${eventSequence.current}`, timestamp, message, tone },
      ...current,
    ].slice(0, 24))
  }, [])

  return (
    <AppShell
      header={
        <>
          <TopBar connection={connection} />
          <HudStatus connection={connection} health={health} />
        </>
      }
      left={
        <>
          <CanvasSwitcher view={view} onChange={setView} />
          <HudLeftPanel />
        </>
      }
      right={<HudRightPanel events={hudEvents} onEvent={addHudEvent} />}
      centerChat={
        <GlassChatPanel
          online={connection === 'online'}
          messages={messages}
          pending={pending}
          onSend={send}
        />
      }
    >
      <ActiveCanvas view={view} />
    </AppShell>
  )
}
