import { useState } from 'react'
import { useVisionApi } from '../app/VisionApiProvider'
import { VisionApiError } from '../adapters/vision'
import type { LearnResult } from '../domain/vision'

export interface ChatMessage {
  id: string
  role: 'user' | 'mat' | 'system'
  text: string
  /** Marks a Learn request/result pair — excluded from `buildContext()`
   * regardless of role, since Learn is a distinct action from normal chat,
   * never something MAT "said" in conversation (see `sendLearn` below). */
  kind?: 'learn'
}

interface UseThinkResult {
  messages: ChatMessage[]
  pending: boolean
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
  /** Clears visible messages (and therefore `buildContext()`'s bounded
   * history, since it's derived live from `messages`) — session-only, never
   * touches MAT's own long-term memory or calls any backend deletion. A
   * skill `/learn` actually applied lives in MAT's own skill registry, not
   * in this component's state, so it's untouched by this. */
  reset: () => void
}

const LEARN_STATUS_LABEL: Record<LearnResult['status'], string> = {
  learned: '✅ Learned',
  pending_approval: '⏳ Pending approval',
  rejected: 'Learn rejected',
  failed: 'Learn failed',
}

function formatLearnResult(result: LearnResult): string {
  const parts = [LEARN_STATUS_LABEL[result.status]]
  if (result.skill_id) parts.push(`(${result.skill_id}${result.domain ? ` · ${result.domain}` : ''})`)
  if (result.reason) parts.push(`— ${result.reason}`)
  return parts.join(' ')
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

/** Owns one `/think` conversation's state — message list, in-flight state,
 * and error-to-message translation. Kept separate from `ActivityPanel` so
 * that component stays purely presentational (data/callbacks in via props,
 * no adapter calls of its own), matching components/README.md. */
export function useThink(): UseThinkResult {
  const api = useVisionApi()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [pending, setPending] = useState(false)

  const send = async (text: string) => {
    const trimmed = text.trim()
    if (!trimmed || pending) return
    // Built from history as of *before* this turn -- the new user message
    // is never its own context.
    const context = buildContext(messages)
    setMessages((prev) => [...prev, { id: crypto.randomUUID(), role: 'user', text: trimmed }])
    setPending(true)
    try {
      const result = await api.think(context ? { text: trimmed, context } : { text: trimmed })
      setMessages((prev) => [...prev, { id: crypto.randomUUID(), role: 'mat', text: result.response }])
    } catch (err) {
      const detail = err instanceof VisionApiError ? err.detail : 'Something went wrong.'
      setMessages((prev) => [...prev, { id: crypto.randomUUID(), role: 'system', text: detail }])
    } finally {
      setPending(false)
    }
  }

  const sendImage = async (prompt: string, images: File[]) => {
    if (images.length === 0 || pending) return
    const trimmedPrompt = prompt.trim() || 'Describe this image.'
    const label = images.length === 1 ? images[0].name : `${images.length} images`
    setMessages((prev) => [...prev, { id: crypto.randomUUID(), role: 'user', text: `📎 ${label} — ${trimmedPrompt}` }])
    setPending(true)
    try {
      const result = await api.see({ prompt: trimmedPrompt, images })
      setMessages((prev) => [...prev, { id: crypto.randomUUID(), role: 'mat', text: result.response }])
    } catch (err) {
      const detail = err instanceof VisionApiError ? err.detail : 'Something went wrong.'
      setMessages((prev) => [...prev, { id: crypto.randomUUID(), role: 'system', text: detail }])
    } finally {
      setPending(false)
    }
  }

  const sendLearn = async (content: string) => {
    const trimmed = content.trim()
    if (!trimmed || pending) return
    const context = buildContext(messages)
    setMessages((prev) => [...prev, { id: crypto.randomUUID(), role: 'user', text: `📚 Learn: ${trimmed}`, kind: 'learn' }])
    setPending(true)
    try {
      const result = await api.learn(context ? { content: trimmed, context } : { content: trimmed })
      const role = result.status === 'rejected' || result.status === 'failed' ? 'system' : 'mat'
      setMessages((prev) => [...prev, { id: crypto.randomUUID(), role, text: formatLearnResult(result), kind: 'learn' }])
    } catch (err) {
      const detail = err instanceof VisionApiError ? err.detail : 'Something went wrong.'
      setMessages((prev) => [...prev, { id: crypto.randomUUID(), role: 'system', text: detail, kind: 'learn' }])
    } finally {
      setPending(false)
    }
  }

  const reset = () => {
    if (pending) return
    setMessages([])
  }

  return { messages, pending, send, sendImage, sendLearn, reset }
}
