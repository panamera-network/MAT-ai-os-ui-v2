/**
 * Wiring for `RestVisionApiAdapter` — base URL and the optional `X-API-Key`.
 * Lives in the adapter layer, not a global app config: this is I/O wiring,
 * and only the REST adapter needs it (a future mock adapter needs none of
 * this). Vite only exposes env vars prefixed `VITE_` to client code.
 */
export interface VisionApiConfig {
  /** No trailing slash. Matches `ops/config.py`'s own `DEFAULT_HOST`/`DEFAULT_PORT`. */
  baseUrl: string
  /** Sent as `X-API-Key` on every request when set. Auth is opt-in
   * server-side (see docs/VISION_API_CONTRACT.md) — an empty string here
   * matches the backend's own "auth disabled" default, so local-only use
   * needs no setup. */
  apiKey: string
  /** Default per-request timeout; a caller-supplied `AbortSignal` overrides
   * this rather than combining with it, keeping the cancellation story simple. */
  timeoutMs: number
}

export const DEFAULT_VISION_API_CONFIG: VisionApiConfig = {
  baseUrl: (import.meta.env.VITE_MAT_API_BASE_URL as string | undefined) ?? 'http://127.0.0.1:8000',
  apiKey: (import.meta.env.VITE_MAT_API_KEY as string | undefined) ?? '',
  timeoutMs: 5000,
}
