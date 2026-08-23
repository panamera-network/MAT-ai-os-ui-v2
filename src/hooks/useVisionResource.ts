import { useEffect, useState } from 'react'
import { useVisionApi } from '../app/VisionApiProvider'
import { VisionApiError } from '../adapters/vision'
import type { VisionApiAdapter } from '../adapters/vision'

interface UseVisionResourceResult<T> {
  data: T | null
  error: VisionApiError | null
  loading: boolean
  /** Re-runs the same fetch — for after an action that changes this
   * resource's own state (e.g. a service start/stop), not for polling. */
  refetch: () => void
}

/** How long to wait before retrying a fetch that failed because MAT simply
 * wasn't reachable yet — never for a genuine HTTP error response, see below. */
const RETRY_WHILE_UNREACHABLE_MS = 3000

/**
 * Fetch-on-mount (and on `refetch()`) for a single VISION API read endpoint —
 * the shared shape every Glass HUD snapshot hook (`useAgents`, `useLoops`,
 * ...) wraps. Not polled like `useHealth`'s connection state once loaded:
 * these are glance-and-load snapshots, not a signal that needs to stay live.
 * `fetcher` must be a stable (module-scope) function reference, not an
 * inline closure, or this refetches every render.
 *
 * Real bug found via live testing: every consumer of this hook mounts
 * immediately with the rest of the HUD, well before MAT is necessarily
 * reachable (a cold start — Qdrant recovering existing collections, MAT's
 * own real embedder load — can now take well over a minute). The one-shot
 * fetch this used to be caught that failure and never tried again, so the
 * whole right/left panel got stuck showing "offline" forever on every
 * launch, even once MAT genuinely came up seconds later. This now retries
 * on a fixed interval specifically while `error.unreachable` (status `0` —
 * couldn't reach MAT at all, not a real response) stays true; a genuine
 * HTTP error response (auth, 500, ...) is left as-is, since blindly
 * retrying that wouldn't fix it.
 */
export function useVisionResource<T>(fetcher: (api: VisionApiAdapter, signal: AbortSignal) => Promise<T>): UseVisionResourceResult<T> {
  const api = useVisionApi()
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<VisionApiError | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshToken, setRefreshToken] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    let retryTimer: ReturnType<typeof setTimeout> | null = null
    setLoading(true)
    fetcher(api, controller.signal)
      .then((result) => {
        setData(result)
        setError(null)
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return
        const visionError = err instanceof VisionApiError ? err : null
        setError(visionError)
        if (visionError?.unreachable) {
          retryTimer = setTimeout(() => setRefreshToken((n) => n + 1), RETRY_WHILE_UNREACHABLE_MS)
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => {
      controller.abort()
      if (retryTimer) clearTimeout(retryTimer)
    }
  }, [api, fetcher, refreshToken])

  return { data, error, loading, refetch: () => setRefreshToken((n) => n + 1) }
}

const RESOURCE_STATE_LABEL = {
  loading: '…',
  offline: 'offline',
  error: 'error',
  empty: '—',
} as const

/**
 * One consistent label for every `useVisionResource`-backed HUD row's
 * non-data states, so "still loading", "MAT unreachable", "request failed",
 * and "loaded but genuinely nothing there" never collapse into the same
 * ambiguous dash the way they used to. `render` only runs once `data` is
 * actually present — real data always wins over a stale error/loading flag.
 */
export function formatResourceValue<T>(
  resource: Pick<UseVisionResourceResult<T>, 'data' | 'loading' | 'error'>,
  render: (data: T) => string,
): string {
  if (resource.data) return render(resource.data)
  if (resource.loading) return RESOURCE_STATE_LABEL.loading
  if (resource.error) return RESOURCE_STATE_LABEL[resource.error.unreachable ? 'offline' : 'error']
  return RESOURCE_STATE_LABEL.empty
}

const RESOURCE_STATUS_NOTE = {
  loading: 'Loading…',
  offline: 'Offline',
  error: 'Error loading data',
} as const

/**
 * Same three non-data states as `formatResourceValue`, but for a section
 * that renders a list/stat-block rather than one inline value — a note
 * string while loading/offline/errored, or `null` once there's a real
 * response to render (even a genuinely empty one; the caller's own
 * empty-state branch handles that, this only covers "no response yet").
 */
export function describeResourceStatus<T>(resource: Pick<UseVisionResourceResult<T>, 'data' | 'loading' | 'error'>): string | null {
  if (resource.data) return null
  if (resource.loading) return RESOURCE_STATUS_NOTE.loading
  if (resource.error) return RESOURCE_STATUS_NOTE[resource.error.unreachable ? 'offline' : 'error']
  return null
}
