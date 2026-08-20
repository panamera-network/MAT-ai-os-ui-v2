import { contextBridge, ipcRenderer } from 'electron'
import { IPC_CHANNELS, type MatBridgeApi, type PingResponse } from '../ipc/contract'

/**
 * The ONLY place `ipcRenderer` is ever touched. `contextIsolation: true` +
 * `contextBridge` means the renderer's `window` never sees `ipcRenderer`,
 * `require`, `process`, or any other Node global — only the exact, narrow
 * function surface built here. No passthrough of a channel name or arbitrary
 * arguments from the renderer is exposed; each method below is one
 * allowlisted channel from `contract.ts`, wrapped as its own typed function.
 */
const matBridge: MatBridgeApi = {
  ping: () => ipcRenderer.invoke(IPC_CHANNELS.ping) as Promise<PingResponse>,
}

contextBridge.exposeInMainWorld('mat', matBridge)
