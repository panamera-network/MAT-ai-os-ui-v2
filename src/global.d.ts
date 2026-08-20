// Type-only import — erased at compile time, never bundled. This is the one
// place the renderer references anything under electron/, and only for the
// shape of what preload exposed, never for runtime Node/Electron code.
import type { MatBridgeApi } from '../electron/ipc/contract'

export {}

declare global {
  interface Window {
    /**
     * Present only inside the Electron shell (undefined in a plain browser
     * tab/preview) — every access from renderer code must feature-detect
     * with `window.mat?.`, never assume it exists.
     */
    mat?: MatBridgeApi
  }
}
