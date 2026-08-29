import { useCallback, useEffect, useRef, useState } from 'react'
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
import { WORKFLOW_STATUS_LABEL, workflowBadgeTone } from '../components/CardDetailOverlay'
import type { KnowledgeWorkflowStatus } from '../domain/vision'

/** `workflowBadgeTone`'s 4-way tone (shared with Knowledge Notes/chat
 * receipts) onto `HudEvent`'s own 4-way tone -- a reshape, not a remapping
 * (same semantics: "ok" is the one genuinely-done state, "danger" needs
 * attention, "warning" is in progress, everything else is informational). */
function toHudEventTone(tone: 'ok' | 'warning' | 'danger' | 'muted'): HudEventTone {
  if (tone === 'ok') return 'success'
  if (tone === 'warning') return 'warning'
  if (tone === 'danger') return 'danger'
  return 'info'
}

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
    notifyKnowledgeTransition,
  } = useThink()
  const { voiceState, voiceError, startRecording, stopRecording } = useVoice(send)
  const { speakingId, speak } = useSpeak()
  const [hudEvents, setHudEvents] = useState<HudEvent[]>([])

  // `crypto.randomUUID()` (same scheme `ChatMessage.id` already uses) --
  // collision-proof regardless of how many events land in one tick or one
  // React StrictMode double-invocation, unlike a timestamp+ref-counter pair
  // computed outside the updater (a real `key` collision was observed in
  // dev with that scheme once two knowledge-transition events landed in the
  // same effect pass).
  const addHudEvent = useCallback((message: string, tone: HudEventTone = 'info') => {
    const timestamp = Date.now()
    setHudEvents((current) => [
      { id: crypto.randomUUID(), timestamp, message, tone },
      ...current,
    ].slice(0, 24))
  }, [])

  // Practice/Sparring -> Validate phase: the backend's own analytics event
  // log (`GET /events`, merged into Recent Events by `HudRightPanel`) only
  // ever tracks the "reviewed" transition (`/learn`'s own confirm step) --
  // practicing/validated/ready_for_promotion/needs_relearn/promoted have no
  // backend event of their own (confirmed: no `track_event` call anywhere in
  // `practice_knowledge_note`/`run_knowledge_practice_sweep`/
  // `promote_knowledge_to_skill`). Rather than inventing a backend change for
  // this, this diffs the SAME already-polled Knowledge Notes snapshot
  // (`knowledgeNotes`, shared with the left panel/detail overlay) against its
  // own previous tick, and turns each REAL observed workflow_status change
  // into a Recent Events entry -- genuinely new information this session
  // just saw, never a fabricated or backdated one (the first tick only seeds
  // the baseline; nothing already sitting in a given state when this screen
  // mounted gets announced). "reviewed" is skipped here on purpose -- the
  // backend already announces that one.
  const knowledgeStatusRef = useRef<Map<string, KnowledgeWorkflowStatus> | null>(null)
  useEffect(() => {
    const items = knowledgeNotes.data?.knowledge
    if (!items) return
    const previous = knowledgeStatusRef.current
    if (previous) {
      for (const item of items) {
        const prevStatus = previous.get(item.id)
        if (!prevStatus || prevStatus === item.workflow_status || item.workflow_status === 'reviewed') continue

        // Knowledge Note transition attention pass: `practicing ->
        // ready_for_promotion`/`practicing -> needs_relearn` specifically —
        // the two edges where a human actually needs to do something next
        // (approve a promotion, or re-teach a failed note). These get their
        // own event wording (no domain suffix — the chat notice below names
        // the same note by topic alone) AND a one-shot chat companion
        // notice; every other real transition (e.g. reviewed -> practicing,
        // or -> promoted) keeps the general log entry it already had, so
        // this is additive, never a second event for the same edge.
        if (prevStatus === 'practicing' && (item.workflow_status === 'ready_for_promotion' || item.workflow_status === 'needs_relearn')) {
          const isReady = item.workflow_status === 'ready_for_promotion'
          addHudEvent(
            `${isReady ? 'Ready for Promotion' : 'Needs Relearn'}: ${item.topic}`,
            toHudEventTone(workflowBadgeTone(item.workflow_status)),
          )
          notifyKnowledgeTransition(
            isReady
              ? `Knowledge Note "${item.topic}" is ready for your approval.`
              : `Practice for "${item.topic}" failed — relearn required.`,
          )
          continue
        }

        const suffix = item.domain ? ` in ${item.domain}` : ''
        addHudEvent(
          `${WORKFLOW_STATUS_LABEL[item.workflow_status]} '${item.topic}'${suffix}`,
          toHudEventTone(workflowBadgeTone(item.workflow_status)),
        )
      }
    }
    knowledgeStatusRef.current = new Map(items.map((item) => [item.id, item.workflow_status]))
  }, [knowledgeNotes.data, addHudEvent, notifyKnowledgeTransition])

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
          knowledgeItems={knowledgeNotes.data?.knowledge ?? []}
        />
      }
    >
      <ActiveCanvas view={view} />
    </AppShell>
  )
}
