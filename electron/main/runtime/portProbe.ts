import net from 'node:net'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

/**
 * Is anything listening on `host:port` right now? A raw TCP connect attempt
 * — the same technique V1's `Test-PortOpen`/`launcher_server.py`'s
 * `_port_owner_pid` used ("live checks, never trust stale state"). This is
 * what makes "MAT already running — attach instead of spawning a second
 * one" possible, since `ops` itself has no PID file or singleton guard of
 * its own (confirmed by reading `ops/startup.py`: a bind failure there is a
 * hard crash, not a friendly "already running").
 */
export function probePort(host: string, port: number, timeoutMs = 1500): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket()
    let settled = false

    const finish = (open: boolean) => {
      if (settled) return
      settled = true
      socket.destroy()
      resolve(open)
    }

    socket.setTimeout(timeoutMs)
    socket.once('connect', () => finish(true))
    socket.once('timeout', () => finish(false))
    socket.once('error', () => finish(false))
    socket.connect(port, host)
  })
}

/**
 * Finds and force-kills whatever process is listening on `port` — the
 * fallback path for stopping a MAT-AI-OS-V2 process this app attached to
 * rather than spawned itself (no child-process handle to signal directly).
 * `ops` has no PID file, so a live port-owner lookup is the only way to
 * find it at all, matching V1's `Stop-PortOwners`/`_port_owner_pid`
 * (`psutil`-based there; `netstat`/`taskkill` here, same idea, no new
 * dependency). Best-effort: resolves `false` rather than throwing if
 * nothing is found or the kill fails, since "nothing to stop" and "already
 * gone" are both fine outcomes for a caller that's about to re-check status
 * anyway.
 */
export async function killPortOwner(port: number): Promise<boolean> {
  try {
    if (process.platform === 'win32') {
      const { stdout } = await execFileAsync('netstat', ['-ano'])
      const line = stdout.split('\n').find((row) => row.includes(`:${port} `) && row.includes('LISTENING'))
      const pid = line?.trim().split(/\s+/).pop()
      if (!pid) return false
      await execFileAsync('taskkill', ['/F', '/PID', pid])
      return true
    }
    const { stdout } = await execFileAsync('lsof', ['-t', `-i:${port}`])
    const pid = stdout.trim().split('\n')[0]
    if (!pid) return false
    process.kill(Number(pid), 'SIGKILL')
    return true
  } catch {
    return false
  }
}
