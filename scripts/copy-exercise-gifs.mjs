// Copies the dataset's GIF for every exercise in src/data/muscle_list.csv to
// public/exercise-gifs/<exercise_id>.gif, which the exercise hover preview loads.
// Only listed exercises are copied, so the shipped app doesn't carry all 1,300.
// Neither the dataset nor the copies are in git (the GIFs are Gym visual's; see
// the README), so a fresh clone downloads the dataset and runs this.
// Usage: npm run gifs
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'

const DATASET = 'exercises-dataset-main'
const OUT = 'public/exercise-gifs'

if (!existsSync(join(DATASET, 'data/exercises.json'))) {
  console.error(
    `No ${DATASET}/ here. Download https://github.com/hasaneyldrm/exercises-dataset/archive/refs/heads/main.zip\n` +
      `and unzip it in the project root, so ${DATASET}/data/exercises.json exists, then run this again.`,
  )
  process.exit(1)
}

// Dataset ids are zero-padded ("0007"); muscle_list.csv has them as plain numbers ("7").
const gifById = new Map(
  JSON.parse(readFileSync(join(DATASET, 'data/exercises.json'), 'utf8')).map((e) => [String(Number(e.id)), e.gif_url]),
)

const [header, ...rows] = readFileSync('src/data/muscle_list.csv', 'utf8').trim().split(/\r?\n/)
const idCol = header.split(',').indexOf('exercise_id')
const ids = rows.map((r) => r.split(',')[idCol].trim()).filter(Boolean)

// Start clean so exercises removed from the list don't leave their GIFs behind.
if (existsSync(OUT)) for (const f of readdirSync(OUT)) rmSync(join(OUT, f))
mkdirSync(OUT, { recursive: true })

const missing = []
for (const id of ids) {
  const gif = gifById.get(id)
  if (gif && existsSync(join(DATASET, gif))) copyFileSync(join(DATASET, gif), join(OUT, `${id}.gif`))
  else missing.push(id)
}
console.log(`Copied ${ids.length - missing.length} GIFs to ${OUT}`)
if (missing.length) console.log(`No GIF for ids: ${missing.join(', ')}`)
