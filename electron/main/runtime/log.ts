import fs from 'node:fs'
import path from 'node:path'
import { app } from 'electron'

let stream: fs.WriteStream | null = null

/** One append-mode log file per app run, under Electron's own userData dir
 * — `python -m ops`'s stdout/stderr piped here (never to Electron's own
 * console in production), so a failed start is diagnosable after the fact,
 * not just a silent "unreachable" in the UI. */
function getStream(): fs.WriteStream {
  if (!stream) {
    const dir = path.join(app.getPath('userData'), 'logs')
    fs.mkdirSync(dir, { recursive: true })
    stream = fs.createWriteStream(path.join(dir, 'mat-ops.log'), { flags: 'a' })
  }
  return stream
}

export function logRuntimeLine(line: string): void {
  const timestamped = `[${new Date().toISOString()}] ${line}\n`
  getStream().write(timestamped)
  if (process.env.VITE_DEV_SERVER_URL) console.log(`[runtime] ${line}`)
}
