import { useState } from 'react'
import { useVisionApi } from '../app/VisionApiProvider'
import { VisionApiError } from '../adapters/vision'

interface UseBodyControlResult {
  pending: boolean
  /** The real response's own status text — never a fabricated "done". */
  lastResult: string | null
  start: () => void
  stop: () => void
  restart: () => void
  watchdog: () => void
  kill: () => void
}

/** Fires the real `POST /control/*` actions (OS controls, Glass HUD right
 * zone) and surfaces each one's actual response status back verbatim. */
export function useBodyControl(): UseBodyControlResult {
  const api = useVisionApi()
  const [pending, setPending] = useState(false)
  const [lastResult, setLastResult] = useState<string | null>(null)

  const run = async (label: string, task: () => Promise<string>) => {
    setPending(true)
    try {
      setLastResult(await task())
    } catch (err) {
      setLastResult(err instanceof VisionApiError ? `${label} failed: ${err.detail}` : `${label} failed`)
    } finally {
      setPending(false)
    }
  }

  return {
    pending,
    lastResult,
    start: () => void run('Start', async () => `Start: ${(await api.startBody()).result.status}`),
    stop: () => void run('Stop', async () => `Stop: ${(await api.stopBody()).result.status}`),
    restart: () =>
      void run('Restart', async () => {
        const { result } = await api.restartBody()
        return `Restart: ${result.stop.status} → ${result.start.status}`
      }),
    watchdog: () =>
      void run('Watchdog', async () => {
        const { result } = await api.checkWatchdog()
        return `Watchdog: ${result.action}`
      }),
    kill: () =>
      void run('Kill', async () => {
        const { result } = await api.killBody()
        return `Kill: ${result.status}${result.forced ? ' (forced)' : ''}`
      }),
  }
}
