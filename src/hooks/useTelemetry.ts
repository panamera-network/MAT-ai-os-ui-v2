import { useEffect, useState } from 'react'
import type { TelemetrySnapshot } from '../../electron/ipc/contract'

/**
 * Real host-machine telemetry (CPU/RAM/GPU/network) — the entire
 * renderer-side surface of `window.mat.telemetry`. `null` outside the
 * Electron shell (plain browser preview — see `global.d.ts`) or before the
 * first reading arrives; read-only, this hook has no actions of its own.
 */
export function useTelemetry(): TelemetrySnapshot | null {
  const [snapshot, setSnapshot] = useState<TelemetrySnapshot | null>(null)

  useEffect(() => {
    if (!window.mat) return
    let cancelled = false
    void window.mat.telemetry.getSnapshot().then((initial) => {
      if (!cancelled && initial) setSnapshot(initial)
    })
    const unsubscribe = window.mat.telemetry.onSnapshotChanged((next) => {
      if (!cancelled) setSnapshot(next)
    })
    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [])

  return snapshot
}
