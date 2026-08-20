/**
 * Every failure `RestVisionApiAdapter` can produce, normalized to one type so
 * a caller never has to distinguish "fetch threw" from "the server answered
 * with a non-2xx status" by inspecting different error shapes.
 *
 * `status: 0` means the request never got a response at all (network
 * failure, timeout, DNS, connection refused — MAT isn't reachable). Any
 * other `status` is the real HTTP status VISION responded with; `detail` is
 * its `detail` field when the body was JSON with one (see
 * docs/VISION_API_CONTRACT.md's "Error conventions" — FastAPI's own shape
 * for both validation errors and hand-raised `HTTPException`s), otherwise a
 * best-effort fallback message.
 */
export class VisionApiError extends Error {
  readonly status: number
  readonly detail: string
  /** The parsed JSON error body, if the response had one and it parsed. */
  readonly body: unknown

  constructor(message: string, options: { status: number; detail: string; body?: unknown; cause?: unknown }) {
    super(message, options.cause !== undefined ? { cause: options.cause } : undefined)
    this.name = 'VisionApiError'
    this.status = options.status
    this.detail = options.detail
    this.body = options.body
  }

  /** True if this represents "couldn't reach MAT at all" rather than a real
   * HTTP error response — the one distinction most callers actually need. */
  get unreachable(): boolean {
    return this.status === 0
  }
}
