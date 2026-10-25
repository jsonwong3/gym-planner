import { EXERCISES } from './data/exercises'
import type { Exercise } from './data/exercises'
import { MUSCLES } from './data/muscles'
import type { MuscleId } from './data/muscles'

/**
 * Fuzzy exercise search. Pure (no React or store), like heat.ts.
 *
 * Every word typed has to match some word of the exercise, best match first:
 *   exact word > word prefix ("pull" -> "Pull-Up") > typo-tolerant (a
 *   Damerau-Levenshtein distance of 1 for 4-6 letters, 2 from 7, so "bech"
 *   -> "bench", "deadlfit" -> "deadlift") > letters in order ("dbrow" ->
 *   "Dumbbell Row", as a last resort).
 * Words of the exercise's name count fully. The muscles it works (labels and
 * short ids, so "lats" and "latissimus" both work) count for less, scaled by
 * how hard it works them, so "lats" puts pull-ups above a lateral raise.
 */

const words = (s: string) => s.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean)

/** Optimal string alignment distance (Levenshtein plus adjacent swaps), stopping early past `max`. */
function distance(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1
  let prev2: number[] = []
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j)
  for (let i = 1; i <= a.length; i++) {
    const row = [i]
    let best = i
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      let v = Math.min(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + cost)
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, prev2[j - 2] + 1)
      row.push(v)
      best = Math.min(best, v)
    }
    if (best > max) return max + 1
    prev2 = prev
    prev = row
  }
  return prev[b.length]
}

/** Typos allowed for a query word of this length. */
const allowedTypos = (n: number) => (n >= 7 ? 2 : n >= 4 ? 1 : 0)

const isSubsequence = (q: string, w: string) => {
  let i = 0
  for (const ch of w) if (ch === q[i]) i++
  return i === q.length
}

/** How well one query word matches one word of the exercise, 0 = not at all. */
function wordScore(q: string, w: string): number {
  if (w === q) return 10
  if (w.startsWith(q)) return 8
  const typos = allowedTypos(q.length)
  if (typos) {
    // Also against the word cut to the query's length, so a misspelt prefix ("bnech" for "bench...") counts.
    const d = Math.min(distance(q, w, typos), w.length > q.length ? distance(q, w.slice(0, q.length), typos) : typos + 1)
    if (d <= typos) return 6 - 2 * d
  }
  if (q.length >= 3 && isSubsequence(q, w)) return 1
  return 0
}

interface Indexed {
  exercise: Exercise
  name: string[]
  /** The name with spaces and punctuation stripped, for letters-in-order matches across words ("dbrow"). */
  joined: string
  /** Each muscle's words with the multiplier a match on them gets. */
  muscles: Array<{ words: string[]; weight: number }>
}

/** A match on an exercise's biggest muscle counts for this fraction of a name match. */
const MUSCLE_WEIGHT = 0.6

const INDEX: Indexed[] = EXERCISES.map((exercise) => {
  const entries = Object.entries(exercise.muscles) as Array<[MuscleId, number]>
  const top = Math.max(...entries.map(([, share]) => share))
  return {
    exercise,
    name: words(exercise.name),
    joined: words(exercise.name).join(''),
    // Relative to the biggest share, so a one-muscle exercise doesn't outrank a compound lift's target.
    muscles: entries.map(([m, share]) => ({
      words: [...words(MUSCLES[m].label), ...words(m.replace(/_/g, ' ')), m.replace(/_/g, '')],
      weight: (MUSCLE_WEIGHT * share) / top,
    })),
  }
})

/** Best score for one query word against an indexed exercise, 0 if it matches nothing. */
function matchWord(q: string, entry: Indexed): number {
  let best = 0
  for (const w of entry.name) best = Math.max(best, wordScore(q, w))
  for (const { words: ws, weight } of entry.muscles) for (const w of ws) best = Math.max(best, wordScore(q, w) * weight)
  if (!best && q.length >= 3 && isSubsequence(q, entry.joined)) best = 1
  return best
}

/** Exercises matching every word of `query`, best first. Empty query, empty result. */
export function searchExercises(query: string): Exercise[] {
  const qs = words(query)
  if (!qs.length) return []
  const scored: Array<[Exercise, number]> = []
  for (const entry of INDEX) {
    let total = 0
    for (const q of qs) {
      const best = matchWord(q, entry)
      if (!best) {
        total = 0
        break
      }
      total += best
    }
    if (total > 0) scored.push([entry.exercise, total])
  }
  return scored.sort((a, b) => b[1] - a[1] || a[0].name.localeCompare(b[0].name)).map(([e]) => e)
}
