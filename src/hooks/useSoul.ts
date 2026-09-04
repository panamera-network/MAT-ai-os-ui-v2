import type { VisionApiAdapter } from '../adapters/vision'
import type { SoulResult } from '../domain/vision'
import { useVisionResource } from './useVisionResource'

const fetchSoul = (api: VisionApiAdapter, signal: AbortSignal) => api.getSoul(signal)

/** Real `GET /soul` snapshot — MAT's own soul prompt/response styles/safety
 * rules plus the full real `identity` object nested inside it (same shape
 * `GET /identity` alone would return, so this one fetch covers both without
 * a second call). Glance-and-load, same convention `BrainViewCanvas`'s own
 * data already uses: the "I AM MAT" canvas isn't always mounted, so no poll. */
export function useSoul() {
  return useVisionResource<SoulResult>(fetchSoul)
}
