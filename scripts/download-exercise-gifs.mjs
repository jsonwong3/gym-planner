// Downloads the GIF for every exercise in electron/exercise-gifs.json (written
// by gif-manifest.mjs from src/data/muscle_list.csv) from the exercises-dataset
// repo into public/exercise-gifs/<exercise_id>.gif, which the exercise hover
// preview loads. Only fetches GIFs that aren't there yet, and removes ones for
// exercises no longer listed. The GIFs are git-ignored (see the README).
// Usage: npm run gifs (regenerates the manifest first)
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync } from 'node:fs'
import { rename, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

const SOURCE = 'https://raw.githubusercontent.com/hasaneyldrm/exercises-dataset/main/'
const OUT = 'public/exercise-gifs'
/** Parallel downloads: enough to be quick, few enough not to trip GitHub's rate limits. */
const AT_ONCE = 8

const manifest = JSON.parse(readFileSync('electron/exercise-gifs.json', 'utf8'))

mkdirSync(OUT, { recursive: true })
for (const file of readdirSync(OUT)) {
  if (!(file.replace(/\.gif$/, '') in manifest)) rmSync(join(OUT, file)) // dropped exercises and cut-short .part files
}

const todo = Object.keys(manifest).filter((id) => !existsSync(join(OUT, `${id}.gif`)))
const failed = []
let done = 0
const worker = async () => {
  for (let id = todo.shift(); id !== undefined; id = todo.shift()) {
    try {
      const res = await fetch(SOURCE + manifest[id])
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      // Written under a temporary name first, so a cut-short download is never taken for a finished one.
      const target = join(OUT, `${id}.gif`)
      await writeFile(`${target}.part`, Buffer.from(await res.arrayBuffer()))
      await rename(`${target}.part`, target)
    } catch (err) {
      failed.push(`${id} (${err.message})`)
    }
    process.stdout.write(`\rDownloaded ${++done}/${total}`)
  }
}
const total = todo.length
if (total === 0) console.log(`All ${Object.keys(manifest).length} GIFs already in ${OUT}`)
else {
  await Promise.all(Array.from({ length: AT_ONCE }, worker))
  console.log(`\nDownloaded ${total - failed.length} GIFs to ${OUT}`)
}
if (failed.length) {
  console.log(`Failed, run again to retry: ${failed.join(', ')}`)
  process.exitCode = 1
}
