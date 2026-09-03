/** MAT's own model registry only — never Body's. Ten fixed capabilities
 * (`model_registry.py::CAPABILITIES`, verbatim order) — `VOICE_STT`/
 * `VOICE_TTS` are the ones `Voice` actually resolves for STT/TTS dispatch;
 * the combined `VOICE` slot is a separate, third capability. Never a
 * discovery/catalog endpoint. */
export const CAPABILITIES = ['FAST', 'THINKING', 'EXPERT', 'VISION', 'VOICE', 'VOICE_STT', 'VOICE_TTS', 'VIDEO', 'EMBEDDING', 'RERANKER'] as const
export type Capability = (typeof CAPABILITIES)[number]

export const TIERS = ['primary', 'fallback_local', 'fallback_cloud', 'fallback_api'] as const
export type Tier = (typeof TIERS)[number]

export interface ModelSlot {
  provider: string
  model: string
}

export type ModelProfiles = Record<Capability, Partial<Record<Tier, ModelSlot | null>>>

export interface ModelsResult {
  profiles: ModelProfiles
}

/**
 * Passing both `provider` and `model` as `null`/omitted clears that tier's
 * slot instead of setting it — see docs/VISION_API_CONTRACT.md's Models
 * section.
 */
export interface ModelSelectRequest {
  capability: string
  tier?: Tier
  provider?: string | null
  model?: string | null
}
