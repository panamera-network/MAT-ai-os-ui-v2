import { EventEmitter } from 'node:events'
import si from 'systeminformation'
import type { TelemetrySnapshot } from '../../ipc/contract'

const POLL_INTERVAL_MS = 1500

function round(value: number): number {
  return Math.round(value)
}

/**
 * Real host-machine telemetry — CPU/RAM/GPU/network — for the HUD header's
 * existing chart slots. Lives entirely in the main process on purpose (task:
 * "UI/Electron side only... do not put this in MAT core or Body"): this is
 * about the machine this app is running on, not MAT's own state, so it has
 * nothing to do with the VISION API or `runtime/`'s process supervision —
 * same "two different jobs" split docs/ELECTRON_ARCHITECTURE.md already
 * draws between VISION and Electron, one level more specific.
 *
 * `systeminformation` (zero runtime dependencies of its own) is the one
 * source for all four metrics rather than mixing `node:os` for CPU/RAM with
 * something else for GPU/network — CPU% and RAM already have direct
 * `node:os` equivalents, but GPU utilization/VRAM and *live* (not
 * cumulative) network throughput don't, so one consistent source beats a
 * three-way split for a handful of read-only gauges.
 */
export class TelemetryService extends EventEmitter {
  private snapshot: TelemetrySnapshot | null = null
  private timer: ReturnType<typeof setInterval> | null = null
  private sampling = false

  getSnapshot(): TelemetrySnapshot | null {
    return this.snapshot
  }

  /** Idempotent — safe to call again after `stop()` (e.g. on `activate`
   * reopening a window) without double-scheduling. */
  start(): void {
    if (this.timer) return
    void this.sample()
    this.timer = setInterval(() => void this.sample(), POLL_INTERVAL_MS)
  }

  /** Stops polling — called on `window-all-closed` (task: "stop polling...
   * cleanly when window closes"), independent of whether MAT itself keeps
   * running (this has nothing to do with `RuntimeSupervisor`). */
  stop(): void {
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }
  }

  private async sample(): Promise<void> {
    // A slow tick (first GPU/network read on some machines can take a
    // moment) should never stack a second one on top of it.
    if (this.sampling) return
    this.sampling = true
    try {
      const [load, mem, graphics, network] = await Promise.all([
        si.currentLoad(),
        si.mem(),
        si.graphics(),
        si.networkStats(),
      ])
      const controller = graphics.controllers.find((c) => typeof c.utilizationGpu === 'number') ?? graphics.controllers[0]
      const iface = network[0]

      this.snapshot = {
        cpu: { usagePercent: round(load.currentLoad) },
        ram: {
          usedBytes: mem.used,
          totalBytes: mem.total,
          usagePercent: mem.total > 0 ? round((mem.used / mem.total) * 100) : 0,
        },
        gpu: {
          usagePercent: typeof controller?.utilizationGpu === 'number' ? round(controller.utilizationGpu) : null,
          vramUsedBytes: typeof controller?.memoryUsed === 'number' ? controller.memoryUsed * 1024 * 1024 : null,
          vramTotalBytes: typeof controller?.memoryTotal === 'number' ? controller.memoryTotal * 1024 * 1024 : null,
        },
        network: {
          rxBytesPerSec: iface?.rx_sec ?? 0,
          txBytesPerSec: iface?.tx_sec ?? 0,
        },
        timestamp: Date.now(),
      }
      this.emit('snapshot', this.snapshot)
    } catch {
      // Best-effort telemetry — a transient OS-query failure just skips this
      // tick (renderer keeps the last good snapshot) rather than crashing
      // anything real.
    } finally {
      this.sampling = false
    }
  }
}
