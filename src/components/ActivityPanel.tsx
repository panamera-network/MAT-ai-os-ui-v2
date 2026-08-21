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
        <span className={`activity-panel__link-state${online ? ' is-online' : ''}`}>
          <span className="activity-panel__link-dot" aria-hidden="true" />
          {online ? 'Linked' : 'Offline'}
        </span>
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
          {messages.map((message) => (
            <div key={message.id} className={`activity-message activity-message--${message.role}`}>
              {message.text}
            </div>
          ))}
          {pending && <div className="activity-message activity-message--mat activity-message--pending">Thinking…</div>}
        </div>
      </div>

      <div className="activity-panel__command-row">
        <div className="activity-panel__input-shell">
          <span className="activity-panel__prompt-mark" aria-hidden="true">›</span>
          <input
            className="activity-panel__input"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => event.key === 'Enter' && send()}
            placeholder={online ? 'Type your command or instruction for MAT…' : 'MAT is offline'}
            disabled={!online || pending}
          />
        </div>
        <button
          type="button"
          className="activity-panel__send"
          onClick={send}
          disabled={!online || pending || !input.trim()}
          aria-label="Send"
        >
          <svg viewBox="0 0 16 16" width="15" height="15" fill="none" aria-hidden="true">
            <path d="m2.2 3.1 11.7-1-4.8 11.1-1.7-4.7-5.2-1.7 3.6-1.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>

      <footer className="activity-panel__footer">
        <span>Press Enter to send</span>
        <span className="activity-panel__mode">Command mode</span>
      </footer>
    </section>
  )
}
