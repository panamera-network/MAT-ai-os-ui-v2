import { useRef, useState } from 'react'
import { useVisionApi } from '../app/VisionApiProvider'
import { VisionApiError } from '../adapters/vision'

export type VoiceState = 'idle' | 'recording' | 'transcribing' | 'error'

interface UseVoiceResult {
  voiceState: VoiceState
  voiceError: string | null
  startRecording: () => Promise<void>
  stopRecording: () => void
}

/**
 * Mic -> record -> `/listen` -> transcript, per the target flow: `/listen`'s
 * own `response_text` is deliberately discarded here. Internally it's built
 * from a bare `Reasoning.think(text)` call with no `context` param at all
 * (`iammat/voice/voice.py`'s `_ReasoningAdapter.handle_task`) — using it
 * would silently drop conversation memory for every voice turn. `onTranscript`
 * instead hands the transcript to the caller's own `send()`, so a voice turn
 * goes through the exact same context-aware `/think` path a typed turn does.
 */
export function useVoice(onTranscript: (text: string) => void): UseVoiceResult {
  const api = useVisionApi()
  const [voiceState, setVoiceState] = useState<VoiceState>('idle')
  const [voiceError, setVoiceError] = useState<string | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const streamRef = useRef<MediaStream | null>(null)

  const transcribe = async () => {
    setVoiceState('transcribing')
    const audio = new Blob(chunksRef.current, { type: 'audio/webm' })
    chunksRef.current = []
    try {
      const result = await api.listen({ audio, filename: 'recording.webm' })
      setVoiceState('idle')
      if (result.transcribed_text.trim()) {
        onTranscript(result.transcribed_text)
      } else {
        setVoiceError("MAT couldn't make out what you said.")
      }
    } catch (err) {
      setVoiceState('error')
      setVoiceError(err instanceof VisionApiError ? err.detail : 'Voice transcription failed.')
    }
  }

  const startRecording = async () => {
    setVoiceError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      chunksRef.current = []
      const recorder = new MediaRecorder(stream)
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data)
      }
      recorder.onstop = () => {
        streamRef.current?.getTracks().forEach((track) => track.stop())
        streamRef.current = null
        void transcribe()
      }
      recorderRef.current = recorder
      recorder.start()
      setVoiceState('recording')
    } catch (err) {
      setVoiceState('error')
      // getUserMedia rejects with a real DOMException (NotAllowedError when
      // mic access is denied at the OS/browser level, NotFoundError when no
      // mic exists) — its own .message is already a correct, honest reason,
      // never fabricated here.
      setVoiceError(err instanceof Error ? err.message : 'Microphone access was denied.')
    }
  }

  const stopRecording = () => {
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      recorderRef.current.stop()
    }
  }

  return { voiceState, voiceError, startRecording, stopRecording }
}
