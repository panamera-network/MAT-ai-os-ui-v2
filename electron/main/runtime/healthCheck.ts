/**
 * Is VISION actually serving requests? A real `GET /health`, not just a
 * port probe — `ops`'s own ASGI lifespan means the port can be bound before
 * `IAmMat.startup()`/`start_body()` have finished, so "connect() succeeds"
 * and "the API is ready" are genuinely different moments. This is the same
 * endpoint (and the same "no proof of readiness besides this" conclusion)
 * the renderer's own `useHealth()` already polls.
 */
export async function checkHealth(baseUrl: string, timeoutMs = 3000): Promise<boolean> {
  try {
    const response = await fetch(`${baseUrl}/health`, { signal: AbortSignal.timeout(timeoutMs) })
    return response.ok
  } catch {
    return false
  }
}
