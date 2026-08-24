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

The allowlist today: `mat:ping`, and five `mat:runtime:*` channels for the
MAT-AI-OS-V2 process supervisor — see "Runtime supervision" below.

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
| Owns | MAT's own state: agents, loops, memory, skills, models, governance, soul/identity, MAT process lifecycle (once running) | This app's OS-level access: windowing, and starting/stopping the MAT-AI-OS-V2 *process itself* |
| Reached via | `fetch()` against `http://127.0.0.1:8000`, from `adapters/` (built — see `src/adapters/vision/`) | `window.mat.*`, from the preload bridge |
| Runs | A separate process (`python -m ops`, spawned by `electron/main/runtime/` — see below), possibly on another machine | In-process with this app, as its own main process |
| Security model | Optional `X-API-Key` header, CORS wide open by design (see the contract doc) | contextIsolation + explicit per-capability IPC allowlist |

Concretely: "is MAT's Body attached and running" is a VISION API question
(`GET /control/status`, already wired — see `useHealth`/`useBodyControl`). "Is the
`python -m ops` *process* running at all, and who's going to start it" is an
Electron question — that's `runtime/` below. The renderer's `adapters/` layer
calls the VISION API directly over HTTP exactly as a browser tab could — Electron
does not proxy or wrap that traffic; it only ever gets MAT's process running in
the first place.

## Runtime supervision (`electron/main/runtime/`)

Electron main's answer to "opening the UI should bring MAT online automatically,"
without embedding any of that logic in React (`src/` never spawns a process, reads
a path, or knows what `python -m ops` is — it only ever sees a `RuntimeStatus`).

```
electron/main/runtime/
├── config.ts       — resolves MAT-AI-OS-V2's repo path (env -> bundled -> dev
│                     sibling), venv python, host/port
├── portProbe.ts     — "is anything already listening" (TCP connect) + port-owner kill
├── healthCheck.ts    — GET /health, the one real "is VISION actually serving" signal
├── log.ts             — python -m ops's stdout/stderr -> userData/logs/mat-ops.log
└── supervisor.ts       — RuntimeSupervisor: owns the child process, the watchdog,
                          and every state transition
```

**Runtime path resolution** (`config.ts`), first candidate that actually exists wins:
1. `MAT_RUNTIME_PATH` env var — explicit, always wins even if what it points to
   turns out invalid (the resulting error names exactly what was configured).
2. `<process.resourcesPath>/MAT-AI-OS-V2` — a packaged build's bundled runtime,
   once electron-builder's `extraResources` is set up to actually place one there
   (this is the *resolution order* a packaged app needs; populating that location
   is separate packaging work, out of scope here — MAT-AI-OS-V2 stays standalone).
3. `../MAT-AI-OS-V2` sibling checkout — dev-only fallback, same convention as the
   linked presence-orb/brain-view packages.
Resolving to nothing (packaged, no env var, no bundled runtime found) leaves
`repoPath`/`pythonPath` as `null` — `start()` reports a clear `error` state
("MAT-AI-OS-V2 runtime not found ... set MAT_RUNTIME_PATH") rather than crashing
or guessing a path. *Attaching* to an already-running instance still works in this
state, since that path only needs `host`/`port`/`baseUrl`, never a resolved repo.

**(Group 8, Packaging + Release Gate) — unlike Qdrant above, the Python runtime
bundling step (populating `<resourcesPath>/MAT-AI-OS-V2` with a working venv +
~106 installed packages, ~1.1GB, dominated by `torch`/`sentence-transformers`)
remains a genuine, unaddressed BLOCKER for shipping a packaged installer** — there
is no PyInstaller/Nuitka/embeddable-Python spec or equivalent anywhere in either
repo, and freezing that dependency tree is realistically multi-day work, not a
same-pass fix like Qdrant's single self-contained binary was. Until that exists,
a packaged build only works via `MAT_RUNTIME_PATH` pointed at a real, already-
provisioned MAT-AI-OS-V2 checkout+venv on the end user's machine — not yet a
true "install and go" experience for the Python side.

`RuntimeConfig.dataDir` (Group 8) is `app.getPath('userData')/data`, passed to
the spawned `python -m ops` child as `MAT_DATA_DIR` (`supervisor.ts`) — real bug
fix: this was never set before, so the backend's own `data_dir` default (a
plain relative `"data"`, resolved against `cwd` = `repoPath`) would have landed
inside a packaged install's own resources tree once bundling ships — not
guaranteed writable, and wiped by every reinstall/update. Now it's per-user and
update-safe, same location `log.ts` already used for this app's own logs.

`main/index.ts` constructs one `RuntimeSupervisor`, calls `initialize()` once at
startup, and forwards every `'status'` event it emits to the renderer over
`mat:runtime:statusChanged`. Five IPC channels, all in `contract.ts`:
`runtimeGetStatus`/`Start`/`Stop`/`Restart` (invoke/handle) and
`runtimeStatusChanged` (push-only, `webContents.send` — not `invoke`d, since it's
main telling the renderer something changed, not the renderer asking a question).
`src/hooks/useRuntime.ts` is the one renderer-side consumer.

**Startup flow**: probe the configured host:port. Something already listening ->
confirm it's healthy and *attach* (`owned: false` — this app never spawns a second
instance or touches a process it didn't start). Nothing listening -> spawn
`<repoPath>/.venv/Scripts/python.exe -m ops` (`owned: true`), poll `/health` until
it answers or a timeout elapses.

**`.env.mat`/`.env.body` (`electron/main/runtime/envFile.ts`)**: `ops` itself
deliberately never auto-loads these — `ops.config.load_config()` reads straight
from real process environment variables, no dotenv anywhere in that codebase.
This app reads them on the operator's behalf instead: before every spawn (never
on attach — nothing to configure for a process this app didn't start),
`.env.mat` then `.env.body` (overriding on any shared key — `.env.body`'s own
key set is the superset) are folded into the child's `env`, real process env
always winning over the file. `ops` itself still only ever sees plain
environment variables, exactly as before — this only changes who populates
them. One key is deliberately excluded: `MAT_API_KEY` enables `X-API-Key` auth
on every VISION route except `/health`, and the renderer's own
`RestVisionApiAdapter` only sends that header when `VITE_MAT_API_KEY` is set in
its own separate Vite-time environment — auto-loading `MAT_API_KEY` here alone
(real bug found via live testing) silently locked the renderer out of its own
backend. Excluded until both sides are wired together deliberately.

**Ownership rule**: `owned` is only ever true once this app has confirmed *it*
spawned the current process. It governs how `stop()` works (a real child-process
handle + graceful `POST /control/stop` first, vs. a port-owner-PID lookup for an
attached process) and how the watchdog decides whether to auto-restart (only ever
a process this app owns *and* has confirmed actually exited — never a live-but-
slow process, ours or attached, gets killed automatically).

**Quit behavior**: closing this app's window never stops MAT, regardless of who
started it — matches V1's own precedent of leaving backend processes running
independent of the UI window's lifecycle. There is no shutdown-on-quit path to
disable; none was ever added.

There *was*, however, a real Windows-specific way this broke without any such
path existing: Windows assigns Electron's process to a Job Object with
kill-on-close semantics, which by default kills every process assigned to that
job — including any plain child process this app spawns — the instant
Electron's own process ends, `app.quit()` or a forceful `taskkill` alike.
Confirmed live: killing `electron.exe` alone took a still-healthy MAT process
down with it. `spawn()`'s `detached: true` (`supervisor.ts`) is the fix —
Windows' `CREATE_NEW_PROCESS_GROUP`, which keeps the spawned `python -m ops`
out of that job object — paired with `child.unref()` so this app's own event
loop isn't held open by the reference either. Verified: MAT now survives
`taskkill /F /IM electron.exe`, and a freshly reopened instance correctly
*attaches* to it (`status -> attaching -> ready: Attached to an
already-running MAT`) rather than spawning a second one.

**Singleton enforcement lives on the MAT-AI-OS-V2 side, not here.**
`probePort` narrows the race but can't close it (classic TOCTOU: two launchers can
both see "nothing listening" a moment apart). The actual guarantee is
`ops/lock.py` (MAT-AI-OS-V2 repo): `python -m ops` acquires a real OS-level
advisory file lock (`msvcrt.locking`/`fcntl.flock`) on `data/ops-<port>.lock`
*before* doing any expensive construction — a second `python -m ops` on the same
port fails fast (`SystemExit(1)`, clear log line) instead of either double-serving
or wastefully finishing ~15s of startup work first. The kernel releases the lock
automatically when the holding process's file handle closes for any reason,
including a crash or a forceful kill — there is no stale-lock state to detect or
clean up; a fresh process trying the same port right after simply acquires it.
This app's supervisor surfaces that failure like any other exit (see
`RuntimeSupervisor`'s `lastStderrLine`-annotated exit handling) rather than
reimplementing the lock itself.

## PC telemetry (`electron/main/telemetry/`)

The HUD header's CPU/RAM/GPU/Network slots read real host-machine numbers —
deliberately unrelated to `runtime/`: this is about the PC Electron is running on,
not about MAT or VISION, and it works identically whether MAT is up, down, or
never configured at all.

```
electron/main/telemetry/
├── service.ts — TelemetryService: polls the host every 1.5s, emits 'snapshot'
└── index.ts   — barrel
```

**Source**: the `systeminformation` package (zero dependencies) — `si.
currentLoad()` for CPU%, `si.mem()` for RAM used/total, `si.graphics()` for GPU
utilization/VRAM, `si.networkStats()` for live rx/tx bytes-per-second.
`node:os` alone can't cover this: it has no GPU introspection at all, and its
network counters are cumulative totals since interface-up, not a rate — the
main reason this task pulled in a small dependency instead of staying
dependency-free like `runtime/`'s own modules.

**GPU is honestly degraded, not faked.** `si.graphics()` depends entirely on
what the host's controller/driver actually reports back through Windows'
management interfaces, which varies by GPU vendor and driver version. When
`utilizationGpu`/VRAM fields come back undefined, `TelemetryService` reports
`usagePercent: null` (and `vramUsedBytes`/`vramTotalBytes: null`) rather than a
fabricated number — the renderer shows `Unavailable` in that case (see
`HudStatus.tsx`), never a zero or stale value dressed up as live.

**IPC**: one request/response channel (`telemetryGetSnapshot`, for the
renderer's first paint before any push has arrived) and one push channel
(`telemetrySnapshotChanged`, `webContents.send` on every poll tick) — the same
invoke/push split as `runtime/`, both allowlisted in `contract.ts`'s
`TelemetrySnapshot` type. Read-only: there is no handler that can change
anything about the host, matching `docs`'s existing no-generic-IPC rule.
`src/hooks/useTelemetry.ts` is the one renderer-side consumer, mirroring
`useRuntime.ts`'s subscribe/unsubscribe shape but with no actions of its own.

**Lifecycle**: `main/index.ts` constructs one `TelemetryService`, starts its
poll loop once the main window exists, and stops it in `window-all-closed` —
before the quit check, so the interval is always cleared even on platforms
where the app itself stays alive (macOS). A macOS `activate` reopen restarts
polling along with the window. Unlike `runtime`, closing the window has no
special-case reasoning to preserve here: there's no host process to keep alive
independent of anything, so stopping the poll loop on close is simply correct,
not a deliberate exception.

## Qdrant preflight (`electron/main/qdrant/`)

"Launcher starts -> ensure Qdrant -> start/attach MAT -> UI live." Qdrant is
external infrastructure MAT-AI-OS-V2 already tolerates going missing (its own
documented degraded-memory mode, restored in a prior task) — this preflight
exists only to give that mode a fair chance not to be needed, by trying to
have a local Qdrant up before MAT itself starts, never to make Qdrant a hard
requirement.

```
electron/main/qdrant/
├── config.ts    — resolves the qdrant executable path (env -> bundled ->
│                  known dev location), host/port
└── preflight.ts — QdrantPreflight: a one-shot check-then-maybe-spawn,
                   never a supervisor
```

**Path resolution** (`config.ts`), same "first candidate that actually
exists wins" shape as `runtime/config.ts`'s own `RuntimeConfig`:
1. `QDRANT_RUNTIME_PATH` env var — always wins outright, even if invalid.
2. `<process.resourcesPath>/qdrant/qdrant(.exe)` — a packaged build's bundled
   binary. **(Group 8, Packaging + Release Gate) — this is now real, not just
   a resolution stub:** `scripts/fetch-qdrant.mjs` downloads one pinned Qdrant
   release's Windows binary (`qdrant-x86_64-pc-windows-msvc.zip` from Qdrant's
   own GitHub releases) into `resources/qdrant/qdrant.exe`, and `package.json`'s
   `build.extraResources` bundles that folder into every packaged build at
   exactly this path. `npm run dist:electron` runs the fetch automatically
   (`predist` step); `npm run fetch:qdrant` runs it standalone. The downloaded
   binary itself is gitignored (`resources/qdrant`) — a ~80MB third-party
   binary has no business living in source control; every build fetches (or,
   after the first run, idempotently reuses) the pinned version fresh.
3. `D:\qdrant\qdrant.exe` — this machine's known local dev install, tried
   only when not packaged and only on Windows. Never the only production
   strategy — a packaged build with no bundled binary and no env override
   simply finds nothing, same honest `unresolved` shape `RuntimeConfig` uses.

**`ensure()`** (called once, before `runtime.initialize()`, and safe to call
again e.g. on a macOS `activate` reopen without spawning a duplicate): probe
`host:port` (default `127.0.0.1:6333`, matching `mat_core_lib`'s own
`QDRANT_HOST`/`QDRANT_PORT` env var names/defaults) — reachable means
*attach* (`owned: false`, never spawns a second instance). Not reachable and
no executable resolved, or the spawn itself fails, or it never binds the
port within a bounded window (20s) — all three degrade to an honest
`offline` status with a real reason, and `ensure()` still returns normally.
**It never throws, never blocks MAT startup, and never retries** — a failure
here just means `runtime.initialize()` runs next exactly as if this preflight
didn't exist, and MAT's own existing degraded-memory tolerance takes it from
there.

**Ownership and quit behavior**: identical philosophy to `RuntimeSupervisor` —
`owned` is only ever true once this app has confirmed *it* spawned the
current Qdrant process (`spawn(..., cwd: <qdrant's own directory>,
detached: true)`, `child.unref()`, same Windows Job Object reasoning as
MAT's own spawn). There is no stop/restart path for Qdrant anywhere in this
module — closing the UI never stops Qdrant, owned or not, and an externally
-owned instance is never touched. Verified live: killing this app's own
Electron process (not the whole tree) leaves a self-started Qdrant running;
reopening attaches to it without spawning a second one.

**IPC**: `mat:qdrant:getStatus` (invoke/handle) + `mat:qdrant:statusChanged`
(push), both in `contract.ts`'s `QdrantStatus` type
(`checking`/`starting`/`online`/`offline`, `owned`, `message`, `since`) —
read-only, no start/stop/restart handler exists for it at all.
`src/domain`/HUD are untouched: the Memory panel's Qdrant row already reads
`/memory`'s own `health.qdrant` (MAT's own live probe) as its authoritative
source, which is a different fact from "did *this app* find or start a local
Qdrant" — this status exists for the renderer to consume later if needed,
without redesigning anything today.

**A real bug this task's own live testing found and fixed**: a genuinely
healthy MAT took ~84s to answer `/health` on a cold start (Qdrant recovering
several pre-existing collections, plus MAT's own real sentence-transformers/
torch embedder load) — comfortably starving `RuntimeSupervisor`'s previous
45s `START_TIMEOUT_MS` and reporting a false `unreachable` on a MAT that was
actually fine. Bumped to 120s, with real measured margin, not a guess.

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
