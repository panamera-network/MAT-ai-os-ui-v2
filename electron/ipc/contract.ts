/**
 * The one source of truth for every IPC channel this app exposes to the renderer.
 *
 * Zero Node/Electron imports on purpose — plain strings and types only, so this
 * file is safe to `import type` from the renderer (erased at compile time, never
 * bundled) without pulling any Node/Electron code across the trust boundary.
 *
 * This is the allowlist: main only ever registers handlers for channels named
 * here, and preload only ever exposes wrappers for channels named here. Adding
 * OS-control capability later means adding a new narrowly-typed entry here (own
 * channel name, own request/response shape) — never a generic
 * `invoke(channel, ...args)` passthrough. See docs/ELECTRON_ARCHITECTURE.md.
 */

export const IPC_CHANNELS = {
  ping: 'mat:ping',
  runtimeGetStatus: 'mat:runtime:getStatus',
  runtimeStart: 'mat:runtime:start',
  runtimeStop: 'mat:runtime:stop',
  runtimeRestart: 'mat:runtime:restart',
  /** Push-only: main -> renderer via `webContents.send`, never `invoke`d. */
  runtimeStatusChanged: 'mat:runtime:statusChanged',
  telemetryGetSnapshot: 'mat:telemetry:getSnapshot',
  /** Push-only, same rule as `runtimeStatusChanged`. */
  telemetrySnapshotChanged: 'mat:telemetry:snapshotChanged',
} as const

export type IpcChannel = (typeof IPC_CHANNELS)[keyof typeof IPC_CHANNELS]

export interface PingResponse {
  ok: true
  pong: string
  timestamp: number
}

/**
 * Every state the MAT-AI-OS-V2 process supervisor can be in. Distinct from
 * `useHealth()`'s `checking`/`online`/`offline` (that's "can the renderer
 * reach VISION over HTTP right now", true regardless of who started it) —
 * this is "what is the launcher itself doing/did it succeed", which is why
 * `attaching` (found already running, didn't spawn it) and `starting`
 * (spawn in flight, not yet healthy) exist as separate states from `ready`.
 */
export type RuntimeState = 'checking' | 'attaching' | 'starting' | 'ready' | 'restarting' | 'stopping' | 'stopped' | 'unreachable' | 'error'

export interface RuntimeStatus {
  state: RuntimeState
  /** True once this app has confirmed it spawned the current process itself
   * (vs. attached to one already running before this app started) — governs
   * whether stop/restart can use a real child-process handle or fall back
   * to a port-owner lookup, and is surfaced to the UI as real information,
   * not decoration. */
  owned: boolean
  pid: number | null
  /** Short, human-readable — what the "Operator / Status" field shows. */
  message: string
  /** `Date.now()` when this state was entered. */
  since: number
}

/**
 * One reading of the host machine's own resource usage — CPU/RAM/GPU/
 * network, for the HUD header's chart slots. Distinct from `RuntimeStatus`:
 * this is about the PC this app runs on, never about MAT or Body (task:
 * "UI/Electron side only. Do not put this in MAT core or Body").
 *
 * `gpu`'s fields are independently nullable — a GPU (or its driver) that
 * doesn't expose one of these to the OS reports `null` for exactly that
 * field, never a fabricated number. `null` across all three means "no GPU
 * telemetry available on this machine", not "0% usage" (a real reading).
 */
export interface TelemetrySnapshot {
  cpu: { usagePercent: number }
  ram: { usedBytes: number; totalBytes: number; usagePercent: number }
  gpu: { usagePercent: number | null; vramUsedBytes: number | null; vramTotalBytes: number | null }
  /** Live throughput (bytes/sec), not cumulative totals since boot. */
  network: { rxBytesPerSec: number; txBytesPerSec: number }
  /** `Date.now()` when this reading was taken. */
  timestamp: number
}

/** The exact shape `contextBridge.exposeInMainWorld` puts on `window.mat`. */
export interface MatBridgeApi {
  ping: () => Promise<PingResponse>
  runtime: {
    getStatus: () => Promise<RuntimeStatus>
    start: () => Promise<RuntimeStatus>
    stop: () => Promise<RuntimeStatus>
    restart: () => Promise<RuntimeStatus>
    /** Subscribes to every status transition; returns an unsubscribe
     * function. Not a generic `on(channel, cb)` — this is the one fixed
     * channel it wraps, same narrow-bridge rule as every other method here. */
    onStatusChanged: (listener: (status: RuntimeStatus) => void) => () => void
  }
  telemetry: {
    getSnapshot: () => Promise<TelemetrySnapshot | null>
    /** Subscribes to every new reading (~every 1.5s); returns an
     * unsubscribe function. Same one-fixed-channel rule as `onStatusChanged`. */
    onSnapshotChanged: (listener: (snapshot: TelemetrySnapshot) => void) => () => void
  }
}
