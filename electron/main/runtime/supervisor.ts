import { spawn, type ChildProcess } from 'node:child_process'
import fs from 'node:fs'
import { EventEmitter } from 'node:events'
import type { RuntimeStatus, RuntimeState } from '../../ipc/contract'
import type { RuntimeConfig } from './config'
import { probePort, killPortOwner } from './portProbe'
import { checkHealth } from './healthCheck'
import { logRuntimeLine } from './log'

const HEALTH_TIMEOUT_MS = 3000
const START_POLL_INTERVAL_MS = 1000
const START_TIMEOUT_MS = 45000
const WATCHDOG_INTERVAL_MS = 10000
const WATCHDOG_FAILURE_THRESHOLD = 2
const MAX_AUTO_RESTARTS = 3

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Owns the MAT-AI-OS-V2 process's lifecycle for this app's lifetime — the
 * one place `python -m ops` gets spawned, watched, and (when this app is
 * the one that spawned it) stopped. Runtime supervision belongs here, in
 * the main process, on purpose: React only ever sees the `RuntimeStatus`
 * this emits over IPC, never process handles, paths, or spawn logic. See
 * docs/ELECTRON_ARCHITECTURE.md.
 *
 * Ownership rule: `owned` is true only once this instance has confirmed it
 * spawned the current process itself. An attached (already-running, found
 * via `probePort`) process is never auto-killed — not on `stop()` falling
 * back to a port-owner lookup only when explicitly asked, and never on app
 * quit at all (see `main/index.ts` — closing this UI does not stop MAT,
 * matching V1's own precedent of leaving backend processes running
 * independent of the UI window's lifecycle).
 */
export class RuntimeSupervisor extends EventEmitter {
  private readonly config: RuntimeConfig
  private status: RuntimeStatus
  private child: ChildProcess | null = null
  private childExited = false
  /** Last non-empty stderr line the child printed — folded into the exit
   * error message so "MAT exited unexpectedly" always carries a real reason
   * (a lock rejection, a bind failure, a construction error, ...) instead
   * of just a bare exit code. */
  private lastStderrLine = ''
  private watchdogTimer: ReturnType<typeof setInterval> | null = null
  private consecutiveFailures = 0
  private autoRestartCount = 0
  private busy = false

  constructor(config: RuntimeConfig) {
    super()
    this.config = config
    this.status = this.makeStatus('checking', false, null, 'Checking for MAT…')
  }

  getStatus(): RuntimeStatus {
    return this.status
  }

  /** Called once at app startup: attach to an already-running instance, or
   * start a fresh one. Never called again — `start()`/`stop()`/`restart()`
   * are the IPC-driven paths after this. */
  async initialize(): Promise<RuntimeStatus> {
    const alreadyListening = await probePort(this.config.host, this.config.port)
    if (alreadyListening) {
      this.setStatus('attaching', false, null, 'MAT already running — attaching…')
      const healthy = await checkHealth(this.config.baseUrl, HEALTH_TIMEOUT_MS)
      if (healthy) {
        this.setStatus('ready', false, null, 'Attached to an already-running MAT.')
        this.startWatchdog()
        return this.status
      }
      // Something owns the port but isn't answering `/health` — not our
      // process to diagnose further; report it honestly rather than
      // guessing whether it's still starting up or genuinely stuck.
      this.setStatus('unreachable', false, null, 'A process is on this port but not responding to /health.')
      return this.status
    }
    return this.start()
  }

  async start(): Promise<RuntimeStatus> {
    if (this.busy) return this.status
    if (this.status.state === 'ready') return this.status
    this.busy = true
    try {
      const stillListening = await probePort(this.config.host, this.config.port)
      if (stillListening) {
        this.setStatus('attaching', false, null, 'MAT already running — attaching…')
        const healthy = await checkHealth(this.config.baseUrl, HEALTH_TIMEOUT_MS)
        this.setStatus(
          healthy ? 'ready' : 'unreachable',
          false,
          null,
          healthy ? 'Attached to an already-running MAT.' : 'A process is on this port but not responding to /health.',
        )
        if (healthy) this.startWatchdog()
        return this.status
      }

      if (!this.config.pythonPath || !this.config.repoPath || !fs.existsSync(this.config.pythonPath)) {
        this.setStatus(
          'error',
          false,
          null,
          this.config.pythonPath
            ? `MAT-AI-OS-V2 not found at ${this.config.pythonPath} — set MAT_RUNTIME_PATH.`
            : 'MAT-AI-OS-V2 runtime not found (no MAT_RUNTIME_PATH, no bundled runtime, no dev checkout) — set MAT_RUNTIME_PATH.',
        )
        return this.status
      }

      this.setStatus('starting', false, null, 'Starting MAT (python -m ops)…')
      this.childExited = false
      this.lastStderrLine = ''
      const child = spawn(this.config.pythonPath, ['-m', 'ops'], {
        cwd: this.config.repoPath,
        env: {
          ...process.env,
          MAT_HOST: process.env.MAT_HOST ?? this.config.host,
          MAT_PORT: process.env.MAT_PORT ?? String(this.config.port),
        },
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true,
      })
      this.child = child
      child.stdout?.on('data', (chunk: Buffer) => logRuntimeLine(`[ops:stdout] ${chunk.toString().trimEnd()}`))
      child.stderr?.on('data', (chunk: Buffer) => {
        const text = chunk.toString().trimEnd()
        if (text) {
          const lines = text.split('\n').filter(Boolean)
          if (lines.length > 0) this.lastStderrLine = lines[lines.length - 1].trim()
        }
        logRuntimeLine(`[ops:stderr] ${text}`)
      })
      child.once('exit', (code, signal) => {
        this.childExited = true
        logRuntimeLine(`ops process exited (code=${code ?? 'null'}, signal=${signal ?? 'null'})`)
        if (this.status.state === 'starting' || this.status.state === 'ready') {
          const detail = this.lastStderrLine ? `: ${this.lastStderrLine}` : ''
          this.setStatus('error', true, null, `MAT exited unexpectedly (code ${code ?? signal ?? 'unknown'})${detail}`)
        }
      })
      child.once('error', (err) => {
        this.childExited = true
        logRuntimeLine(`failed to spawn ops process: ${err.message}`)
        this.setStatus('error', false, null, `Failed to start MAT: ${err.message}`)
      })

      const becameReady = await this.waitForHealth(START_TIMEOUT_MS)
      if (!becameReady) {
        this.setStatus('unreachable', true, child.pid ?? null, 'MAT started but never became healthy in time.')
        return this.status
      }

      this.autoRestartCount = 0
      this.setStatus('ready', true, child.pid ?? null, 'MAT is running.')
      this.startWatchdog()
      return this.status
    } finally {
      this.busy = false
    }
  }

  async stop(): Promise<RuntimeStatus> {
    if (this.busy) return this.status
    this.busy = true
    try {
      this.stopWatchdog()
      this.setStatus('stopping', this.status.owned, this.status.pid, 'Stopping MAT…')

      // Best-effort graceful body shutdown over HTTP before the hard kill —
      // on Windows, Node's `child.kill()` maps to TerminateProcess, not a
      // real signal, so `ops`'s own SIGTERM-driven ASGI lifespan shutdown
      // never runs; this is the only graceful step actually reachable there.
      try {
        await fetch(`${this.config.baseUrl}/control/stop`, { method: 'POST', signal: AbortSignal.timeout(2000) })
      } catch {
        // Fine — MAT may already be unresponsive, which is exactly why
        // we're stopping it.
      }

      if (this.child && !this.childExited) {
        this.child.kill()
        await Promise.race([
          new Promise<void>((resolve) => this.child?.once('exit', () => resolve())),
          delay(5000),
        ])
      } else if (!this.status.owned) {
        await killPortOwner(this.config.port)
      }

      this.child = null
      this.setStatus('stopped', false, null, 'MAT stopped.')
      return this.status
    } finally {
      this.busy = false
    }
  }

  async restart(): Promise<RuntimeStatus> {
    this.setStatus('restarting', this.status.owned, this.status.pid, 'Restarting MAT…')
    await this.stop()
    return this.start()
  }

  /** Stops the watchdog only — never called from `main/index.ts`'s quit
   * handlers to stop MAT itself (see class doc comment). */
  dispose(): void {
    this.stopWatchdog()
  }

  private async waitForHealth(timeoutMs: number): Promise<boolean> {
    const deadline = Date.now() + timeoutMs
    while (Date.now() < deadline) {
      if (this.childExited) return false
      if (await checkHealth(this.config.baseUrl, HEALTH_TIMEOUT_MS)) return true
      await delay(START_POLL_INTERVAL_MS)
    }
    return false
  }

  private startWatchdog(): void {
    this.stopWatchdog()
    this.consecutiveFailures = 0
    this.watchdogTimer = setInterval(() => void this.watchdogTick(), WATCHDOG_INTERVAL_MS)
  }

  private stopWatchdog(): void {
    if (this.watchdogTimer) {
      clearInterval(this.watchdogTimer)
      this.watchdogTimer = null
    }
  }

  private async watchdogTick(): Promise<void> {
    if (this.status.state !== 'ready' || this.busy) return
    const healthy = await checkHealth(this.config.baseUrl, HEALTH_TIMEOUT_MS)
    if (healthy) {
      this.consecutiveFailures = 0
      return
    }
    this.consecutiveFailures += 1
    if (this.consecutiveFailures < WATCHDOG_FAILURE_THRESHOLD) return

    this.stopWatchdog()
    // Recovery is conservative on purpose: only auto-respawn a process we
    // own AND have confirmed actually exited. A live-but-slow process (ours
    // or attached) just reports `unreachable` — no automatic kill-and-retry
    // on a process that might still recover or might not be safe to touch.
    if (this.status.owned && this.childExited && this.autoRestartCount < MAX_AUTO_RESTARTS) {
      this.autoRestartCount += 1
      logRuntimeLine(`watchdog: auto-restart attempt ${this.autoRestartCount}/${MAX_AUTO_RESTARTS}`)
      await this.start()
      return
    }
    this.setStatus(
      'unreachable',
      this.status.owned,
      this.status.pid,
      this.status.owned && this.autoRestartCount >= MAX_AUTO_RESTARTS
        ? 'MAT crashed repeatedly — auto-restart stopped. Use Restart to try again.'
        : 'Lost contact with MAT.',
    )
  }

  private makeStatus(state: RuntimeState, owned: boolean, pid: number | null, message: string): RuntimeStatus {
    return { state, owned, pid, message, since: Date.now() }
  }

  private setStatus(state: RuntimeState, owned: boolean, pid: number | null, message: string): void {
    this.status = this.makeStatus(state, owned, pid, message)
    logRuntimeLine(`status -> ${this.status.state}: ${this.status.message}`)
    this.emit('status', this.status)
  }
}
