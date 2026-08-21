import type { VisionApiAdapter } from '../adapters/vision'
import type { ServicesResult } from '../domain/vision'
import { useVisionResource } from './useVisionResource'

const fetchServices = (api: VisionApiAdapter, signal: AbortSignal) => api.getServices(signal)

/** Real `GET /services` snapshot for the Glass HUD's right control zone. */
export function useServices() {
  return useVisionResource<ServicesResult>(fetchServices)
}
