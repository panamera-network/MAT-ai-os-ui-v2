import { app, BrowserWindow } from 'electron'
import { registerIpcHandlers } from '../ipc/handlers'
import { applyContentSecurityPolicy } from './csp'
import { createMainWindow } from './window'

/**
 * App metadata. `productName`/`appId` for packaging live in package.json's
 * own `build` block (electron-builder reads that) — this is just the
 * in-process name Electron itself reports (task bar, `app.getName()`, etc).
 */
app.setName('MAT-AI-OS UI V2')

let mainWindow: BrowserWindow | null = null

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

  app.whenReady().then(() => {
    applyContentSecurityPolicy(process.env.VITE_DEV_SERVER_URL)
    registerIpcHandlers()
    mainWindow = createMainWindow()

    app.on('activate', () => {
      // macOS convention: clicking the dock icon with no window open reopens one.
      if (BrowserWindow.getAllWindows().length === 0) {
        mainWindow = createMainWindow()
      }
    })
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
  })
}
