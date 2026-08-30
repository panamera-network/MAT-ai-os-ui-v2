import { useEffect, useRef, useState } from 'react'
import type { KnowledgeItem, LearnDecisionSummary, LearnReceipt } from '../domain/vision'
import type { AttachedDocument, ChatMessage, DocumentAttachmentState, ThinkActivityKind } from '../hooks/useThink'
import type { VoiceState } from '../hooks/useVoice'
import { SkillSnapshotPanel } from './SkillSnapshotPanel'
import { WORKFLOW_STATUS_LABEL, workflowBadgeTone } from './CardDetailOverlay'
import './ActivityPanel.css'

interface ActivityPanelProps {
  online: boolean
  messages: ChatMessage[]
  pending: boolean
  activityKind: ThinkActivityKind
  activityStartedAt: number | null
  onSend: (text: string) => void
  onSendImage: (prompt: string, images: File[]) => void
  onLearn: (content: string) => void
  onReset: () => void
  voiceState: VoiceState
  voiceError: string | null
  voiceErrorSeverity: 'error' | 'info'
  onStartRecording: () => void
  onStopRecording: () => void
  speakingId: string | null
  onSpeak: (id: string, text: string) => void
  document: AttachedDocument | null
  documentState: DocumentAttachmentState
  documentError: string | null
  onAttachDocument: (file: File) => void
  onRemoveDocument: () => void
  /** The same live-polled `GET /knowledge` snapshot `HudLeftPanel`/
   * `CardDetailOverlay` already show (`useKnowledgeNotes()`, lifted in
   * `HomeScreen`) — never a second fetch of this component's own. A Learn
   * receipt's `knowledgeId` is looked up here so the chat bubble always
   * reflects a note's CURRENT workflow state (it may have moved on to
   * practicing/promoted since the message was created), not the status
   * frozen at the moment `/learn` returned. */
  knowledgeItems: KnowledgeItem[]
}

/** One truthful label per real in-flight request kind — never a simulated
 * sub-step. No backend event stream exists for `/think`/`/see`/`/learn`
 * today (all three are single request/response calls, confirmed by reading
 * `useThink.ts` and the API layer) — a label naming the endpoint that's
 * genuinely in flight is honest; claiming a specific internal phase
 * ("Checking security…" at a moment we can't actually verify that's
 * happening) would not be. See `/learn`'s own real pipeline (fetch -> security
 * -> quality -> relevance -> apply, all server-side with no client-visible
 * progress) for why "Reviewing with governance…" — true for the WHOLE
 * request — is as specific as this can honestly get without inventing a
 * signal the backend doesn't send. */
const ACTIVITY_LABEL: Record<Exclude<ThinkActivityKind, null>, string> = {
  think: 'MAT is thinking…',
  see: 'Analyzing image…',
  learn: 'Reviewing with governance…',
}

/** "8s" / "1m 12s" — a real, measured duration (now - startedAt), never a
 * simulated/ticking progress estimate. */
function formatElapsed(elapsedMs: number): string {
  const totalSeconds = Math.max(0, Math.floor(elapsedMs / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`
}

/** Renders in the exact spot the old static "Thinking…" bubble used to —
 * ticks once a second only to keep the elapsed-time display current, never
 * to advance a fake step. Unmounts (and its interval with it) the instant
 * `pending` goes false, since it's only ever rendered while `activityKind`
 * is non-null. */
function PendingActivity({ kind, startedAt }: { kind: Exclude<ThinkActivityKind, null>; startedAt: number }) {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  return (
    <div className="activity-message activity-message--mat activity-message--pending">
      {ACTIVITY_LABEL[kind]}
      <span className="activity-panel__elapsed">{formatElapsed(now - startedAt)}</span>
    </div>
  )
}

/** Plain-text rendition of a Learning Receipt, for Copy only — never shown
 * raw in the UI itself (that's `LearnReceiptView` below). `changed` is
 * rendered exactly as the backend sent it, never re-derived here. */
function buildFullReceiptText(headline: string, receipt: LearnReceipt): string {
  const lines = [headline]
  if (receipt.found) lines.push(`Found: ${receipt.found}`)
  if (receipt.learned) lines.push(`Learned: ${receipt.learned}`)
  if (receipt.changed) lines.push(`Changed: ${receipt.changed}`)
  if (receipt.why) lines.push(`Why: ${receipt.why}`)
  if (receipt.source) lines.push(`Source: ${receipt.source}`)
  return lines.join('\n')
}

/** A "reviewed" decision's own knowledge note, looked up by id in the live
 * poll — `undefined` until the next Knowledge Notes poll tick catches up
 * (never a guess at its state in the meantime). Every other decision status
 * has no knowledge note to look up at all (`knowledge_id` is only ever set
 * on "reviewed"). */
function findKnowledgeNote(knowledgeId: string | null | undefined, knowledgeItems: KnowledgeItem[]): KnowledgeItem | undefined {
  if (!knowledgeId) return undefined
  return knowledgeItems.find((item) => item.id === knowledgeId)
}

/** Only meaningful once a note has actually reached "promoted" — the skill
 * registry write itself (`promote_knowledge_to_skill`) is the only place
 * that decides create vs. improve, so this reads the note's own recorded
 * `skill_payload.action`, never re-derived from receipt text. */
function knowledgeExpectedAction(note: KnowledgeItem | undefined): 'created' | 'upgraded' | null {
  const action = note?.skill_payload?.action
  if (action === 'improve') return 'upgraded'
  if (action === 'create' || action === 'new_domain') return 'created'
  return null
}

/** Static label/tone for a decision with no knowledge note to look up yet —
 * either it's not "reviewed" at all (ignored/pending/failed/not_applied), or
 * it is but the next Knowledge Notes poll tick hasn't caught up. "reviewed"
 * intentionally shares `workflowBadgeTone`'s own "muted" for a freshly
 * reviewed note (see `CardDetailOverlay.tsx`) — clearing the gate is real,
 * but never rendered as the "done" green reserved for ready/promoted. */
const DECISION_STATUS_LABEL: Record<LearnDecisionSummary['status'], string> = {
  reviewed: 'Reviewed',
  ignored: 'Ignored',
  pending: 'Pending',
  failed: 'Failed',
  not_applied: 'Not applied',
}

function decisionFallbackTone(status: LearnDecisionSummary['status']): 'ok' | 'warning' | 'danger' | 'muted' {
  if (status === 'pending') return 'warning'
  if (status === 'failed') return 'danger'
  return 'muted'
}

/**
 * Compact Learning Receipt — `headline` (the short status line) plus
 * `changed` shown inline (the one fact users most want at a glance, in the
 * backend's own exact words), with Found/Learned/Why/Source behind an
 * expandable toggle so a short receipt stays compact and a long one doesn't
 * force its way into view. Every value here is rendered verbatim from the
 * backend — nothing here computes or guesses any of it.
 */

/**
 * One row in a multi-skill Learning Receipt — a single decision's real
 * outcome (`LearnDecisionSummary`, structured, never parsed out of
 * `changed`'s own text). A "reviewed" row with a `knowledge_id` shows that
 * note's CURRENT live workflow_status (Reviewed/Practicing/Ready for
 * Promotion/Needs Relearn/Promoted) instead of its frozen-at-send-time
 * status — "View Skill" only ever appears once that note has actually
 * reached "promoted". `ignored`/`pending`/`failed`/`not_applied` rows have no
 * knowledge note at all, so they show only their static status and reason.
 */
function SkillDecisionRow({ decision, knowledgeItems }: { decision: LearnDecisionSummary; knowledgeItems: KnowledgeItem[] }) {
  const [skillOpen, setSkillOpen] = useState(false)
  const label = decision.name || decision.skill_id || decision.action || 'pattern'
  const note = decision.status === 'reviewed' ? findKnowledgeNote(decision.knowledge_id, knowledgeItems) : undefined
  const tone = note ? workflowBadgeTone(note.workflow_status) : decisionFallbackTone(decision.status)
  const badgeLabel = note ? WORKFLOW_STATUS_LABEL[note.workflow_status] : DECISION_STATUS_LABEL[decision.status]
  const promoted = note?.workflow_status === 'promoted'
  const expectedAction = knowledgeExpectedAction(note)
  const reason = note ? (note.workflow_status === 'needs_relearn' ? note.workflow_reason : null) : decision.reason

  return (
    <div className="activity-message__decision-row">
      <div className="activity-message__decision-row-header">
        <span className={`activity-message__decision-badge activity-message__decision-badge--${tone}`}>{badgeLabel}</span>
        <span className="activity-message__decision-row-label">{label}</span>
      </div>
      {reason && <div className="activity-message__decision-row-reason">{reason}</div>}
      {promoted && note?.promoted_skill_id && (
        <>
          <button type="button" className="activity-message__receipt-toggle" onClick={() => setSkillOpen((prev) => !prev)}>
            {skillOpen ? 'Hide skill ▲' : 'View Skill ▼'}
          </button>
          {skillOpen && <SkillSnapshotPanel skillId={note.promoted_skill_id} expectedAction={expectedAction} />}
        </>
      )}
    </div>
  )
}

function LearnReceiptView({
  headline,
  receipt,
  knowledgeId,
  decisions,
  knowledgeItems,
}: {
  headline: string
  receipt: LearnReceipt
  /** `ChatMessage.knowledgeId` — the Knowledge Note this Learn result's gate
   * outcome produced. Absent/null for a rejected/pending/failed result, or a
   * Learn response with no receipt at all. Ignored when `decisions` (below)
   * is present. */
  knowledgeId?: string | null
  /** `ChatMessage.decisions` — present only for a genuine multi-decision
   * batch; renders one row per decision instead of the single
   * knowledgeId-based path below. */
  decisions?: LearnDecisionSummary[] | null
  knowledgeItems: KnowledgeItem[]
}) {
  const [expanded, setExpanded] = useState(false)
  const [skillOpen, setSkillOpen] = useState(false)
  const hasDetails = Boolean(receipt.found || receipt.learned || receipt.why || receipt.source)
  const hasDecisions = Boolean(decisions && decisions.length > 0)

  // Single-decision path only — a genuine multi-decision batch looks each
  // one up individually inside `SkillDecisionRow` instead.
  const note = hasDecisions ? undefined : findKnowledgeNote(knowledgeId, knowledgeItems)
  const promoted = note?.workflow_status === 'promoted'
  const expectedAction = knowledgeExpectedAction(note)

  return (
    <div className="activity-message__receipt">
      <div className="activity-message__receipt-headline">{headline}</div>
      {receipt.changed && (
        <div className="activity-message__receipt-line">
          <strong>Changed:</strong> {receipt.changed}
        </div>
      )}
      {hasDetails && (
        <>
          <button type="button" className="activity-message__receipt-toggle" onClick={() => setExpanded((prev) => !prev)}>
            {expanded ? 'Hide learning details ▲' : 'View learning details ▼'}
          </button>
          {expanded && (
            <div className="activity-message__receipt-details">
              {receipt.found && (
                <div className="activity-message__receipt-line">
                  <strong>Found:</strong> {receipt.found}
                </div>
              )}
              {receipt.learned && (
                <div className="activity-message__receipt-line">
                  <strong>Learned:</strong> {receipt.learned}
                </div>
              )}
              {receipt.why && (
                <div className="activity-message__receipt-line">
                  <strong>Why:</strong> {receipt.why}
                </div>
              )}
              {receipt.source && (
                <div className="activity-message__receipt-line">
                  <strong>Source:</strong> {receipt.source}
                </div>
              )}
            </div>
          )}
        </>
      )}
      {hasDecisions ? (
        <div className="activity-message__decisions">
          {decisions!.map((decision, index) => (
            // No stable id of its own -- skill_id/action + index is fine (order never changes for a given message).
            <SkillDecisionRow
              key={`${decision.skill_id ?? decision.action ?? 'pattern'}-${index}`}
              decision={decision}
              knowledgeItems={knowledgeItems}
            />
          ))}
        </div>
      ) : (
        note && (
          <>
            <div className="activity-message__decision-row-header">
              <span className={`activity-message__decision-badge activity-message__decision-badge--${workflowBadgeTone(note.workflow_status)}`}>
                {WORKFLOW_STATUS_LABEL[note.workflow_status]}
              </span>
            </div>
            {note.workflow_status === 'needs_relearn' && note.workflow_reason && (
              <div className="activity-message__decision-row-reason">{note.workflow_reason}</div>
            )}
          </>
        )
      )}
      {!hasDecisions && promoted && note?.promoted_skill_id && (
        <>
          <button type="button" className="activity-message__receipt-toggle" onClick={() => setSkillOpen((prev) => !prev)}>
            {skillOpen ? 'Hide skill ▲' : 'View Skill ▼'}
          </button>
          {skillOpen && <SkillSnapshotPanel skillId={note.promoted_skill_id} expectedAction={expectedAction} />}
        </>
      )}
    </div>
  )
}

/**
 * The one primary activity area: talking to MAT. Purely presentational —
 * conversation state and every real API call live in `useThink`/`useVoice`/
 * `useSpeak` (see `screens/HomeScreen.tsx`); this component only renders what
 * it's given and reports intent back via callbacks.
 */
export function ActivityPanel({
  online,
  messages,
  pending,
  activityKind,
  activityStartedAt,
  onSend,
  onSendImage,
  onLearn,
  onReset,
  voiceState,
  voiceError,
  voiceErrorSeverity,
  onStartRecording,
  onStopRecording,
  speakingId,
  onSpeak,
  document: attachedDocument,
  documentState,
  documentError,
  onAttachDocument,
  onRemoveDocument,
  knowledgeItems,
}: ActivityPanelProps) {
  const [input, setInput] = useState('')
  const [attachment, setAttachment] = useState<File | null>(null)
  // Local, UI-only: /read's parsing state doesn't carry a filename until it
  // succeeds, but the chip needs to show ONE the whole time it's parsing.
  const [parsingFilename, setParsingFilename] = useState<string | null>(null)
  // Local, UI-only: which MAT bubble just got copied, for the brief "Copied"
  // label — never persisted, never affects `messages` itself.
  const [copiedId, setCopiedId] = useState<string | null>(null)
  // Sticky mode toggle (not a one-shot action anymore): while on, the same
  // Send button/Enter key routes to `onLearn` instead of `onSend`, and stays
  // on until explicitly turned off (or "New chat" resets it) — never
  // auto-resets after one message.
  const [learnMode, setLearnMode] = useState(false)
  const listRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const copiedTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight })
  }, [messages, pending])

  useEffect(() => {
    if (documentState !== 'parsing') setParsingFilename(null)
  }, [documentState])

  useEffect(() => () => {
    if (copiedTimeoutRef.current) clearTimeout(copiedTimeoutRef.current)
  }, [])

  const copyMessage = (id: string, text: string) => {
    navigator.clipboard.writeText(text).then(
      () => {
        setCopiedId(id)
        if (copiedTimeoutRef.current) clearTimeout(copiedTimeoutRef.current)
        copiedTimeoutRef.current = setTimeout(() => setCopiedId(null), 1500)
      },
      () => {
        // Clipboard access can be denied (permissions, insecure context) —
        // silently no-op rather than showing a false "Copied".
      },
    )
  }

  const busy = pending || voiceState === 'transcribing'
  const documentReady = documentState === 'ready' && attachedDocument !== null

  const send = () => {
    if (pending || !online) return
    if (learnMode) {
      // Learn stays text-only (unchanged restriction) -- an attachment
      // present while Learn mode is on just blocks Send, same as the old
      // dedicated Learn button did; it does not silently fall back to a
      // normal Send.
      if (!input.trim() || attachment) return
      onLearn(input)
    } else if (attachment) {
      onSendImage(input, [attachment])
      setAttachment(null)
    } else {
      if (!input.trim()) return
      onSend(input)
    }
    setInput('')
  }

  const pickFile = () => fileInputRef.current?.click()

  const onFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null
    event.target.value = ''
    if (!file) return
    if (file.type.startsWith('image/')) {
      // One attachment slot: picking an image replaces any attached document.
      onRemoveDocument()
      setAttachment(file)
      return
    }
    // Not an image -- route to /read regardless of extension. A file this
    // picker's own `accept` hint didn't anticipate still gets the real,
    // honest server rejection (see documentError below) rather than a
    // client-guessed "unsupported" message.
    setAttachment(null)
    setParsingFilename(file.name)
    onAttachDocument(file)
  }

  const toggleMic = () => {
    if (!online || pending) return
    if (voiceState === 'recording') onStopRecording()
    else if (voiceState === 'idle' || voiceState === 'error') void onStartRecording()
  }

  const placeholder = !online
    ? 'MAT is offline'
    : voiceState === 'recording'
      ? 'Listening…'
      : voiceState === 'transcribing'
        ? 'Transcribing…'
        : learnMode
          ? 'Teach MAT this content…'
          : 'Type your command or instruction for MAT…'

  return (
    <section className="activity-panel">
      <header className="activity-panel__header">
        <div className="activity-panel__brand">
          <span className="activity-panel__terminal-mark" aria-hidden="true">
            <svg viewBox="0 0 16 16" width="12" height="12" fill="none">
              <rect x="1.5" y="2" width="13" height="12" rx="1.5" stroke="currentColor" />
              <path d="m4.5 6 2 2-2 2M8.5 10h3" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          <span>MAT Console</span>
        </div>
        <div className="activity-panel__header-right">
          <button
            type="button"
            className="activity-panel__new-chat"
            onClick={() => {
              onReset()
              setLearnMode(false)
            }}
            disabled={pending || messages.length === 0}
            aria-label="New chat"
            title="Clear this conversation (MAT's own memory is untouched)"
          >
            New chat
          </button>
          <span className={`activity-panel__link-state${online ? ' is-online' : ''}`}>
            <span className="activity-panel__link-dot" aria-hidden="true" />
            {online ? 'Linked' : 'Offline'}
          </span>
        </div>
      </header>

      <div className="activity-panel__conversation">
        <div className="activity-panel__avatar" aria-hidden="true">M</div>
        <div className="activity-panel__list" ref={listRef}>
          {messages.length === 0 && (
            <div className="activity-panel__empty">
              <strong>{online ? 'MAT OS online.' : 'MAT OS offline.'}</strong>
              <span>{online ? 'How can I assist you today?' : 'Waiting for MAT to come online.'}</span>
            </div>
          )}
          {messages.map((message) => {
            // Copy stays available on a Learn receipt even when governance
            // rejected/failed it (role 'system') -- everywhere else, Copy
            // stays 'mat'-only, unchanged. Speak is never extended to
            // system messages (unchanged from before this batch).
            const canCopy = message.role === 'mat' || (message.role === 'system' && message.kind === 'learn')
            const canSpeak = message.role === 'mat'
            const copyText = message.receipt ? buildFullReceiptText(message.text, message.receipt) : message.text
            // A Knowledge Note transition notice is a companion aside, not
            // an error -- it never takes the red `--system` treatment
            // (reserved for real failures), just its own subtle style.
            const roleClass = message.kind === 'knowledge-notice' ? 'notice' : message.role
            return (
              <div key={message.id} className={`activity-message activity-message--${roleClass}`}>
                {message.receipt ? (
                  <LearnReceiptView
                    headline={message.text}
                    receipt={message.receipt}
                    knowledgeId={message.knowledgeId}
                    decisions={message.decisions}
                    knowledgeItems={knowledgeItems}
                  />
                ) : (
                  message.text
                )}
                {(canCopy || canSpeak) && (
                  <span className="activity-message__actions">
                    {canCopy && (
                      <button
                        type="button"
                        className="activity-message__copy"
                        onClick={() => copyMessage(message.id, copyText)}
                        aria-label="Copy response"
                        title="Copy response"
                      >
                        {copiedId === message.id ? 'Copied' : '⧉'}
                      </button>
                    )}
                    {canSpeak && (
                      <button
                        type="button"
                        className={`activity-message__speak${speakingId === message.id ? ' is-speaking' : ''}`}
                        onClick={() => onSpeak(message.id, message.text)}
                        disabled={speakingId !== null && speakingId !== message.id}
                        aria-label="Speak this reply"
                        title="Speak this reply"
                      >
                        ▶
                      </button>
                    )}
                  </span>
                )}
              </div>
            )
          })}
          {activityKind && activityStartedAt && <PendingActivity kind={activityKind} startedAt={activityStartedAt} />}
        </div>
      </div>

      {(attachment || documentState !== 'idle' || voiceError) && (
        <div className="activity-panel__status-row">
          {attachment && (
            <span className="activity-panel__chip">
              📎 {attachment.name}
              <button type="button" onClick={() => setAttachment(null)} aria-label="Remove attachment">
                ×
              </button>
            </span>
          )}
          {documentState === 'parsing' && (
            <span className="activity-panel__chip activity-panel__chip--pending">📄 {parsingFilename} — Parsing…</span>
          )}
          {documentReady && attachedDocument && (
            <span className="activity-panel__chip">
              📄 {attachedDocument.filename}
              {attachedDocument.truncated && ' (truncated)'}
              <button type="button" onClick={onRemoveDocument} aria-label="Remove document">
                ×
              </button>
            </span>
          )}
          {documentState === 'error' && documentError && (
            <span className="activity-panel__chip activity-panel__chip--error">
              📄 {documentError}
              <button type="button" onClick={onRemoveDocument} aria-label="Dismiss">
                ×
              </button>
            </span>
          )}
          {voiceError && (
            <span className={`activity-panel__voice-error${voiceErrorSeverity === 'info' ? ' activity-panel__voice-error--info' : ''}`}>
              {voiceError}
            </span>
          )}
        </div>
      )}

      <div className="activity-panel__tools-row">
        <input ref={fileInputRef} type="file" accept="image/*,.pdf,.txt,.md,.csv" hidden onChange={onFileChange} />
        <button
          type="button"
          className={`activity-panel__tool-btn${learnMode ? ' is-active' : ''}`}
          onClick={() => setLearnMode((prev) => !prev)}
          disabled={!online || pending}
          aria-pressed={learnMode}
          aria-label={learnMode ? 'Learn mode on — click to switch back to Send' : 'Turn on Learn mode'}
          title={
            learnMode
              ? 'Learn mode is on — Send now teaches MAT this content (governance review) instead of a normal reply. Click to turn off.'
              : 'Turn on Learn mode: Send will explicitly teach MAT this content (goes through governance review) instead of a normal reply.'
          }
        >
          📚 Learn
        </button>
        <button
          type="button"
          className="activity-panel__tool-btn"
          onClick={pickFile}
          disabled={!online || pending || documentState === 'parsing'}
          aria-label="Attach an image or document"
          title="Attach an image (Vision) or a document (PDF/TXT/MD/CSV)"
        >
          📎 Attach
        </button>
      </div>

      <div className="activity-panel__command-row">
        <div className={`activity-panel__input-shell${learnMode ? ' is-learn-mode' : ''}`}>
          <span className="activity-panel__prompt-mark" aria-hidden="true">{learnMode ? '📚' : '›'}</span>
          <input
            className="activity-panel__input"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => event.key === 'Enter' && send()}
            placeholder={placeholder}
            disabled={!online || busy}
          />
          <button
            type="button"
            className="activity-panel__send activity-panel__send--inline"
            onClick={send}
            disabled={!online || pending || (learnMode ? !input.trim() || Boolean(attachment) : !input.trim() && !attachment)}
            aria-label={learnMode ? 'Teach MAT' : 'Send'}
          >
            <svg viewBox="0 0 16 16" width="13" height="13" fill="none" aria-hidden="true">
              <path d="m2.2 3.1 11.7-1-4.8 11.1-1.7-4.7-5.2-1.7 3.6-1.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
        <button
          type="button"
          className={`activity-panel__mic${voiceState === 'recording' ? ' is-recording' : ''}`}
          onClick={toggleMic}
          disabled={!online || pending || voiceState === 'transcribing'}
          aria-label={voiceState === 'recording' ? 'Stop recording' : 'Record voice message (push-to-talk)'}
          title={voiceState === 'recording' ? 'Stop recording' : 'Record voice message (push-to-talk)'}
        >
          {voiceState === 'transcribing' ? '…' : '●'}
        </button>
      </div>

      <footer className="activity-panel__footer">
        <span>{learnMode ? 'Press Enter to teach MAT' : 'Press Enter to send'}</span>
        <span className={`activity-panel__mode${learnMode ? ' is-learn' : ''}`}>{learnMode ? 'Learn mode' : 'Command mode'}</span>
      </footer>
    </section>
  )
}
