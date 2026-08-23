import { useEffect, useRef, useState } from 'react'
import type { AttachedDocument, ChatMessage, DocumentAttachmentState } from '../hooks/useThink'
import type { VoiceState } from '../hooks/useVoice'
import './ActivityPanel.css'

interface ActivityPanelProps {
  online: boolean
  messages: ChatMessage[]
  pending: boolean
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
  onSend,
  onSendImage,
  onLearn,
  onReset,
  voiceState,
  voiceError,
  onStartRecording,
  onStopRecording,
  speakingId,
  onSpeak,
  document: attachedDocument,
  documentState,
  documentError,
  onAttachDocument,
  onRemoveDocument,
}: ActivityPanelProps) {
  const [input, setInput] = useState('')
  const [attachment, setAttachment] = useState<File | null>(null)
  // Local, UI-only: /read's parsing state doesn't carry a filename until it
  // succeeds, but the chip needs to show ONE the whole time it's parsing.
  const [parsingFilename, setParsingFilename] = useState<string | null>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight })
  }, [messages, pending])

  useEffect(() => {
    if (documentState !== 'parsing') setParsingFilename(null)
  }, [documentState])

  const busy = pending || voiceState === 'transcribing'
  const documentReady = documentState === 'ready' && attachedDocument !== null

  const send = () => {
    if (pending || !online) return
    if (attachment) {
      onSendImage(input, [attachment])
      setAttachment(null)
    } else {
      if (!input.trim()) return
      onSend(input)
    }
    setInput('')
  }

  const learn = () => {
    if (pending || !online || !input.trim() || attachment) return
    onLearn(input)
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
            onClick={onReset}
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
          {messages.map((message) => (
            <div key={message.id} className={`activity-message activity-message--${message.role}`}>
              {message.text}
              {message.role === 'mat' && (
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
            </div>
          ))}
          {pending && <div className="activity-message activity-message--mat activity-message--pending">Thinking…</div>}
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
          {voiceError && <span className="activity-panel__voice-error">{voiceError}</span>}
        </div>
      )}

      <div className="activity-panel__command-row">
        <input ref={fileInputRef} type="file" accept="image/*,.pdf,.txt,.md,.csv" hidden onChange={onFileChange} />
        <button
          type="button"
          className="activity-panel__attach"
          onClick={pickFile}
          disabled={!online || pending}
          aria-label="Attach an image or document"
          title="Attach an image (Vision) or a document (PDF/TXT/MD/CSV)"
        >
          📎
        </button>
        <button
          type="button"
          className={`activity-panel__mic${voiceState === 'recording' ? ' is-recording' : ''}`}
          onClick={toggleMic}
          disabled={!online || pending || voiceState === 'transcribing'}
          aria-label={voiceState === 'recording' ? 'Stop recording' : 'Record voice message'}
          title={voiceState === 'recording' ? 'Stop recording' : 'Record voice message'}
        >
          {voiceState === 'transcribing' ? '…' : '●'}
        </button>
        <div className="activity-panel__input-shell">
          <span className="activity-panel__prompt-mark" aria-hidden="true">›</span>
          <input
            className="activity-panel__input"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => event.key === 'Enter' && send()}
            placeholder={placeholder}
            disabled={!online || busy}
          />
        </div>
        <button
          type="button"
          className="activity-panel__learn"
          onClick={learn}
          disabled={!online || pending || !input.trim() || Boolean(attachment)}
          aria-label="Learn this"
          title="Explicitly teach MAT this content (goes through governance review, distinct from Send)"
        >
          📚
        </button>
        <button
          type="button"
          className="activity-panel__send"
          onClick={send}
          disabled={!online || pending || (!input.trim() && !attachment)}
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
