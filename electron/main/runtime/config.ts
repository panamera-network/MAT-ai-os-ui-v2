import fs from 'node:fs'
import path from 'node:path'
import { app } from 'electron'

/**
 * Where MAT-AI-OS-V2 lives and how to reach it — resolved once, at startup.
 * Deliberately minimal (matches `ops/config.py`'s own "no large configuration
 * framework" stance): a couple of env-var overrides with sensible defaults,
 * no config file.
 */
export interface RuntimeConfig {
  /** MAT-AI-OS-V2's repo root — where `.venv/` and the `ops` package live.
   * `null` means no candidate location resolved to anything real (see
   * `resolveRuntimePath`) — spawning is unavailable until `MAT_RUNTIME_PATH`
   * is set, but *attaching* to an already-running instance still works,
   * since that only needs `baseUrl`/`host`/`port`, never this. */
  repoPath: string | null
  /** Absolute path to that repo's own venv Python interpreter, or `null`
   * exactly when `repoPath` is `null`. */
  pythonPath: string | null
  /** Which of the three resolution sources actually matched — surfaced in
   * status messages so "why didn't this work" is never a guess. */
  pathSource: 'env' | 'bundled' | 'dev-sibling' | 'unresolved'
  /** Matches `adapters/vision/config.ts`'s `DEFAULT_VISION_API_CONFIG.baseUrl`
   * exactly — the one place both the renderer's HTTP client and this
   * supervisor's spawn/health-check logic agree on where VISION lives, so
   * they can never drift apart the way V1's two hardcoded launcher ports did. */
  baseUrl: string
  host: string
  port: number
  /** Group 8 (Packaging + Release Gate): where MAT's own state lives —
   * `mat_laws.json`, `principals.json`, learned skills, backups, memory
   * idempotent locks, everything `ops/config.py`'s `MAT_DATA_DIR` controls.
   * Real bug found during packaging audit: this app previously never set
   * `MAT_DATA_DIR` at all, so the backend fell back to its own default (a
   * plain relative `"data"` path, resolved against `cwd` — which
   * `supervisor.ts` sets to `repoPath`). For a source checkout that's
   * merely untidy; for a packaged install where `repoPath` resolves under
   * `<resourcesPath>` (see `resolveRuntimePath`'s `'bundled'` case), that
   * directory is the app's own install/resources tree — not guaranteed
   * writable by a non-admin user, and destroyed wholesale by every
   * uninstall or update. `app.getPath('userData')` is the same per-user,
   * writable, update-safe location `log.ts` already uses for this app's
   * own logs — MAT's data now lives there too, under its own `data`
   * subfolder so it never collides with Electron's own userData contents. */
  dataDir: string
}

function resolveBaseUrl(): string {
  return process.env.VITE_MAT_API_BASE_URL ?? 'http://127.0.0.1:8000'
}

function hasVenvPython(candidate: string): boolean {
  return fs.existsSync(pythonPathFor(candidate))
}

function pythonPathFor(repoPath: string): string {
  return path.join(repoPath, '.venv', process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python')
}

/**
 * Deterministic resolution order — first candidate that actually contains a
 * real venv Python wins, not just the first one that's merely set:
 *
 * 1. `MAT_RUNTIME_PATH` — explicit, always wins outright (even if the venv
 *    turns out missing, so the resulting error message points at exactly
 *    what the user configured, not a fallback they never asked for).
 * 2. A runtime bundled alongside this app's own packaged resources
 *    (`<resourcesPath>/MAT-AI-OS-V2`, via electron-builder's `extraResources`
 *    once packaging actually populates it — this is the *resolution* order
 *    a packaged app needs, not the packaging step itself, which stays out
 *    of scope: MAT-AI-OS-V2 stays a standalone, independently-installed repo).
 * 3. Dev convention: MAT-AI-OS-V2 checked out as a sibling of this repo,
 *    same convention already used for the linked presence-orb/brain-view
 *    packages — only tried when not packaged, since a packaged build has no
 *    dev-time sibling folder to find at all.
 */
function resolveRuntimePath(): { repoPath: string; source: RuntimeConfig['pathSource'] } | null {
  if (process.env.MAT_RUNTIME_PATH) return { repoPath: process.env.MAT_RUNTIME_PATH, source: 'env' }

  if (app.isPackaged) {
    const bundled = path.join(process.resourcesPath, 'MAT-AI-OS-V2')
    if (hasVenvPython(bundled)) return { repoPath: bundled, source: 'bundled' }
    return null
  }

  const devSibling = path.resolve(process.cwd(), '..', 'MAT-AI-OS-V2')
  return { repoPath: devSibling, source: 'dev-sibling' }
}

export function loadRuntimeConfig(): RuntimeConfig {
  const resolved = resolveRuntimePath()
  const baseUrl = resolveBaseUrl()
  const url = new URL(baseUrl)
  return {
    repoPath: resolved?.repoPath ?? null,
    pythonPath: resolved ? pythonPathFor(resolved.repoPath) : null,
    pathSource: resolved?.source ?? 'unresolved',
    baseUrl,
    host: url.hostname,
    port: Number(url.port || '80'),
    dataDir: path.join(app.getPath('userData'), 'data'),
  }
}
