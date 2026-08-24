#!/usr/bin/env node
/**
 * Group 8 (Packaging + Release Gate): makes the packaged build's own
 * `<resourcesPath>/qdrant/qdrant.exe` resolution path (electron/main/qdrant/
 * config.ts's `resolveExecutablePath`) real. Downloads ONE pinned Qdrant
 * release's Windows binary from its official GitHub releases (Qdrant ships
 * as a single self-contained per-platform binary — no dependency tree to
 * freeze, unlike the Python runtime) into resources/qdrant/qdrant.exe,
 * which package.json's `build.extraResources` then bundles into every
 * packaged build.
 *
 * Deliberately NOT committed to git (resources/qdrant/ is gitignored) --
 * a ~30MB binary blob has no business living in source control forever;
 * this script is what CI/a release machine runs instead, same shape as any
 * other "fetch a pinned third-party binary at build time" step. Idempotent:
 * a real second run is a fast no-op if the pinned version is already
 * present.
 *
 * Run via `npm run fetch:qdrant` (invoked automatically by `predist:electron`
 * before `electron-builder` packages the app) or directly:
 *   node scripts/fetch-qdrant.mjs
 */
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import https from 'node:https'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, '..')

// Pinned exactly like MemoryManager's own embedder revision pin (memory_
// manager.py's EMBEDDER_MODEL_REVISION) -- an explicit version, never
// "latest", so every build produced from the same source tree bundles the
// identical binary. Bump deliberately, not silently.
const QDRANT_VERSION = '1.19.0'
const ASSET_NAME = 'qdrant-x86_64-pc-windows-msvc.zip'
const DOWNLOAD_URL = `https://github.com/qdrant/qdrant/releases/download/v${QDRANT_VERSION}/${ASSET_NAME}`

const outDir = path.join(repoRoot, 'resources', 'qdrant')
const outExe = path.join(outDir, 'qdrant.exe')
const versionStamp = path.join(outDir, '.version')

function alreadyFetched() {
  if (!fs.existsSync(outExe) || !fs.existsSync(versionStamp)) return false
  return fs.readFileSync(versionStamp, 'utf8').trim() === QDRANT_VERSION
}

function download(url, destFile) {
  return new Promise((resolve, reject) => {
    const request = (currentUrl, redirectsLeft) => {
      https
        .get(currentUrl, { headers: { 'User-Agent': 'mat-ai-os-ui-v2-fetch-qdrant' } }, (response) => {
          const { statusCode, headers } = response
          if (statusCode && statusCode >= 300 && statusCode < 400 && headers.location) {
            if (redirectsLeft <= 0) {
              reject(new Error(`Too many redirects fetching ${url}`))
              return
            }
            response.resume()
            request(headers.location, redirectsLeft - 1)
            return
          }
          if (statusCode !== 200) {
            reject(new Error(`Unexpected status ${statusCode} fetching ${currentUrl}`))
            response.resume()
            return
          }
          const file = fs.createWriteStream(destFile)
          response.pipe(file)
          file.on('finish', () => file.close(() => resolve()))
          file.on('error', reject)
        })
        .on('error', reject)
    }
    request(url, 5)
  })
}

async function main() {
  if (alreadyFetched()) {
    console.log(`[fetch-qdrant] resources/qdrant/qdrant.exe already at v${QDRANT_VERSION} -- nothing to do.`)
    return
  }
  if (process.platform !== 'win32') {
    // This build only targets Windows today (see package.json's own
    // electron-builder config) -- extraction below uses PowerShell's
    // Expand-Archive, a real Windows-only tool, not a portable one. A
    // future non-Windows target needs its own asset name + extraction step,
    // not a silent wrong-platform binary.
    throw new Error('fetch-qdrant.mjs currently only supports Windows (qdrant-x86_64-pc-windows-msvc.zip).')
  }

  fs.mkdirSync(outDir, { recursive: true })
  const tmpZip = path.join(os.tmpdir(), `qdrant-${QDRANT_VERSION}-${Date.now()}.zip`)
  console.log(`[fetch-qdrant] downloading ${DOWNLOAD_URL} ...`)
  await download(DOWNLOAD_URL, tmpZip)

  const tmpExtractDir = path.join(os.tmpdir(), `qdrant-${QDRANT_VERSION}-${Date.now()}-extract`)
  fs.mkdirSync(tmpExtractDir, { recursive: true })
  console.log('[fetch-qdrant] extracting...')
  execFileSync(
    'powershell.exe',
    ['-NoProfile', '-NonInteractive', '-Command', `Expand-Archive -LiteralPath '${tmpZip}' -DestinationPath '${tmpExtractDir}' -Force`],
    { stdio: 'inherit' },
  )

  const extractedExe = path.join(tmpExtractDir, 'qdrant.exe')
  if (!fs.existsSync(extractedExe)) {
    throw new Error(`Expected qdrant.exe inside the downloaded archive, found none at ${extractedExe}`)
  }
  fs.copyFileSync(extractedExe, outExe)
  fs.writeFileSync(versionStamp, `${QDRANT_VERSION}\n`)

  fs.rmSync(tmpZip, { force: true })
  fs.rmSync(tmpExtractDir, { recursive: true, force: true })

  console.log(`[fetch-qdrant] resources/qdrant/qdrant.exe (v${QDRANT_VERSION}) ready.`)
}

main().catch((err) => {
  console.error('[fetch-qdrant] failed:', err.message)
  process.exit(1)
})
