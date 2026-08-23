import fs from 'node:fs'
import path from 'node:path'
import { app } from 'electron'

/**
 * Where Qdrant lives and how to reach it — resolved once, at startup, same
 * "env override -> bundled -> known dev location" shape as `runtime/
 * config.ts`'s own `RuntimeConfig`. Qdrant is external infrastructure MAT-
 * AI-OS-V2 already treats as optional (its own documented degraded-memory
 * mode) — this config only ever informs a best-effort preflight, never a
 * hard requirement.
 */
export interface QdrantConfig {
  /** Absolute path to the qdrant executable, or `null` if nothing resolved —
   * the preflight can still *check* whether something is already listening
   * without this, it just can't spawn a new instance. */
  executablePath: string | null
  pathSource: 'env' | 'bundled' | 'dev-known-location' | 'unresolved'
  /** Matches `mat_core_lib`'s own `QDRANT_HOST`/`QDRANT_PORT` env var names
   * and defaults (`memory_manager.py`) — this app never overrides those for
   * MAT itself, it only needs to agree with MAT on where to look. */
  host: string
  port: number
}

const DEFAULT_HOST = '127.0.0.1'
const DEFAULT_PORT = 6333

/** Confirmed present on this machine's dev setup (`D:\qdrant\qdrant.exe`,
 * pre-initialized `storage/`) — a known LOCAL DEVELOPMENT convenience only,
 * never assumed on a packaged build (task: "Do not hardwire the dev path as
 * the only production strategy") and never tried at all off Windows, where
 * this specific path can't exist. */
const DEV_KNOWN_QDRANT_PATH = 'D:\\qdrant\\qdrant.exe'

function resolveExecutablePath(): { execPath: string; source: QdrantConfig['pathSource'] } | null {
  if (process.env.QDRANT_RUNTIME_PATH) return { execPath: process.env.QDRANT_RUNTIME_PATH, source: 'env' }

  if (app.isPackaged) {
    const bundled = path.join(process.resourcesPath, 'qdrant', process.platform === 'win32' ? 'qdrant.exe' : 'qdrant')
    if (fs.existsSync(bundled)) return { execPath: bundled, source: 'bundled' }
    return null
  }

  if (process.platform === 'win32' && fs.existsSync(DEV_KNOWN_QDRANT_PATH)) {
    return { execPath: DEV_KNOWN_QDRANT_PATH, source: 'dev-known-location' }
  }
  return null
}

export function loadQdrantConfig(): QdrantConfig {
  const resolved = resolveExecutablePath()
  return {
    executablePath: resolved?.execPath ?? null,
    pathSource: resolved?.source ?? 'unresolved',
    host: process.env.QDRANT_HOST ?? DEFAULT_HOST,
    port: Number(process.env.QDRANT_PORT ?? DEFAULT_PORT),
  }
}
