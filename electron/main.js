// Desktop shell: Electron window around the built web app (dist/).
//
// The app is served from a custom `app://` scheme rather than file://, because
// the model and ID map are loaded with fetch(), which doesn't work on file://,
// and absolute paths like /models/... would point at the drive root. A
// standard, secure scheme also gives the app a stable origin, so its
// localStorage (the saved plan) survives restarts and updates.
//
// `electron . --dev` loads the Vite dev server instead (npm run desktop:dev).

import { app, BrowserWindow, net, protocol, shell } from 'electron'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const DIST = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist')
const DEV_URL = 'http://localhost:5173'
const APP_URL = 'app://bundle/index.html'
const isDev = process.argv.includes('--dev')

protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true } },
])

/** Serves app://bundle/<path> from dist/, refusing anything that escapes it. */
function serveDist() {
  protocol.handle('app', (request) => {
    const { pathname } = new URL(request.url)
    const file = path.normalize(path.join(DIST, decodeURIComponent(pathname)))
    if (!file.startsWith(DIST + path.sep)) return new Response('Not found', { status: 404 })
    return net.fetch(pathToFileURL(file).toString())
  })
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 720,
    minHeight: 500,
    title: 'Muscle Explorer',
    backgroundColor: '#0f131a', // matches the app, so no white flash while it loads
    autoHideMenuBar: true,
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true },
  })
  // Links meant for a new tab open in the user's browser, not another app window.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/.test(url)) shell.openExternal(url)
    return { action: 'deny' }
  })
  win.loadURL(isDev ? DEV_URL : APP_URL)
}

app.whenReady().then(() => {
  if (!isDev) serveDist()
  createWindow()
  // macOS keeps apps running with no windows; reopen one from the dock.
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
