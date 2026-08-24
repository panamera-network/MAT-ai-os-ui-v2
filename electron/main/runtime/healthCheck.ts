/**
 * Is VISION actually serving requests? A real `GET /health`, not just a
 * port probe — `ops`'s own ASGI lifespan means the port can be bound before
 * `IAmMat.startup()`/`start_body()` have finished, so "connect() succeeds"
 * and "the API is ready" are genuinely different moments. This is the same
 * endpoint (and the same "no proof of readiness besides this" conclusion)
 * the renderer's own `useHealth()` already polls.
 */

export interface HealthCheckResult {
  /** `response.ok` on a real `/health` request — the ONLY thing this module
   * used to report at all. */
  reachable: boolean
  /** Group 7C (Access + Escalation): the real component names `V2Body`'s
   * own `_try()` recorded as degraded, read from `/health`'s JSON body
   * (`body.degraded`) — never just the HTTP status. `[]` whenever there's
   * no body attached, the response isn't parseable JSON, or the field is
   * genuinely absent/empty; never guessed, never non-empty on anything
   * other than a real reported name. Distinct from `/health`'s OTHER,
   * unrelated top-level `degraded` object (MAT's own faculty config flags,
   * e.g. `llm_provider_configured`) — this is specifically `body.degraded`.
   */
  degraded: string[]
}

const UNREACHABLE: HealthCheckResult = { reachable: false, degraded: [] }

export async function checkHealth(baseUrl: string, timeoutMs = 3000): Promise<HealthCheckResult> {
  try {
    const response = await fetch(`${baseUrl}/health`, { signal: AbortSignal.timeout(timeoutMs) })
    if (!response.ok) return UNREACHABLE
    // A non-JSON or unexpectedly-shaped body must never crash the watchdog
    // over a parsing failure -- `response.ok` alone already proves it's
    // reachable, so degraded just stays unknown-as-empty rather than this
    // whole check reporting "unreachable" over something that isn't a
    // reachability problem at all.
    const data: unknown = await response.json().catch(() => null)
    const body = data && typeof data === 'object' ? (data as Record<string, unknown>).body : null
    const rawDegraded = body && typeof body === 'object' ? (body as Record<string, unknown>).degraded : null
    const degraded = Array.isArray(rawDegraded) ? rawDegraded.filter((name): name is string => typeof name === 'string') : []
    return { reachable: true, degraded }
  } catch {
    return UNREACHABLE
  }
}
