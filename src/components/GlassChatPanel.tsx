import { useState } from 'react'
import { ActivityPanel } from './ActivityPanel'
import type { AttachedDocument, ChatMessage, DocumentAttachmentState, ThinkActivityKind } from '../hooks/useThink'
import type { VoiceState } from '../hooks/useVoice'
import './GlassChatPanel.css'

interface GlassChatPanelProps {
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
  onStartRecording: () => void
  onStopRecording: () => void
  speakingId: string | null
  onSpeak: (id: string, text: string) => void
  document: AttachedDocument | null
  documentState: DocumentAttachmentState
  documentError: string | null
  onAttachDocument: (file: File) => void
  onRemoveDocument: () => void
}

/** Bottom-center chat, anchored to the bottom and expanding upward. */
export function GlassChatPanel(props: GlassChatPanelProps) {
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
        <ActivityPanel {...props} />
      </div>
    </div>
  )
}
