import { BrowserWindow, shell } from 'electron'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// This file is built to ESM (package.json has "type": "module"), which has no
// `__dirname` global — derive it from `import.meta.url` instead, the standard
// ESM equivalent.
const dirname = path.dirname(fileURLToPath(import.meta.url))

/**
 * Every security-relevant `webPreferences` flag is set explicitly here, even
 * where it matches Electron's own default, so the security posture is legible
 * in one place rather than relying on defaults that could silently change
 * across Electron versions. See docs/ELECTRON_ARCHITECTURE.md's "Security"
 * section for what each one prevents.
 */
export function createMainWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 600,
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(dirname, '../preload/index.mjs'),
      contextIsolation: true,
      nodeIntegration: false,
      nodeIntegrationInWorker: false,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
      webviewTag: false,
    },
  })

  win.once('ready-to-show', () => win.show())

  // Dev-only: surface renderer console output in the main process's own
  // stdout, so "did the app load / did the IPC ping resolve" is verifiable
  // from a terminal, not just by eyeballing the window.
  if (process.env.VITE_DEV_SERVER_URL) {
    win.webContents.on('console-message', (event) => {
      console.log(`[renderer] ${event.message}`)
    })
  }

  // Security checklist: never let renderer content open new native windows or
  // navigate this window away from the app's own origin — everything else
  // (a real external link, once the app has one) goes to the OS browser
  // instead of a second unmanaged BrowserWindow.
  win.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url)
    return { action: 'deny' }
  })

  win.webContents.on('will-navigate', (event) => {
    const { url } = event
    const target = new URL(url)
    const isDevServer = process.env.VITE_DEV_SERVER_URL && url.startsWith(process.env.VITE_DEV_SERVER_URL)
    const isAppFile = target.protocol === 'file:'
    if (!isDevServer && !isAppFile) {
      event.preventDefault()
      void shell.openExternal(url)
    }
  })

  if (process.env.VITE_DEV_SERVER_URL) {
    void win.loadURL(process.env.VITE_DEV_SERVER_URL)
    win.webContents.openDevTools({ mode: 'detach' })
  } else {
    void win.loadFile(path.join(dirname, '../../dist/index.html'))
  }

  return win
}
