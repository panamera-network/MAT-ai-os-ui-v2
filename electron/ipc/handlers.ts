import { ipcMain } from 'electron'
import { IPC_CHANNELS, type PingResponse, type RuntimeStatus } from './contract'
import type { RuntimeSupervisor } from '../main/runtime/supervisor'

/**
 * Registers exactly one `ipcMain.handle` per allowlisted channel in
 * `contract.ts` — main process only, never imported by preload or renderer.
 * Adding a capability later means adding one more narrowly-scoped `ipcMain.
 * handle(IPC_CHANNELS.xyz, ...)` here, each validating its own input — never a
 * generic dispatcher that forwards an arbitrary channel/command through.
 *
 * The runtime channels below take no input at all (no serviceId, no
 * command string) — they only ever act on the one `RuntimeSupervisor`
 * instance `main/index.ts` constructs, matching the "fixed, main-owned set,
 * never an arbitrary path/command from the caller" rule in
 * docs/ELECTRON_ARCHITECTURE.md.
 */
export function registerIpcHandlers(runtime: RuntimeSupervisor): void {
  ipcMain.handle(IPC_CHANNELS.ping, (): PingResponse => ({
    ok: true,
    pong: 'pong',
    timestamp: Date.now(),
  }))

  ipcMain.handle(IPC_CHANNELS.runtimeGetStatus, (): RuntimeStatus => runtime.getStatus())
  ipcMain.handle(IPC_CHANNELS.runtimeStart, (): Promise<RuntimeStatus> => runtime.start())
  ipcMain.handle(IPC_CHANNELS.runtimeStop, (): Promise<RuntimeStatus> => runtime.stop())
  ipcMain.handle(IPC_CHANNELS.runtimeRestart, (): Promise<RuntimeStatus> => runtime.restart())
}
