import { contextBridge, ipcRenderer } from 'electron'
import { IPC_CHANNELS, type MatBridgeApi, type PingResponse, type RuntimeStatus } from '../ipc/contract'

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
  runtime: {
    getStatus: () => ipcRenderer.invoke(IPC_CHANNELS.runtimeGetStatus) as Promise<RuntimeStatus>,
    start: () => ipcRenderer.invoke(IPC_CHANNELS.runtimeStart) as Promise<RuntimeStatus>,
    stop: () => ipcRenderer.invoke(IPC_CHANNELS.runtimeStop) as Promise<RuntimeStatus>,
    restart: () => ipcRenderer.invoke(IPC_CHANNELS.runtimeRestart) as Promise<RuntimeStatus>,
    onStatusChanged: (listener: (status: RuntimeStatus) => void) => {
      const wrapped = (_event: Electron.IpcRendererEvent, status: RuntimeStatus) => listener(status)
      ipcRenderer.on(IPC_CHANNELS.runtimeStatusChanged, wrapped)
      return () => ipcRenderer.removeListener(IPC_CHANNELS.runtimeStatusChanged, wrapped)
    },
  },
}

contextBridge.exposeInMainWorld('mat', matBridge)
