import { ipcMain } from 'electron'
import { IPC_CHANNELS, type PingResponse, type QdrantStatus, type RuntimeStatus, type TelemetrySnapshot } from './contract'
import type { RuntimeSupervisor } from '../main/runtime/supervisor'
import type { TelemetryService } from '../main/telemetry/service'
import type { QdrantPreflight } from '../main/qdrant/preflight'

/**
 * Registers exactly one `ipcMain.handle` per allowlisted channel in
 * `contract.ts` — main process only, never imported by preload or renderer.
 * Adding a capability later means adding one more narrowly-scoped `ipcMain.
 * handle(IPC_CHANNELS.xyz, ...)` here, each validating its own input — never a
 * generic dispatcher that forwards an arbitrary channel/command through.
 *
 * The runtime and telemetry channels below take no input at all (no
 * serviceId, no command string) — they only ever act on the one
 * `RuntimeSupervisor`/`TelemetryService` instance `main/index.ts` constructs,
 * matching the "fixed, main-owned set, never an arbitrary path/command from
 * the caller" rule in docs/ELECTRON_ARCHITECTURE.md. Telemetry is read-only
 * on top of that — there is no `ipcMain.handle` that can change anything
 * about the host machine, only report on it.
 */
export function registerIpcHandlers(runtime: RuntimeSupervisor, telemetry: TelemetryService, qdrant: QdrantPreflight): void {
  ipcMain.handle(IPC_CHANNELS.ping, (): PingResponse => ({
    ok: true,
    pong: 'pong',
    timestamp: Date.now(),
  }))

  ipcMain.handle(IPC_CHANNELS.runtimeGetStatus, (): RuntimeStatus => runtime.getStatus())
  ipcMain.handle(IPC_CHANNELS.runtimeStart, (): Promise<RuntimeStatus> => runtime.start())
  ipcMain.handle(IPC_CHANNELS.runtimeStop, (): Promise<RuntimeStatus> => runtime.stop())
  ipcMain.handle(IPC_CHANNELS.runtimeRestart, (): Promise<RuntimeStatus> => runtime.restart())

  ipcMain.handle(IPC_CHANNELS.telemetryGetSnapshot, (): TelemetrySnapshot | null => telemetry.getSnapshot())

  // Read-only, same as telemetry — no start/stop/restart handler exists for
  // Qdrant at all (see QdrantStatus's own doc comment for why).
  ipcMain.handle(IPC_CHANNELS.qdrantGetStatus, (): QdrantStatus => qdrant.getStatus())
}
