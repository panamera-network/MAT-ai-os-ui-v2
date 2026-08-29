import { useCallback, useRef, useState } from 'react'
import { AppShell } from '../components/AppShell'
import { TopBar } from '../components/TopBar'
import { ActiveCanvas, type ActiveCanvasView } from '../components/ActiveCanvas'
import { CanvasSwitcher } from '../components/CanvasSwitcher'
import { HudStatus } from '../components/HudStatus'
import { HudLeftPanel } from '../components/HudLeftPanel'
import { HudRightPanel } from '../components/HudRightPanel'
import { GlassChatPanel } from '../components/GlassChatPanel'
import { CardDetailOverlay } from '../components/CardDetailOverlay'
import type { DetailCardId } from '../components/detailCardId'
import { useHealth } from '../hooks/useHealth'
import { useThink } from '../hooks/useThink'
import { useVoice } from '../hooks/useVoice'
import { useSpeak } from '../hooks/useSpeak'
import { useAgents } from '../hooks/useAgents'
import { useLoops } from '../hooks/useLoops'
import { useModels } from '../hooks/useModels'
import { useGovernance } from '../hooks/useGovernance'
import { useMcp } from '../hooks/useMcp'
import { useSkills } from '../hooks/useSkills'
import { useKnowledgeNotes } from '../hooks/useKnowledgeNotes'
import { useBudget } from '../hooks/useBudget'
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
 *
 * Batch A: the six left-panel resource hooks are called HERE, not inside
 * `HudLeftPanel` itself, because `CardDetailOverlay` needs the exact same
 * data when a card is clicked open — lifting the fetch up means both
 * consumers share one poll each, never a second independent fetch per card.
 * `activeDetail` (which card's overlay, if any, is open) lives here too,
 * since it's the one thing `HudLeftPanel` (click source), `GlassChatPanel`
 * (minimizes while a detail is open), and `CardDetailOverlay` all need to
 * agree on.
 */
export function HomeScreen() {
  const [view, setView] = useState<ActiveCanvasView>('presence')
  const { connection, health } = useHealth()
  const agents = useAgents()
  const loops = useLoops()
  const models = useModels()
  const governance = useGovernance()
  const mcp = useMcp()
  const skills = useSkills()
  const knowledgeNotes = useKnowledgeNotes()
  const budget = useBudget()
  const [activeDetail, setActiveDetail] = useState<DetailCardId | null>(null)
  const {
    messages,
    pending,
    activityKind,
    activityStartedAt,
    send,
    sendImage,
    sendLearn,
    document,
    documentState,
    documentError,
    attachDocument,
    removeDocument,
    reset,
  } = useThink()
  const { voiceState, voiceError, startRecording, stopRecording } = useVoice(send)
  const { speakingId, speak } = useSpeak()
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
          <TopBar />
          <HudStatus connection={connection} health={health} />
        </>
      }
      left={
        <>
          <CanvasSwitcher view={view} onChange={setView} />
          <HudLeftPanel
            agents={agents}
            loops={loops}
            models={models}
            governance={governance}
            mcp={mcp}
            skills={skills}
            knowledgeNotes={knowledgeNotes}
            budget={budget}
            health={health}
            onSelect={setActiveDetail}
          />
        </>
      }
      right={<HudRightPanel events={hudEvents} onEvent={addHudEvent} />}
      chatMinimized={activeDetail !== null}
      centerDetail={
        activeDetail && (
          <CardDetailOverlay
            cardId={activeDetail}
            agents={agents}
            loops={loops}
            models={models}
            governance={governance}
            mcp={mcp}
            skills={skills}
            knowledgeNotes={knowledgeNotes}
            budget={budget}
            health={health}
            onClose={() => setActiveDetail(null)}
          />
        )
      }
      centerChat={
        <GlassChatPanel
          online={connection === 'online'}
          messages={messages}
          pending={pending}
          activityKind={activityKind}
          activityStartedAt={activityStartedAt}
          onSend={send}
          onSendImage={sendImage}
          onLearn={sendLearn}
          onReset={reset}
          voiceState={voiceState}
          voiceError={voiceError}
          onStartRecording={startRecording}
          onStopRecording={stopRecording}
          speakingId={speakingId}
          onSpeak={speak}
          document={document}
          documentState={documentState}
          documentError={documentError}
          onAttachDocument={attachDocument}
          onRemoveDocument={removeDocument}
        />
      }
    >
      <ActiveCanvas view={view} />
    </AppShell>
  )
}
