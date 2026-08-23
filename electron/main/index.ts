import { app, BrowserWindow } from 'electron'
import { registerIpcHandlers } from '../ipc/handlers'
import { IPC_CHANNELS } from '../ipc/contract'
import { applyContentSecurityPolicy } from './csp'
import { createMainWindow } from './window'
import { RuntimeSupervisor, loadRuntimeConfig } from './runtime'
import { TelemetryService } from './telemetry'
import { QdrantPreflight, loadQdrantConfig } from './qdrant'

/**
 * App metadata. `productName`/`appId` for packaging live in package.json's
 * own `build` block (electron-builder reads that) — this is just the
 * in-process name Electron itself reports (task bar, `app.getName()`, etc).
 */
app.setName('MAT-AI-OS UI V2')

let mainWindow: BrowserWindow | null = null

/**
 * The one `RuntimeSupervisor` instance for this app's lifetime — owns
 * spawning/attaching/watching MAT-AI-OS-V2 (see `runtime/supervisor.ts`).
 * Constructed here rather than in `whenReady` so its status is available to
 * wire into IPC and the window immediately once the app is ready, without
 * a second layer of "is it constructed yet" checks.
 */
const runtime = new RuntimeSupervisor(loadRuntimeConfig())

/**
 * Real host-machine telemetry (CPU/RAM/GPU/network) for the HUD header's
 * chart slots — see `telemetry/service.ts`. Deliberately separate from
 * `runtime`: this is about the PC, not about MAT, and its poll loop starts/
 * stops with window visibility rather than the app's own lifetime.
 */
const telemetry = new TelemetryService()

/**
 * Qdrant preflight — see `qdrant/preflight.ts`. `ensure()` runs (and always
 * resolves, bounded) before `runtime.initialize()` below: "Launcher starts
 * -> ensure Qdrant -> start/attach MAT -> UI live." A Qdrant that couldn't
 * be found or started never blocks MAT itself, which has its own real,
 * already-tested degraded-memory tolerance for exactly that case.
 */
const qdrant = new QdrantPreflight(loadQdrantConfig())

// Electron's own security guidance: renderers must never be able to spawn
// this app's process a second time or bypass single-instance locking in a way
// that leaves two windows fighting over the same backend session.
const gotSingleInstanceLock = app.requestSingleInstanceLock()
if (!gotSingleInstanceLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
    }
  })

  app.whenReady().then(async () => {
    applyContentSecurityPolicy(process.env.VITE_DEV_SERVER_URL, loadRuntimeConfig().baseUrl)
    registerIpcHandlers(runtime, telemetry, qdrant)
    mainWindow = createMainWindow()

    // Push every runtime/qdrant transition to the renderer as it happens —
    // registered before either one's own async work starts so the very
    // first "checking" -> ... sequence isn't missed by a window that mounts
    // after it already started.
    qdrant.on('status', (status) => {
      mainWindow?.webContents.send(IPC_CHANNELS.qdrantStatusChanged, status)
    })
    runtime.on('status', (status) => {
      mainWindow?.webContents.send(IPC_CHANNELS.runtimeStatusChanged, status)
    })

    // "Launcher starts -> ensure Qdrant -> start/attach MAT -> UI live":
    // `ensure()` always resolves (bounded, never throws) before MAT itself
    // is asked to start/attach, whether Qdrant was found, started, or
    // genuinely unavailable — see `QdrantPreflight.ensure()`'s own doc
    // comment for why a failure here still lets this proceed.
    await qdrant.ensure()
    void runtime.initialize()

    // Same push pattern as `runtime`'s status, on its own channel/cadence —
    // registered before `start()` for the same "don't miss the first one"
    // reason.
    telemetry.on('snapshot', (snapshot) => {
      mainWindow?.webContents.send(IPC_CHANNELS.telemetrySnapshotChanged, snapshot)
    })
    telemetry.start()

    app.on('activate', () => {
      // macOS convention: clicking the dock icon with no window open reopens one.
      if (BrowserWindow.getAllWindows().length === 0) {
        mainWindow = createMainWindow()
        void qdrant.ensure().then(() => runtime.initialize())
        telemetry.start()
      }
    })
  })

  app.on('window-all-closed', () => {
    // Telemetry polls the host machine purely for this window's own HUD —
    // no reason to keep sampling CPU/RAM/GPU/network with nothing showing
    // it (task: "stop polling/subscriptions cleanly when window closes").
    // Unlike `runtime`, this has no bearing on MAT's own lifecycle either
    // way — it never has been queried for or influenced that.
    telemetry.stop()
    if (process.platform !== 'darwin') app.quit()
  })

  // Deliberately no MAT shutdown here — see `RuntimeSupervisor`'s own doc
  // comment. V1 left backend processes running independent of the UI
  // window's lifecycle; closing this window stops rendering, not MAT.
  // Same for Qdrant, whether this app started it or attached to it — see
  // `QdrantPreflight`'s own doc comment; there is no stop path for it at all.
}
