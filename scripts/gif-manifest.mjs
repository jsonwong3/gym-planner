// Writes electron/exercise-gifs.json: for every exercise in src/data/muscle_list.csv,
// where its GIF is in the exercises-dataset repo. The desktop app ships this list
// (not the GIFs) and offers to download any GIFs it doesn't have yet.
// Built from scripts/data/exercises.csv, so the dataset needn't be downloaded.
// Usage: npm run gif-manifest (the desktop scripts run it before packaging)
import { readFileSync, writeFileSync } from 'node:fs'

/** Rows of a CSV with no quoted fields (true of both files here), keyed by column name. */
function readCsv(file) {
  const [header, ...rows] = readFileSync(file, 'utf8').trim().split(/\r?\n/)
  const cols = header.split(',')
  return rows.map((r) => Object.fromEntries(r.split(',').map((v, i) => [cols[i], v.trim()])))
}

// The dataset ids are zero-padded ("0007") in its own files but plain numbers here.
const gifById = new Map(readCsv('scripts/data/exercises.csv').map((e) => [String(Number(e.id)), e.gif_url]))

const manifest = {}
const missing = []
for (const { exercise_id: id } of readCsv('src/data/muscle_list.csv')) {
  if (!id) continue
  if (gifById.get(id)) manifest[id] = gifById.get(id)
  else missing.push(id)
}

writeFileSync('electron/exercise-gifs.json', JSON.stringify(manifest, null, 1) + '\n')
console.log(`Wrote ${Object.keys(manifest).length} GIF paths to electron/exercise-gifs.json`)
if (missing.length) console.log(`No dataset GIF for ids: ${missing.join(', ')}`)
