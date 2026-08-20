/**
 * The one source of truth for every IPC channel this app exposes to the renderer.
 *
 * Zero Node/Electron imports on purpose — plain strings and types only, so this
 * file is safe to `import type` from the renderer (erased at compile time, never
 * bundled) without pulling any Node/Electron code across the trust boundary.
 *
 * This is the allowlist: main only ever registers handlers for channels named
 * here, and preload only ever exposes wrappers for channels named here. Adding
 * OS-control capability later means adding a new narrowly-typed entry here (own
 * channel name, own request/response shape) — never a generic
 * `invoke(channel, ...args)` passthrough. See docs/ELECTRON_ARCHITECTURE.md.
 */

export const IPC_CHANNELS = {
  ping: 'mat:ping',
} as const

export type IpcChannel = (typeof IPC_CHANNELS)[keyof typeof IPC_CHANNELS]

export interface PingResponse {
  ok: true
  pong: string
  timestamp: number
}

/** The exact shape `contextBridge.exposeInMainWorld` puts on `window.mat`. */
export interface MatBridgeApi {
  ping: () => Promise<PingResponse>
}
