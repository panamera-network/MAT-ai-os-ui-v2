import type { BodyStatus } from './shared'
import type { IdentityProfile } from './identity'

export interface ActiveModel {
  provider: string
  model: string
}

export interface Health {
  status: 'ok'
  is_running: boolean
  active_model: ActiveModel
  faculties: {
    soul: boolean
    intelligence: boolean
    reasoning: boolean
    vision: boolean
    voice: boolean
  }
  /** Best-effort config *presence* checks only — never a live provider call,
   * never "confirmed reachable". `vision_configured` mirrors this exactly:
   * true the moment any real VISION candidate (primary/fallback_cloud/...)
   * has its credential env var present, never proof `/see` will actually
   * succeed. */
  degraded: {
    llm_provider_configured: boolean
    stt_configured: boolean
    tts_configured: boolean
    vision_configured: boolean
  }
  body: BodyStatus
}

export interface ThinkRequest {
  text: string
  tier?: string
  style?: string
  context?: string
}

export interface ThinkResult {
  response: string
}

export interface SeeRequest {
  prompt: string
  /** At least one required — enforced server-side with a 422, not here. */
  images: Blob[]
}

export interface SeeResult {
  response: string
}

export interface ListenRequest {
  audio: Blob
  filename?: string
  session_id?: string
}

export interface ListenResult {
  transcribed_text: string
  response_text: string
  /** Present only if TTS produced a spoken reply. */
  audio_base64: string | null
  session_id: string | null
  /** True if governance blocked the request. */
  blocked: boolean
  stage: string | null
  detail: string | null
}

export interface SpeakRequest {
  text: string
}

/** `/speak` responds with raw audio bytes, not JSON — this is what the
 * adapter turns that into. */
export interface SpeakResult {
  audio: Blob
  contentType: string
}

export interface SoulInfo {
  soul_prompt: string
  response_styles: Record<string, string>
  safety_rules: string
  active_style: string
  /** Embedded in every real `/soul` response even though nothing consumes it
   * from here today — `GET /identity` is the field callers actually want. */
  identity: IdentityProfile
}

export interface SoulResult {
  soul: SoulInfo
}
