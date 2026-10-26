// Desktop shell: Electron window around the built web app (dist/).
//
// The app is served from a custom `app://` scheme rather than file://, because
// the model and ID map are loaded with fetch(), which doesn't work on file://,
// and absolute paths like /models/... would point at the drive root. A
// standard, secure scheme also gives the app a stable origin, so its
// localStorage (the saved plan) survives restarts and updates.
//
// `electron . --dev` loads the Vite dev server instead (npm run desktop:dev).
//
// The exercise GIFs aren't in the installer (they're Gym visual's, not ours to
// redistribute). On launch the app checks which are missing and offers to
// download them from the exercises-dataset repo into the user's app data
// folder, where they survive updates and are served as /exercise-gifs/<id>.gif.

import { app, BrowserWindow, dialog, net, protocol, shell } from 'electron'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { rename, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const DIST = path.join(HERE, '..', 'dist')
const DEV_URL = 'http://localhost:5173'
const APP_URL = 'app://bundle/index.html'
const isDev = process.argv.includes('--dev')

/** Exercise id -> GIF path in the dataset repo, written by scripts/gif-manifest.mjs. */
const GIF_MANIFEST = path.join(HERE, 'exercise-gifs.json')
const GIF_SOURCE = 'https://raw.githubusercontent.com/hasaneyldrm/exercises-dataset/main/'
/** Parallel downloads: enough to be quick, few enough not to trip GitHub's rate limits. */
const DOWNLOADS_AT_ONCE = 8
/** Average GIF size, for the size shown in the prompt. */
const MB_PER_GIF = 0.1

const gifDir = () => path.join(app.getPath('userData'), 'exercise-gifs')
const prefsFile = () => path.join(app.getPath('userData'), 'gif-download.json')

protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true } },
])

/**
 * Serves app://bundle/<path> from dist/, refusing anything that escapes it.
 * Exercise GIFs come from the downloaded folder first; dist/ only has them in
 * an unpackaged build where `npm run gifs` was run.
 */
function serveDist() {
  protocol.handle('app', (request) => {
    const pathname = decodeURIComponent(new URL(request.url).pathname)
    const gif = pathname.match(/^\/exercise-gifs\/(\d+)\.gif$/)
    if (gif) {
      const downloaded = path.join(gifDir(), `${gif[1]}.gif`)
      if (existsSync(downloaded)) return net.fetch(pathToFileURL(downloaded).toString())
    }
    const file = path.normalize(path.join(DIST, pathname))
    if (!file.startsWith(DIST + path.sep)) return new Response('Not found', { status: 404 })
    return net.fetch(pathToFileURL(file).toString())
  })
}

const readJson = (file, fallback) => {
  try {
    return JSON.parse(readFileSync(file, 'utf8'))
  } catch {
    return fallback
  }
}

/** Ids of exercises whose GIF is neither downloaded nor in dist/. */
function missingGifs(manifest) {
  const has = (id) =>
    existsSync(path.join(gifDir(), `${id}.gif`)) || existsSync(path.join(DIST, 'exercise-gifs', `${id}.gif`))
  return Object.keys(manifest).filter((id) => !has(id))
}

/**
 * Downloads the GIFs for `ids`, showing progress on the taskbar and in the
 * title. Each lands under a temporary name first, so a download cut short is
 * never mistaken for a finished one. Returns the ids that failed.
 */
async function downloadGifs(win, ids, manifest) {
  mkdirSync(gifDir(), { recursive: true })
  const queue = [...ids]
  const failed = []
  let done = 0
  const worker = async () => {
    for (let id = queue.shift(); id !== undefined; id = queue.shift()) {
      try {
        const res = await net.fetch(GIF_SOURCE + manifest[id])
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const target = path.join(gifDir(), `${id}.gif`)
        await writeFile(`${target}.part`, Buffer.from(await res.arrayBuffer()))
        await rename(`${target}.part`, target)
      } catch {
        failed.push(id)
      }
      done++
      if (!win.isDestroyed()) {
        win.setProgressBar(done / ids.length)
        win.setTitle(`Muscle Explorer - downloading exercise animations (${done}/${ids.length})`)
      }
    }
  }
  await Promise.all(Array.from({ length: DOWNLOADS_AT_ONCE }, worker))
  if (!win.isDestroyed()) {
    win.setProgressBar(-1)
    win.setTitle('Muscle Explorer')
  }
  return failed
}

/** Asks to download any missing exercise GIFs, unless the user said not to ask again. */
async function offerGifs(win) {
  const manifest = readJson(GIF_MANIFEST, {})
  const missing = missingGifs(manifest)
  if (missing.length === 0 || readJson(prefsFile(), {}).neverAsk) return

  const { response, checkboxChecked } = await dialog.showMessageBox(win, {
    type: 'question',
    title: 'Exercise animations',
    message: 'Download the exercise animations?',
    detail:
      `Hovering an exercise shows an animated demo of it. ${missing.length} animations ` +
      `(about ${Math.ceil(missing.length * MB_PER_GIF)} MB) haven't been downloaded yet.\n\n` +
      'They come from github.com/hasaneyldrm/exercises-dataset. Animations © Gym visual (gymvisual.com).',
    buttons: ['Download', 'Not now'],
    defaultId: 0,
    cancelId: 1,
    checkboxLabel: "Don't ask again",
  })
  if (response !== 0) {
    if (checkboxChecked) writeFileSync(prefsFile(), JSON.stringify({ neverAsk: true }))
    return
  }

  const failed = await downloadGifs(win, missing, manifest)
  if (win.isDestroyed()) return
  await dialog.showMessageBox(win, {
    type: failed.length ? 'warning' : 'info',
    title: 'Exercise animations',
    message: failed.length
      ? `Downloaded ${missing.length - failed.length} of ${missing.length} animations.`
      : 'Exercise animations downloaded.',
    detail: failed.length ? "Check your internet connection. You'll be asked about the rest next time the app starts." : '',
  })
  // Previews that failed to load earlier in this session try again.
  win.webContents.reload()
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
  // The dev server serves GIFs from public/ (npm run gifs), so only the built app offers the download.
  if (!isDev) win.webContents.once('did-finish-load', () => offerGifs(win))
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
