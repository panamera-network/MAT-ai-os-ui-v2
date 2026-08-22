import { session } from 'electron'

/**
 * One Content-Security-Policy, applied to every response via
 * `webRequest.onHeadersReceived` rather than a `<meta>` tag in `index.html` —
 * this is Electron's own recommended approach (works regardless of what the
 * loaded page does or doesn't set itself, and keeps dev/prod differences out
 * of the renderer entirely). Fixes the "Insecure Content-Security-Policy"
 * warning Electron logs on every unprotected renderer.
 *
 * `devServerUrl` is `process.env.VITE_DEV_SERVER_URL` — present only under
 * `vite dev` (see electron/main/window.ts). Its origin needs `script-src`/
 * `connect-src` allowances the packaged build never does: Vite's dev server
 * serves the app's own JS from that origin (not inlined into a bundle yet),
 * and its HMR client holds a WebSocket open to the same origin. Production
 * gets none of that — script-src is `'self'` only, matching a plain `file://`
 * load of the built `dist/index.html`.
 *
 * `visionBaseUrl` is the same origin `adapters/vision/config.ts`'s
 * `DEFAULT_VISION_API_CONFIG.baseUrl` resolves to (see
 * `electron/main/runtime/config.ts`, the one place both sides read it from)
 * — without it in `connect-src`, every `fetch()` the renderer's VISION
 * adapter makes is silently blocked by this exact policy. That was true
 * before this file added a `runtime/` supervisor too: the adapter layer
 * existed and called `fetch()` directly (see docs/ELECTRON_ARCHITECTURE.md's
 * "VISION API vs. Electron" table), this allowance was simply missing.
 */
export function applyContentSecurityPolicy(devServerUrl: string | undefined, visionBaseUrl: string): void {
  const devOrigin = devServerUrl ? new URL(devServerUrl).origin : null
  const devWsOrigin = devOrigin ? devOrigin.replace(/^http/, 'ws') : null
  const visionOrigin = new URL(visionBaseUrl).origin

  const policy = [
    "default-src 'self'",
    // Dev only: @vitejs/plugin-react injects a small inline <script> (the
    // React Fast Refresh "preamble") before the module entry loads — without
    // 'unsafe-inline' here it's blocked outright and the app never mounts
    // (confirmed: without this, Chromium logs "Executing inline script
    // violates ... script-src" and React throws "can't detect preamble").
    // The production build has no inline script at all — script-src there
    // stays 'self' only, no dev-mode relaxation carried into the packaged app.
    ['script-src', "'self'", devOrigin ? "'unsafe-inline'" : null, devOrigin].filter(Boolean).join(' '),
    // Vite's dev-mode CSS injection (component styles pushed in via a <style>
    // tag for HMR) needs 'unsafe-inline' here; style-src is a much lower-risk
    // directive than script-src, so this is kept in production too rather
    // than maintaining two separate policies for one low-value difference.
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    ['connect-src', "'self'", devOrigin, devWsOrigin, visionOrigin].filter(Boolean).join(' '),
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join('; ')

  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [policy],
      },
    })
  })
}
