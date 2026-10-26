// Converts the exercises-dataset's exercise list (fetched from GitHub, or a
// local exercises.json) into a CSV table of every dataset exercise, to pick from
// when editing scripts/data/exercises.csv (the hand-trimmed list). Writes
// exercises-all.csv so it never overwrites that list.
// Usage: node scripts/exercises-json-to-csv.mjs [input.json] [output.csv]
import { readFileSync, writeFileSync } from 'node:fs'

const SOURCE = 'https://raw.githubusercontent.com/hasaneyldrm/exercises-dataset/main/data/exercises.json'
const input = process.argv[2]
const output = process.argv[3] ?? 'scripts/data/exercises-all.csv'

/** Long, multi-language text we don't need in the table. */
const SKIP = new Set(['instructions', 'instruction_steps'])
/** secondary_muscles becomes this many columns; any beyond are dropped. */
const MAX_SECONDARY = 5

const exercises = input
  ? JSON.parse(readFileSync(input, 'utf8'))
  : await fetch(SOURCE).then((res) => {
      if (!res.ok) throw new Error(`Couldn't fetch ${SOURCE}: HTTP ${res.status}`)
      return res.json()
    })

// Columns in the order they first appear, with secondary_muscles expanded in place.
const columns = []
for (const exercise of exercises) {
  for (const key of Object.keys(exercise)) {
    if (SKIP.has(key) || columns.includes(key)) continue
    if (key === 'secondary_muscles') {
      for (let i = 0; i < MAX_SECONDARY; i++) {
        if (!columns.includes(`secondary_muscles_${i}`)) columns.push(`secondary_muscles_${i}`)
      }
    } else columns.push(key)
  }
}

/** Quotes a field if it holds a comma, quote or line break. */
const field = (value) => {
  const s = value == null ? '' : String(value)
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

const cell = (exercise, column) => {
  const secondary = column.match(/^secondary_muscles_(\d+)$/)
  if (secondary) return (exercise.secondary_muscles ?? [])[Number(secondary[1])]
  const value = exercise[column]
  return typeof value === 'object' && value !== null ? JSON.stringify(value) : value
}

const lines = [columns.join(','), ...exercises.map((e) => columns.map((c) => field(cell(e, c))).join(','))]
writeFileSync(output, lines.join('\n') + '\n')

const truncated = exercises.filter((e) => (e.secondary_muscles ?? []).length > MAX_SECONDARY).length
console.log(`Wrote ${exercises.length} exercises to ${output}`)
if (truncated) console.log(`${truncated} had more than ${MAX_SECONDARY} secondary muscles; the extras were dropped`)
