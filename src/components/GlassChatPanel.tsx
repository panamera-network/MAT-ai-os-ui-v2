import { useState } from 'react'
import { ActivityPanel } from './ActivityPanel'
import type { ChatMessage } from '../hooks/useThink'
import './GlassChatPanel.css'

interface GlassChatPanelProps {
  online: boolean
  messages: ChatMessage[]
  pending: boolean
  onSend: (text: string) => void
}

/**
 * The Glass HUD's bottom-center chat zone. Owns only expand/collapse state;
 * `ActivityPanel` itself is untouched and still owns message rendering and
 * the input row.
 */
export function GlassChatPanel({ online, messages, pending, onSend }: GlassChatPanelProps) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="glass-chat-panel">
      {/* One fixed handle for both directions — only the chevron flips, so
          it never reads as two different controls appearing/disappearing. */}
      <button
        type="button"
        className="glass-chat-panel__toggle"
        onClick={() => setExpanded((prev) => !prev)}
        aria-expanded={expanded}
        aria-label={expanded ? 'Collapse chat' : 'Expand chat'}
      >
        {expanded ? '▾' : '▴'}
      </button>
      <div className={`glass-chat-panel__body${expanded ? ' is-expanded' : ''}`}>
        <ActivityPanel online={online} messages={messages} pending={pending} onSend={onSend} />
      </div>
    </div>
  )
}
