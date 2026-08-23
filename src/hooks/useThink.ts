import { useState } from 'react'
import { useVisionApi } from '../app/VisionApiProvider'
import { VisionApiError } from '../adapters/vision'

export interface ChatMessage {
  id: string
  role: 'user' | 'mat' | 'system'
  text: string
}

interface UseThinkResult {
  messages: ChatMessage[]
  pending: boolean
  send: (text: string) => Promise<void>
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
    (message): message is ChatMessage & { role: 'user' | 'mat' } => message.role === 'user' || message.role === 'mat',
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

  return { messages, pending, send }
}
