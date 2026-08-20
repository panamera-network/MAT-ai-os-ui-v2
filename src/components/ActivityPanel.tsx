import { useEffect, useRef, useState } from 'react'
import type { ChatMessage } from '../hooks/useThink'
import './ActivityPanel.css'

interface ActivityPanelProps {
  online: boolean
  messages: ChatMessage[]
  pending: boolean
  onSend: (text: string) => void
}

/**
 * The one primary activity area: talking to MAT. Purely presentational —
 * conversation state and the actual `/think` call live in `useThink()`
 * (see `screens/HomeScreen.tsx`); this component only renders what it's
 * given and reports intent back via `onSend`.
 */
export function ActivityPanel({ online, messages, pending, onSend }: ActivityPanelProps) {
  const [input, setInput] = useState('')
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight })
  }, [messages, pending])

  const send = () => {
    if (!input.trim() || pending || !online) return
    onSend(input)
    setInput('')
  }

  return (
    <section className="activity-panel">
      <div className="activity-panel__label">MAT Console</div>
      <div className="activity-panel__list" ref={listRef}>
        {messages.length === 0 && (
          <div className="activity-panel__empty">{online ? 'Ask MAT anything.' : 'Waiting for MAT to come online.'}</div>
        )}
        {messages.map((message) => (
          <div key={message.id} className={`activity-message activity-message--${message.role}`}>
            {message.text}
          </div>
        ))}
        {pending && <div className="activity-message activity-message--mat activity-message--pending">Thinking…</div>}
      </div>

      <div className="activity-panel__input-row">
        <input
          className="activity-panel__input"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => event.key === 'Enter' && send()}
          placeholder={online ? 'Ask MAT…' : 'MAT is offline'}
          disabled={!online || pending}
        />
        <button type="button" className="activity-panel__send" onClick={send} disabled={!online || pending || !input.trim()}>
          Send
        </button>
      </div>
    </section>
  )
}
