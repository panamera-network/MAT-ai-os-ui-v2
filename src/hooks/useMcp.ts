import type { VisionApiAdapter } from '../adapters/vision'
import type { McpResult } from '../domain/vision'
import { useVisionResource } from './useVisionResource'

const fetchMcp = (api: VisionApiAdapter, signal: AbortSignal) => api.getMcp(signal)

/** Real `GET /mcp` snapshot for the Glass HUD's left info zone. */
export function useMcp() {
  return useVisionResource<McpResult>(fetchMcp)
}
