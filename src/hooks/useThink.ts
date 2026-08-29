import { useState } from 'react'
import { useVisionApi } from '../app/VisionApiProvider'
import { VisionApiError } from '../adapters/vision'
import type { LearnDecisionSummary, LearnReceipt, LearnResult } from '../domain/vision'

export interface AttachedDocument {
  filename: string
  content: string
  truncated: boolean
}

export type DocumentAttachmentState = 'idle' | 'parsing' | 'ready' | 'error'

export interface ChatMessage {
  id: string
  role: 'user' | 'mat' | 'system'
  text: string
  /** Marks a Learn request/result pair — excluded from `buildContext()`
   * regardless of role, since Learn is a distinct action from normal chat,
   * never something MAT "said" in conversation (see `sendLearn` below). */
  kind?: 'learn'
  /** Present only for a Learn result that carries a real backend receipt —
   * `text` stays just the short status headline in that case (e.g.
   * "📝 Reviewed"); the receipt's own fields carry the rest. Absent entirely
   * (not even `null`) for every other message, and for a Learn result with
   * no receipt — the old flat `text`-only rendering is the fallback. */
  receipt?: LearnReceipt
  /** `LearnResult.skill_id`/`domain` verbatim — the PROPOSED skill target
   * for this Learn result (present only when `status === 'reviewed'`) — not
   * yet written to the registry; see `knowledgeId` below for the one way to
   * find out if/when it actually is. For a multi-skill batch this is the
   * FIRST decision's target only; real per-decision detail lives in
   * `decisions`. Absent (not even `null`) for every message that isn't a
   * reviewed Learn result. */
  skillId?: string | null
  skillDomain?: string | null
  /** `LearnResult.knowledge_id` verbatim — the Knowledge Note this Learn
   * result's gate outcome produced (present only when `status ===
   * 'reviewed'`). `ActivityPanel` cross-references this against the live-
   * polled Knowledge Notes list (never this message's own frozen-at-send-
   * time data) to show the note's CURRENT workflow state, and only reveals
   * View Skill/View Diff once that note has actually reached "promoted". */
  knowledgeId?: string | null
  /** `LearnResult.decisions` verbatim — present only for a genuine
   * multi-decision batch. When present, the receipt renders one row per
   * decision (each with its own `knowledge_id`-driven live status) INSTEAD
   * of the single skillId/knowledgeId-based path above. */
  decisions?: LearnDecisionSummary[] | null
}

/** Which in-flight request `pending` refers to — a real, known fact (which
 * adapter method is currently awaited), never a guessed sub-step. `null`
 * whenever `pending` is false. Backing `activityStartedAt` is a real
 * `Date.now()` timestamp, used only to render an honest elapsed-time
 * counter — never a simulated/ticking progress bar. */
export type ThinkActivityKind = 'think' | 'see' | 'learn' | null

interface UseThinkResult {
  messages: ChatMessage[]
  pending: boolean
  /** Which request is in flight right now (`null` when `pending` is false) —
   * see `ThinkActivityKind`. */
  activityKind: ThinkActivityKind
  /** `Date.now()` when the in-flight request started, `null` when idle. */
  activityStartedAt: number | null
  send: (text: string) => Promise<void>
  /** `/see` — the only existing upload/vision contract (images only, no
   * generic file-processing route exists). Shares `pending`/`messages` with
   * `send()` so an image turn can't overlap a think turn and both render in
   * one conversation. Never carries `context` — `SeeRequest` has no such
   * field; `/see` is a separate capability from `/think`, not a context-aware
   * chat turn. */
  sendImage: (prompt: string, images: File[]) => Promise<void>
  /** Explicit, user-invoked learning only — the ONLY caller of `/learn` in
   * this app; normal `send()` above never touches it. Shares `pending` so a
   * Learn turn can't overlap a think/see turn. Both the request and result
   * messages carry `kind: 'learn'` so they never leak into a later
   * `/think` call's context (see `buildContext()`) — Learn is a distinct
   * action/result pair, not organic conversation. */
  sendLearn: (content: string) => Promise<void>
  /** The currently-attached document (PDF/TXT/MD/CSV), if any — parsed via
   * `POST /read` immediately on attach (never deferred to Send, unlike
   * images), then folded into every subsequent `send()` call's `context`
   * until removed or `reset()`. Session-scoped only: nothing here is ever
   * persisted or passed to `/learn` automatically. */
  document: AttachedDocument | null
  documentState: DocumentAttachmentState
  documentError: string | null
  /** Parses `file` via `/read` and, on success, makes it part of this
   * conversation's context from this point on. Replaces any previously
   * attached document (one document attachment at a time, matching the
   * existing single-image-attachment UI). Images are never valid here --
   * the caller is expected to route those to `sendImage` instead; if one
   * slips through, the real `/read` 415 becomes this attachment's error
   * state, same honest-error handling as any other rejection. */
  attachDocument: (file: File) => Promise<void>
  /** Clears the attached document without touching conversation messages
   * or MAT's own memory -- the inverse of `attachDocument`, not a `reset()`. */
  removeDocument: () => void
  /** Clears visible messages (and therefore `buildContext()`'s bounded
   * history, since it's derived live from `messages`) and any attached
   * document — session-only, never touches MAT's own long-term memory or
   * calls any backend deletion. A skill `/learn` actually applied lives in
   * MAT's own skill registry, not in this component's state, so it's
   * untouched by this. */
  reset: () => void
}

/** Mandatory Knowledge Note gate: "reviewed" means the gate passed, NOT that
 * a skill was created/upgraded/learned — that only ever happens later, via a
 * human `POST /knowledge/{id}/promote` (see `ChatMessage.knowledgeId`). The
 * label says exactly that and nothing more; `receipt.changed` (backend text,
 * rendered verbatim) carries the honest "reviewed, pending promotion: X"
 * detail. */
const LEARN_STATUS_LABEL: Record<LearnResult['status'], string> = {
  reviewed: '📝 Reviewed',
  pending_approval: '⏳ Pending approval',
  rejected: 'Learn rejected',
  failed: 'Learn failed',
}

/** `text` is always the short status headline ("📝 Reviewed", never the
 * skill_id/domain/reason parenthetical the old fallback-only shape used) --
 * the real detail lives in `receipt` (`changed` already says "reviewed,
 * pending promotion: X"). `receipt` is omitted entirely (not `null`) when
 * the backend didn't send one, so the old flat text -- skill_id/domain/
 * reason folded into one line, exactly as before this batch -- is the
 * fallback for that case only. */
function formatLearnResult(result: LearnResult): { text: string; receipt?: LearnReceipt } {
  const headline = LEARN_STATUS_LABEL[result.status]
  if (!result.receipt) {
    const parts = [headline]
    if (result.skill_id) parts.push(`(${result.skill_id}${result.domain ? ` · ${result.domain}` : ''})`)
    if (result.reason) parts.push(`— ${result.reason}`)
    return { text: parts.join(' ') }
  }
  return { text: headline, receipt: result.receipt }
}

/** Real bug found via live testing: every `/think` call sent only `{ text }`
 * — MAT had zero awareness of anything said earlier in the same chat, even
 * though `Reasoning.think()` (MAT-AI-OS-V2) already accepts a `context`
 * string for exactly this ("conversation history... a caller hands it in
 * already assembled" — its own docstring). These two constants bound how
 * much of that history gets sent: whichever limit is hit first wins, no
 * summarization, no persistence beyond this component's own session state. */
const MAX_CONTEXT_MESSAGES = 10
const MAX_CONTEXT_CHARS = 4000

/** Bounds how much of an attached document's already-extracted text (itself
 * already capped server-side, see `/read`'s own MAX_EXTRACTED_CHARS) rides
 * along in every subsequent `/think` call while it stays attached -- no
 * chunking or relevant-section selection exists in the current architecture
 * to pick a smaller, more targeted slice, so this is a flat cap: the
 * document's own beginning, truncated, never a full 8000-char dump on every
 * single turn regardless of what's actually being asked. */
const MAX_DOCUMENT_CONTEXT_CHARS = 3000

const CONTEXT_ROLE_LABEL: Record<'user' | 'mat', string> = { user: 'User', mat: 'MAT' }

/** Plain-text transcript of recent turns, in the shape `Reasoning.
 * compose_system_prompt()` expects for `context` — never the message
 * currently being sent (that stays the request's own `text`), and never a
 * `system` entry (this app's own error/failure text, not real conversation
 * content MAT ever said or heard). Trims from the oldest end, one whole
 * line at a time, if still over the char budget after the message-count
 * cap — a half-cut sentence is a worse context than one fewer full turn. */
function buildContext(history: ChatMessage[]): string {
  const turns = history.filter(
    (message): message is ChatMessage & { role: 'user' | 'mat' } =>
      (message.role === 'user' || message.role === 'mat') && message.kind !== 'learn',
  )
  const lines = turns.slice(-MAX_CONTEXT_MESSAGES).map((message) => `${CONTEXT_ROLE_LABEL[message.role]}: ${message.text}`)
  let context = lines.join('\n')
  while (lines.length > 0 && context.length > MAX_CONTEXT_CHARS) {
    lines.shift()
    context = lines.join('\n')
  }
  return context
}

/** Plain-text block for an attached document, in the same "caller hands it
 * in already assembled" shape `context` already uses -- truncated to
 * `MAX_DOCUMENT_CONTEXT_CHARS` regardless of the server's own (larger)
 * extraction cap, since this rides along on EVERY turn while attached, not
 * just once. */
function buildDocumentContext(document: AttachedDocument | null): string {
  if (!document) return ''
  const content = document.content.slice(0, MAX_DOCUMENT_CONTEXT_CHARS)
  return `Attached document "${document.filename}":\n${content}`
}

/** Owns one `/think` conversation's state — message list, in-flight state,
 * and error-to-message translation. Kept separate from `ActivityPanel` so
 * that component stays purely presentational (data/callbacks in via props,
 * no adapter calls of its own), matching components/README.md. */
export function useThink(): UseThinkResult {
  const api = useVisionApi()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [pending, setPending] = useState(false)
  const [activityKind, setActivityKind] = useState<ThinkActivityKind>(null)
  const [activityStartedAt, setActivityStartedAt] = useState<number | null>(null)
  const [document, setDocument] = useState<AttachedDocument | null>(null)
  const [documentState, setDocumentState] = useState<DocumentAttachmentState>('idle')
  const [documentError, setDocumentError] = useState<string | null>(null)

  const send = async (text: string) => {
    const trimmed = text.trim()
    if (!trimmed || pending) return
    // Built from history as of *before* this turn -- the new user message
    // is never its own context. Document context (if any) comes first --
    // background reference material, then the specific recent exchange.
    const conversationContext = buildContext(messages)
    const documentContext = buildDocumentContext(document)
    const context = [documentContext, conversationContext].filter(Boolean).join('\n\n')
    setMessages((prev) => [...prev, { id: crypto.randomUUID(), role: 'user', text: trimmed }])
    setPending(true)
    setActivityKind('think')
    setActivityStartedAt(Date.now())
    try {
      const result = await api.think(context ? { text: trimmed, context } : { text: trimmed })
      setMessages((prev) => [...prev, { id: crypto.randomUUID(), role: 'mat', text: result.response }])
    } catch (err) {
      const detail = err instanceof VisionApiError ? err.detail : 'Something went wrong.'
      setMessages((prev) => [...prev, { id: crypto.randomUUID(), role: 'system', text: detail }])
    } finally {
      setPending(false)
      setActivityKind(null)
      setActivityStartedAt(null)
    }
  }

  const sendImage = async (prompt: string, images: File[]) => {
    if (images.length === 0 || pending) return
    const trimmedPrompt = prompt.trim() || 'Describe this image.'
    const label = images.length === 1 ? images[0].name : `${images.length} images`
    setMessages((prev) => [...prev, { id: crypto.randomUUID(), role: 'user', text: `📎 ${label} — ${trimmedPrompt}` }])
    setPending(true)
    setActivityKind('see')
    setActivityStartedAt(Date.now())
    try {
      const result = await api.see({ prompt: trimmedPrompt, images })
      setMessages((prev) => [...prev, { id: crypto.randomUUID(), role: 'mat', text: result.response }])
    } catch (err) {
      const detail = err instanceof VisionApiError ? err.detail : 'Something went wrong.'
      setMessages((prev) => [...prev, { id: crypto.randomUUID(), role: 'system', text: detail }])
    } finally {
      setPending(false)
      setActivityKind(null)
      setActivityStartedAt(null)
    }
  }

  const sendLearn = async (content: string) => {
    const trimmed = content.trim()
    if (!trimmed || pending) return
    // An attached document folds into `context` exactly like conversation
    // history does -- Reasoning.compose_system_prompt()'s own "retrieved
    // memory... caller hands it in already assembled" contract covers this
    // honestly (LearnRequest.context is the SAME field /learn already
    // accepts), never a second, invented "evidence" field.
    const context = [buildDocumentContext(document), buildContext(messages)].filter(Boolean).join('\n\n')
    setMessages((prev) => [...prev, { id: crypto.randomUUID(), role: 'user', text: `📚 Learn: ${trimmed}`, kind: 'learn' }])
    setPending(true)
    setActivityKind('learn')
    setActivityStartedAt(Date.now())
    try {
      const result = await api.learn(context ? { content: trimmed, context } : { content: trimmed })
      const role = result.status === 'rejected' || result.status === 'failed' ? 'system' : 'mat'
      const { text, receipt } = formatLearnResult(result)
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(), role, text, kind: 'learn', receipt,
          skillId: result.skill_id, skillDomain: result.domain, knowledgeId: result.knowledge_id, decisions: result.decisions,
        },
      ])
    } catch (err) {
      const detail = err instanceof VisionApiError ? err.detail : 'Something went wrong.'
      setMessages((prev) => [...prev, { id: crypto.randomUUID(), role: 'system', text: detail, kind: 'learn' }])
    } finally {
      setPending(false)
      setActivityKind(null)
      setActivityStartedAt(null)
    }
  }

  const attachDocument = async (file: File) => {
    setDocumentState('parsing')
    setDocumentError(null)
    try {
      const result = await api.readDocument(file)
      setDocument({ filename: result.filename, content: result.content, truncated: result.truncated })
      setDocumentState('ready')
    } catch (err) {
      const detail = err instanceof VisionApiError ? err.detail : 'Could not read this file.'
      setDocument(null)
      setDocumentError(detail)
      setDocumentState('error')
    }
  }

  const removeDocument = () => {
    setDocument(null)
    setDocumentState('idle')
    setDocumentError(null)
  }

  const reset = () => {
    if (pending) return
    setMessages([])
    removeDocument()
  }

  return {
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
  }
}
