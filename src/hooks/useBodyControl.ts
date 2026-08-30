import { useState } from 'react'
import { useVisionApi } from '../app/VisionApiProvider'
import { VisionApiError } from '../adapters/vision'

interface UseBodyControlResult {
  pending: boolean
  /** Which action is actually in flight ('Start'/'Stop'/'Restart'/
   * 'Watchdog'/'Kill'), `null` when idle — Service Controls audit: `pending`
   * alone couldn't tell the five buttons apart, so none of them could
   * honestly say what THEY were doing without implying the other four were
   * too. Lets a caller show a real in-flight verb on just the one button
   * actually running, not a fake progress claim on all five. */
  pendingLabel: string | null
  /** The real response's own status text — never a fabricated "done". */
  lastResult: string | null
  /** Whether `lastResult` was a real success or a real failure — `null`
   * before the first action ever completes. Kept separate from parsing
   * `lastResult`'s own text (e.g. sniffing for "failed") so tone is always
   * exactly what actually happened, not a guess from wording. */
  lastOk: boolean | null
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
  const [pendingLabel, setPendingLabel] = useState<string | null>(null)
  const [lastResult, setLastResult] = useState<string | null>(null)
  const [lastOk, setLastOk] = useState<boolean | null>(null)

  const run = async (label: string, task: () => Promise<string>) => {
    setPendingLabel(label)
    try {
      setLastResult(await task())
      setLastOk(true)
    } catch (err) {
      setLastResult(err instanceof VisionApiError ? `${label} failed: ${err.detail}` : `${label} failed`)
      setLastOk(false)
    } finally {
      setPendingLabel(null)
    }
  }

  return {
    pending: pendingLabel !== null,
    pendingLabel,
    lastResult,
    lastOk,
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
