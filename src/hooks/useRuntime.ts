import { useEffect, useState } from 'react'
import type { RuntimeStatus } from '../../electron/ipc/contract'

interface UseRuntimeResult {
  /** `null` outside the Electron shell (plain browser preview — see
   * `global.d.ts`) or before the first status arrives. */
  status: RuntimeStatus | null
  start: () => void
  stop: () => void
  restart: () => void
}

/**
 * The Electron-side MAT-AI-OS-V2 process supervisor's status, narrowly —
 * this hook is the entire renderer-side surface of `window.mat.runtime`.
 * Distinct from `useHealth()`: that hook asks "can we reach VISION over
 * HTTP right now" (true regardless of who started it); this one asks "what
 * is the launcher itself doing" (attaching, starting, crashed, ...). Both
 * are real, independent signals — see docs/UI_HANDOFF.md.
 */
export function useRuntime(): UseRuntimeResult {
  const [status, setStatus] = useState<RuntimeStatus | null>(null)

  useEffect(() => {
    if (!window.mat) return
    let cancelled = false
    void window.mat.runtime.getStatus().then((initial) => {
      if (!cancelled) setStatus(initial)
    })
    const unsubscribe = window.mat.runtime.onStatusChanged((next) => {
      if (!cancelled) setStatus(next)
    })
    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [])

  return {
    status,
    start: () => void window.mat?.runtime.start(),
    stop: () => void window.mat?.runtime.stop(),
    restart: () => void window.mat?.runtime.restart(),
  }
}
