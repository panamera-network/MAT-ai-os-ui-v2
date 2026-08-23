import fs from 'node:fs'
import path from 'node:path'

/**
 * Minimal `KEY=value` parser for MAT-AI-OS-V2's own `.env.mat`/`.env.body`
 * files — not the `dotenv` package: this is a handful of lines for a format
 * these files already use consistently (plain `KEY=value`, `#` comments,
 * blank lines), not worth a new dependency for. No multi-line values,
 * no variable expansion, no export-prefix handling — anything fancier than
 * what these two real files actually contain is deliberately unsupported
 * rather than guessed at.
 */
function parseEnvFile(contents: string): Record<string, string> {
  const result: Record<string, string> = {}
  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue
    const eq = line.indexOf('=')
    if (eq === -1) continue
    const key = line.slice(0, eq).trim()
    if (!key) continue
    let value = line.slice(eq + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"') && value.length >= 2) ||
      (value.startsWith("'") && value.endsWith("'") && value.length >= 2)
    ) {
      value = value.slice(1, -1)
    }
    result[key] = value
  }
  return result
}

/**
 * Deliberately never auto-loaded into MAT's own env — see `MAT_API_KEY`'s own
 * entry for why. Extend this (never remove `MAT_API_KEY` from it) if a future
 * `.env.mat`/`.env.body` key turns out to gate something the renderer itself
 * needs to know about to keep working.
 */
const EXCLUDED_KEYS = new Set([
  // Flipping this on enables `X-API-Key` auth for every VISION route except
  // `/health` (see `api/app.py`'s `_require_principal`). The renderer's own
  // `RestVisionApiAdapter` only sends that header when `VITE_MAT_API_KEY` is
  // set in *its own* build/dev-server environment (a Vite-time value, wired
  // completely separately from this file) — real bug found via this task's
  // own live testing: auto-loading `MAT_API_KEY` here silently locked the
  // renderer out of every route except `/health` with no matching frontend
  // change to send the key back. Until both sides are wired together
  // deliberately, this one key is excluded so auth stays off, matching this
  // app's working behavior before `.env.mat`/`.env.body` were ever read.
  'MAT_API_KEY',
])

/**
 * MAT-AI-OS-V2 itself deliberately never auto-loads these (`ops/__main__.py`'s
 * own documented "no .env/dotenv loading exists anywhere in this codebase" —
 * `ops.config.load_config()` reads straight from real process environment
 * variables). That design stays intact: this reads the files from Electron's
 * side and folds their values into the *env this app itself constructs* for
 * the spawned `python -m ops` child (see `supervisor.ts`'s `start()`) —
 * `ops` still only ever sees plain process environment variables, exactly as
 * it always has, just populated by this launcher instead of a person's shell.
 *
 * `.env.body` loaded after `.env.mat` and overriding it on any shared key —
 * `.env.body`'s own key set is the strict superset of `.env.mat`'s (QDRANT_*,
 * calendar/mail/voice integrations `.env.mat` doesn't have at all), so it's
 * treated as the more complete/authoritative of the two where they disagree.
 * Missing files are silently skipped (not every install has both, or either)
 * — this is a convenience layer, never a requirement.
 */
export function loadMatEnvFileOverrides(repoPath: string): Record<string, string> {
  const merged: Record<string, string> = {}
  for (const filename of ['.env.mat', '.env.body']) {
    const filePath = path.join(repoPath, filename)
    try {
      if (!fs.existsSync(filePath)) continue
      Object.assign(merged, parseEnvFile(fs.readFileSync(filePath, 'utf-8')))
    } catch {
      // A malformed or unreadable file is a convenience-layer miss, not a
      // reason to fail startup — MAT still starts with whatever real process
      // environment variables are already set.
    }
  }
  for (const key of EXCLUDED_KEYS) delete merged[key]
  return merged
}
