import { useState } from 'react'
import { useVisionApi } from '../app/VisionApiProvider'
import { VisionApiError } from '../adapters/vision'

interface UseSpeakResult {
  /** Id of the message currently playing, if any — lets a caller show one
   * "speaking" state per message rather than a single global flag. */
  speakingId: string | null
  speakError: string | null
  speak: (id: string, text: string) => Promise<void>
}

/**
 * On-demand `/speak` playback, one message at a time. Never called
 * automatically — the current UI has no existing autoplay affordance to
 * match, so this stays an explicit per-message action (see
 * `ActivityPanel.tsx`'s speak button) rather than assuming autoplay UX that
 * doesn't exist yet.
 */
export function useSpeak(): UseSpeakResult {
  const api = useVisionApi()
  const [speakingId, setSpeakingId] = useState<string | null>(null)
  const [speakError, setSpeakError] = useState<string | null>(null)

  const speak = async (id: string, text: string) => {
    setSpeakError(null)
    setSpeakingId(id)
    try {
      const result = await api.speak({ text })
      const url = URL.createObjectURL(result.audio)
      const audio = new Audio(url)
      audio.onended = () => {
        setSpeakingId((current) => (current === id ? null : current))
        URL.revokeObjectURL(url)
      }
      audio.onerror = () => {
        setSpeakingId((current) => (current === id ? null : current))
        URL.revokeObjectURL(url)
      }
      await audio.play()
    } catch (err) {
      setSpeakingId((current) => (current === id ? null : current))
      setSpeakError(err instanceof VisionApiError ? err.detail : 'Speech playback failed.')
    }
  }

  return { speakingId, speakError, speak }
}
