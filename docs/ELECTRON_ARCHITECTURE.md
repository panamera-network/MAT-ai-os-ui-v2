# Electron Architecture

How `MAT-AI-OS-UI-V2` is packaged as a desktop app: three processes, one narrow
trust boundary between them, and a hard rule about where OS-control capability is
allowed to live. This is the foundation only — no HUD, no navigation, no VISION
adapter, no real PC-control capability. See [V2_DATA_SURFACE.md](./V2_DATA_SURFACE.md)
for what the app will eventually read/control and
[VISION_API_CONTRACT.md](./VISION_API_CONTRACT.md) for the backend it talks to.

## The three processes

```
electron/
├── main/
│   ├── index.ts     — app lifecycle: single-instance lock, whenReady, window-all-closed, activate
│   └── window.ts     — BrowserWindow creation + every webPreferences security flag
├── preload/
│   └── index.ts       — the ONLY file allowed to touch ipcRenderer; exposes a typed, narrow API
└── ipc/
    ├── contract.ts     — channel names + request/response types (zero Node imports)
    └── handlers.ts      — ipcMain.handle() registrations, one per allowlisted channel
src/                     — the renderer: plain React + Vite, unchanged by adding Electron
```

### Main process (`electron/main/`)

Owns the OS-privileged side of the app: creates the `BrowserWindow`, sets every
security-relevant `webPreferences` flag explicitly, handles app lifecycle (single
instance, quit-on-all-windows-closed except macOS, dock reactivation), and is the
only place that will ever host real Node/OS capability. Registers IPC handlers at
startup — no handler exists until `registerIpcHandlers()` runs in `whenReady`.

### Preload script (`electron/preload/`)

Runs in a special context that can see both a limited set of Node APIs *and* the
page's own `window` — but because `contextIsolation: true` is set, those two worlds
do not share a JS realm. `contextBridge.exposeInMainWorld('mat', matBridge)` is the
one deliberate, narrow bridge between them. This file is short by design: it is the
entire trust boundary, so every line in it is security-relevant.

### Renderer (`src/`)

Ordinary React + Vite, exactly as before Electron was added — same `vite.config.ts`
entry, same `index.html`, same build output. It never imports anything from
`electron/` at runtime (only `import type` for the bridge's shape, which is erased
at compile time — see `src/global.d.ts`). It cannot `require()`, cannot see
`process`, cannot read a file, cannot spawn anything. Its only way to reach the OS
is `window.mat.<method>()`, and only for methods preload chose to expose.

## The IPC trust boundary

```
Renderer (untrusted-by-design, runs arbitrary React/JS)
   │  window.mat.ping()
   ▼
Preload (contextBridge — the ONLY crossing point)
   │  ipcRenderer.invoke('mat:ping')
   ▼
Main (trusted, full Node/OS access)
   │  ipcMain.handle('mat:ping', ...)
   ▼
Handler in electron/ipc/handlers.ts
```

Three rules make this an actual boundary and not just a naming convention:

1. **One shared, Node-free contract file** (`electron/ipc/contract.ts`) is the only
   place a channel name or payload shape is defined. Main's handler and preload's
   wrapper both import from it — they cannot drift apart silently.
2. **Preload never exposes `ipcRenderer` itself**, only one named function per
   channel (`ping: () => ipcRenderer.invoke(IPC_CHANNELS.ping)`). There is no
   `window.mat.invoke(channel, ...args)` passthrough. A generic passthrough would
   make the allowlist meaningless — the renderer could invoke *any* channel main
   ever registers, including ones never meant for it.
3. **Main only ever calls `ipcMain.handle` for channels named in `contract.ts`.**
   An unlisted channel simply has no handler — `ipcRenderer.invoke` on it rejects.
   There is no dynamic/wildcard handler registration anywhere in `electron/`.

The current allowlist has exactly one entry: `mat:ping`. That is the whole surface
today.

## Where future PC-control capability belongs

Every future capability this app gains — file access, launching another app,
reading window/process state, screenshots, input automation, anything — follows the
same three-file pattern `ping` already demonstrates, never a shortcut:

1. Add one new entry to `electron/ipc/contract.ts`: a channel name plus its own
   specific request/response types (e.g. `mat:services:start` taking
   `{ serviceId: string }`, not `{ command: string, args: string[] }`).
2. Add one new `ipcMain.handle(...)` in `electron/ipc/handlers.ts` (or a new file
   under `electron/ipc/handlers/` once there are several) that validates its own
   input and does exactly that one thing.
3. Add one new method to the `matBridge` object in `electron/preload/index.ts`.

**What must never be added**, because it collapses the entire allowlist model back
into "the renderer can ask main to do anything":

- A generic `execute(command: string)`, `run(script: string)`, or
  `invoke(channel: string, ...args: unknown[])` style IPC method.
- Exposing `ipcRenderer`, `shell`, `child_process`, or any other Node/Electron
  module directly through `contextBridge` "for convenience."
- A handler that accepts a file path, shell command, or URL from the renderer
  without validating it against a fixed, main-owned set (the VISION API's own
  `/services/*` — see the contract doc — is the model to follow: a fixed,
  config-driven set of ids, never an arbitrary path/command from the caller).

Real OS-control features (process supervision, file access, automation) belong in
`electron/main/` and get reached through `electron/ipc/`, exactly like `/control/*`
and `/services/*` belong in the VISION API and get reached through HTTP — never
implemented in the renderer, and never given a shape looser than "one channel, one
purpose."

## VISION API vs. Electron: two different jobs

These are not competing ways to do the same thing — they own genuinely different
halves of what this app needs:

| | VISION API (HTTP) | Electron (IPC) |
|---|---|---|
| Owns | MAT's own state: agents, loops, memory, skills, models, governance, soul/identity, MAT process lifecycle | This app's OS-level access: windowing, and (later) local file/process/input capability |
| Reached via | `fetch()` against `http://127.0.0.1:8000`, from `adapters/` (not built yet) | `window.mat.*`, from the preload bridge |
| Runs | A separate process (`ops/startup.py`), possibly on another machine | In-process with this app, as its own main process |
| Security model | Optional `X-API-Key` header, CORS wide open by design (see the contract doc) | contextIsolation + explicit per-capability IPC allowlist |

Concretely: "is MAT running" is a VISION API question (`GET /control/status`). "Is
*this app's window* focused, or can it read a local file" is an Electron question.
The renderer's `adapters/` layer (not implemented yet) will call the VISION API
directly over HTTP exactly as a browser tab could — Electron does not proxy or
wrap that traffic. Electron's only job is the OS-level capability HTTP can't
provide.

## Development and production flow

Both flows go through `vite-plugin-electron/simple`, configured in `vite.config.ts`,
which builds `electron/main` and `electron/preload` as their own Vite/Rollup builds
alongside the renderer — one plugin, one place both processes' bundling is defined.

- **`pnpm dev`** → runs `vite`. The plugin builds main+preload once, launches
  Electron pointed at Vite's dev server (`VITE_DEV_SERVER_URL`), and rebuilds+
  restarts Electron automatically if `electron/main` or `electron/preload` change.
  The renderer gets normal Vite HMR — editing `src/` hot-reloads inside the running
  Electron window exactly like it would in a browser tab.
- **`pnpm build`** → `tsc -p tsconfig.app.json && vite build`. Produces `dist/`
  (the renderer, same as before Electron existed) and `dist-electron/main/` +
  `dist-electron/preload/` (both built as ESM — this package is `"type": "module"`,
  which is why `electron/main/window.ts` derives its own directory from
  `import.meta.url` instead of the CommonJS-only `__dirname`).
- **`pnpm dist:electron`** → `electron-builder`, using the minimal `build` block in
  `package.json` (`appId: com.matai.os.ui.v2`, `productName: MAT-AI-OS UI V2`).
  Not run as part of this foundation's verification — packaging an installer pulls
  large platform-specific tooling on first run and isn't needed to prove the
  architecture works. It's wired and ready for whenever real packaging is needed.
- **`pnpm typecheck`** now runs two `tsc` passes — `tsconfig.app.json` for `src/`
  (DOM types, bundler resolution) and `tsconfig.electron.json` for `electron/`
  (Node types) — because the two processes target genuinely different runtimes and
  sharing one tsconfig would either give the renderer `require`/`process` types it
  must never use, or deny main/preload their real Node types.

## Security

Every flag below is set **explicitly** in `electron/main/window.ts`'s
`webPreferences`, even the ones that already match Electron's own default —
legible in one place beats correct-by-accident:

| Setting | Value | What it prevents |
|---|---|---|
| `contextIsolation` | `true` | Renderer JS and preload JS run in separate contexts — the page can't reach anything preload didn't deliberately publish via `contextBridge`. |
| `nodeIntegration` | `false` | The renderer's `window` has no `require`, no `process`, no Node module access at all. Verified empirically during this task: `window.require`/`window.process`/`window.module` are all `undefined` in the running app. |
| `nodeIntegrationInWorker` | `false` | Closes the same hole for any web worker the renderer might spawn. |
| `sandbox` | `true` | Runs the renderer under Chromium's OS-level sandbox — `contextBridge`/`ipcRenderer` in preload both still work under it, so this costs nothing for the current bridge. |
| `webSecurity` | `true` | Keeps same-origin enforcement on — no loading mixed content or bypassing CORS from inside the app. |
| `webviewTag` | `false` | No `<webview>` element, which has its own historically-risky attack surface. |
| Window open handler | denies all, forwards to OS browser | Renderer content can't spawn a second unmanaged `BrowserWindow` with different (potentially weaker) `webPreferences`. |
| `will-navigate` guard | blocks navigation outside the dev server URL / packaged `file://` origin | Prevents the loaded page from ever navigating itself to an external origin. |
| IPC allowlist | `contract.ts` is the only source of channel names | See "IPC trust boundary" above — no generic dispatcher exists. |
| Content-Security-Policy | set on every response via `session.defaultSession.webRequest.onHeadersReceived` (`electron/main/csp.ts`) | Restricts script/style/connect/img sources; closes the "Insecure Content-Security-Policy" warning Electron logged on every launch before this. |

### Content-Security-Policy (`electron/main/csp.ts`)

Applied via `webRequest.onHeadersReceived` rather than a `<meta>` tag in
`index.html` — Electron's own recommended approach, and it means the renderer
carries zero CSP-related code of its own. One function builds the policy string
from whether `VITE_DEV_SERVER_URL` is set, called once from `main/index.ts` before
the window is created:

- **Production** (`file://` load of the built `dist/index.html`): `script-src
  'self'` only — the built app is one bundled, externally-referenced script, no
  inline script anywhere, so no relaxation is needed or granted.
- **Development** (Vite dev server): `script-src` additionally allows the dev
  server's own origin *and* `'unsafe-inline'`. The `'unsafe-inline'` allowance is
  specifically for `@vitejs/plugin-react`'s React Fast Refresh "preamble" — a small
  inline `<script>` Vite injects before the module entry loads. Without it the
  script is blocked outright and the app never mounts (`Uncaught Error: @vitejs/
  plugin-react can't detect preamble` — reproduced and confirmed while building
  this policy). `connect-src` additionally allows the dev server's `http`/`ws`
  origin for Vite's HMR WebSocket. None of this reaches the packaged build.
- **`style-src 'self' 'unsafe-inline'`** in both modes — Vite's dev-mode CSS
  injection (component styles pushed in via a `<style>` tag for HMR) needs it, and
  `style-src`'s `unsafe-inline` is a materially lower-risk allowance than
  `script-src`'s (no code execution), so one policy shape covers both modes rather
  than maintaining a dev/prod split for this one directive.
- `img-src 'self' data:`, `object-src 'none'`, `base-uri 'self'`, `form-action
  'self'`, `frame-ancestors 'none'` round out the baseline; nothing here has a
  dev/prod difference.

## Verified

- `pnpm typecheck`, `pnpm lint`, `pnpm build` all pass clean.
- `pnpm dev` launches Vite + Electron together; the window loads the React app
  (confirmed via the React DevTools console banner) with working HMR.
- `window.mat.ping()` resolves end to end:
  `{"ok":true,"pong":"pong","timestamp":<ms>}`, captured from the running app's own
  console output forwarded to the main process's stdout.
- `window.require`, `window.process`, and `window.module` are all `undefined` in
  the renderer — checked directly against the running app, not inferred from
  config alone.
- A standalone `pnpm build` + direct launch of the built `dist-electron/main/
  index.js` (production mode, no dev server) also starts and stays running without
  error, confirming the ESM build output and file-based window load
  (`dist/index.html`) both work, not just the dev flow.
- CSP: Electron's "Insecure Content-Security-Policy" warning no longer appears on
  either dev or production launch. Confirmed dev mode mounts React and resolves the
  IPC ping with no CSP violations logged (the pre-fix policy reproducibly broke
  this — see above); confirmed production mode does the same under the stricter
  no-`unsafe-inline`-for-scripts policy.
