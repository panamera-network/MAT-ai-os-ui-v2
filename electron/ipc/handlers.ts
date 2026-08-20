import { ipcMain } from 'electron'
import { IPC_CHANNELS, type PingResponse } from './contract'

/**
 * Registers exactly one `ipcMain.handle` per allowlisted channel in
 * `contract.ts` — main process only, never imported by preload or renderer.
 * Adding a capability later means adding one more narrowly-scoped `ipcMain.
 * handle(IPC_CHANNELS.xyz, ...)` here, each validating its own input — never a
 * generic dispatcher that forwards an arbitrary channel/command through.
 */
export function registerIpcHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.ping, (): PingResponse => ({
    ok: true,
    pong: 'pong',
    timestamp: Date.now(),
  }))
}
