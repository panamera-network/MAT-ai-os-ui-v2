import { spawn, type ChildProcess } from 'node:child_process'
import path from 'node:path'
import { EventEmitter } from 'node:events'
import type { QdrantStatus, QdrantState } from '../../ipc/contract'
import type { QdrantConfig } from './config'
import { probePort } from '../runtime/portProbe'
import { logRuntimeLine } from '../runtime/log'

const START_POLL_INTERVAL_MS = 500
const START_TIMEOUT_MS = 20000

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * A one-shot preflight, not a supervisor — see `QdrantStatus`'s own doc
 * comment in `ipc/contract.ts`. `ensure()` is called exactly once, before
 * `RuntimeSupervisor.initialize()`, and is designed to NEVER block MAT
 * startup: every path (found, started, or genuinely unreachable) resolves
 * within `START_TIMEOUT_MS`, and a failure here only ever produces an honest
 * `offline` status — MAT-AI-OS-V2's own degraded-memory mode (already real,
 * already tested) is what actually carries the app forward from there, not
 * anything this class does.
 */
export class QdrantPreflight extends EventEmitter {
  private readonly config: QdrantConfig
  private status: QdrantStatus
  private child: ChildProcess | null = null

  constructor(config: QdrantConfig) {
    super()
    this.config = config
    this.status = this.makeStatus('checking', false, 'Checking for Qdrant…')
  }

  getStatus(): QdrantStatus {
    return this.status
  }

  /** Called once at app startup, before MAT itself starts/attaches — see
   * `main/index.ts`. Safe to call again (e.g. macOS `activate` reopening a
   * window) without spawning a second instance: a live `this.child` this
   * same instance already owns is recognized as still-owned rather than
   * re-probed into a false "attached, not owned". */
  async ensure(): Promise<QdrantStatus> {
    const reachable = await probePort(this.config.host, this.config.port)
    if (reachable) {
      const stillOurChild = this.child !== null && this.child.exitCode === null && this.child.signalCode === null
      this.setStatus(
        'online',
        stillOurChild,
        stillOurChild ? 'Qdrant running (started by this app).' : 'Qdrant already running — attached.',
      )
      return this.status
    }

    if (!this.config.executablePath) {
      this.setStatus(
        'offline',
        false,
        this.config.pathSource === 'unresolved'
          ? 'Qdrant not found (no QDRANT_RUNTIME_PATH, no bundled runtime, no known dev install) — MAT will run with memory degraded.'
          : `Qdrant not found at ${this.config.executablePath} — MAT will run with memory degraded.`,
      )
      return this.status
    }

    this.setStatus('starting', false, 'Starting Qdrant…')
    try {
      const execPath = this.config.executablePath
      const child = spawn(execPath, [], {
        // Qdrant resolves its own storage/config paths relative to its
        // working directory (`./storage`, `config/config.yaml`) — running it
        // from anywhere else would have it create a fresh, empty store next
        // to this app instead of finding the real one next to the binary.
        cwd: path.dirname(execPath),
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true,
        // Same Windows Job Object reasoning as `RuntimeSupervisor`'s own
        // spawn: without `detached: true`, closing this app would take a
        // still-healthy Qdrant down with it, contradicting "closing the UI
        // must not automatically stop Qdrant".
        detached: true,
      })
      child.unref()
      this.child = child
      child.stdout?.on('data', (chunk: Buffer) => logRuntimeLine(`[qdrant:stdout] ${chunk.toString().trimEnd()}`))
      child.stderr?.on('data', (chunk: Buffer) => logRuntimeLine(`[qdrant:stderr] ${chunk.toString().trimEnd()}`))
      child.once('error', (err) => {
        logRuntimeLine(`failed to spawn qdrant: ${err.message}`)
      })
      child.once('exit', (code, signal) => {
        logRuntimeLine(`qdrant process exited (code=${code ?? 'null'}, signal=${signal ?? 'null'})`)
        // Only overwrite an `online`+owned status — if this fires during the
        // startup race below, `waitForPort`'s own timeout already produces
        // the right `offline` message; don't stomp a more specific one.
        if (this.status.state === 'online' && this.status.owned) {
          this.setStatus(
            'offline',
            false,
            `Qdrant exited unexpectedly (code ${code ?? signal ?? 'unknown'}) — MAT will run with memory degraded.`,
          )
        }
      })

      const becameReachable = await this.waitForPort(START_TIMEOUT_MS)
      if (!becameReachable) {
        this.setStatus('offline', false, 'Qdrant did not become reachable in time — MAT will run with memory degraded.')
        return this.status
      }
      this.setStatus('online', true, 'Qdrant started by this app.')
      return this.status
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      this.setStatus('offline', false, `Failed to start Qdrant: ${message} — MAT will run with memory degraded.`)
      return this.status
    }
  }

  private async waitForPort(timeoutMs: number): Promise<boolean> {
    const deadline = Date.now() + timeoutMs
    while (Date.now() < deadline) {
      if (await probePort(this.config.host, this.config.port)) return true
      await delay(START_POLL_INTERVAL_MS)
    }
    return false
  }

  private makeStatus(state: QdrantState, owned: boolean, message: string): QdrantStatus {
    return { state, owned, message, since: Date.now() }
  }

  private setStatus(state: QdrantState, owned: boolean, message: string): void {
    this.status = this.makeStatus(state, owned, message)
    logRuntimeLine(`qdrant status -> ${this.status.state}: ${this.status.message}`)
    this.emit('status', this.status)
  }
}
