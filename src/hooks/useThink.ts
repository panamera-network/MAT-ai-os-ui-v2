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
    setMessages((prev) => [...prev, { id: crypto.randomUUID(), role: 'user', text: trimmed }])
    setPending(true)
    try {
      const result = await api.think({ text: trimmed })
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
