import csv from '../../muscle_list.csv?raw'
import { ALL_TARGETS, MUSCLE_IDS, TARGETS, groupOf, musclesOf } from './muscles'
import type { MuscleId, Target } from './muscles'

/**
 * Each muscle's share of an exercise's work. Shares are above 0 and add up
 * to 1, so a set is split between the muscles it works (bench press: half to
 * the sternal pec, the rest to the clavicular pec, front delts and triceps).
 * Muscles an exercise doesn't train are simply left out.
 */
export type MuscleIntensities = Partial<Record<MuscleId, number>>

export interface Exercise {
  /** `exercise_id` from the CSV, so renaming an exercise keeps it in saved plans. */
  id: string
  name: string
  /** The one muscle or group whose list this exercise appears in (`target_group`), whatever else it works. */
  group: Target
  /** Every muscle the exercise works with its share of the work. */
  muscles: MuscleIntensities
  /** How much of a set each muscle is credited with in the heatmap (see SECONDARY_CAP). */
  credit: MuscleIntensities
  /** The target part (`target_part`). */
  primary: MuscleId[]
  /** The secondary parts, biggest share first. */
  secondary: MuscleId[]
}

/** Lower-case letters and digits only, minus a trailing "s", so "Tricep" finds "Triceps". */
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '').replace(/s$/, '')

const byName = <T extends Target>(ids: readonly T[]): Map<string, T> =>
  new Map(ids.flatMap((id) => [[norm(id), id] as [string, T], [norm(TARGETS[id].label), id] as [string, T]]))

const MUSCLE_BY_NAME = byName(MUSCLE_IDS)
const TARGET_BY_NAME = byName(ALL_TARGETS)

/** Splits CSV text into rows of fields. Handles quoted fields ("a, b" and "" for a quote). */
function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') field += text[++i]
      else if (c === '"') quoted = false
      else field += c
    } else if (c === '"') quoted = true
    else if (c === ',') {
      row.push(field)
      field = ''
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++
      row.push(field)
      rows.push(row)
      row = []
      field = ''
    } else field += c
  }
  if (field || row.length) rows.push([...row, field])
  return rows
}

/** Shares must add up to 1, give or take rounding. */
const SUM_TOLERANCE = 0.001

/**
 * A set counts in full for the target part. Other parts get their weight
 * relative to the target's, capped here: research counts indirect work as about
 * half a set (Pelland et al. 2025), so even a big secondary can't pass for
 * direct work.
 */
export const SECONDARY_CAP = 0.5

/**
 * Reads `muscle_list.csv`, the source of truth for exercises. Rows without a
 * name or a target part are still being filled in and are skipped; anything
 * else that's wrong throws, so a typo shows up straight away.
 */
function loadExercises(text: string): Exercise[] {
  const [header, ...rows] = parseCsv(text)
  const col = (name: string) => {
    const i = header.indexOf(name)
    if (i < 0) throw new Error(`muscle_list.csv: missing column "${name}"`)
    return i
  }
  const idCol = col('exercise_id')
  const nameCol = col('exercise_name')
  const groupCol = col('target_group')
  const partCols: Array<[number, number]> = [[col('target_part'), col('target_part_weight')]]
  for (let n = 0; header.includes(`secondary_part_${n}`); n++) {
    partCols.push([col(`secondary_part_${n}`), col(`secondary_part_weight_${n}`)])
  }

  const seen = new Set<string>()
  const exercises: Exercise[] = []
  for (const row of rows) {
    const cell = (i: number) => (row[i] ?? '').trim()
    const id = cell(idCol)
    const name = cell(nameCol)
    if (!name || !cell(partCols[0][0])) continue
    const where = `muscle_list.csv, ${name} (id ${id})`
    if (!id) throw new Error(`${where}: missing exercise_id`)
    if (seen.has(id)) throw new Error(`${where}: exercise_id is used twice`)
    seen.add(id)

    const group = TARGET_BY_NAME.get(norm(cell(groupCol)))
    if (!group) throw new Error(`${where}: unknown target_group "${cell(groupCol)}"`)

    const parts: Array<[MuscleId, number]> = []
    for (const [partCol, weightCol] of partCols) {
      const label = cell(partCol)
      if (!label) continue
      const muscle = MUSCLE_BY_NAME.get(norm(label))
      if (!muscle) throw new Error(`${where}: unknown muscle "${label}"`)
      const weight = Number(cell(weightCol))
      if (!(weight > 0 && weight <= 1)) throw new Error(`${where}: weight for "${label}" must be in (0, 1]`)
      if (parts.some(([m]) => m === muscle)) throw new Error(`${where}: "${label}" is listed twice`)
      parts.push([muscle, weight])
    }
    const total = parts.reduce((sum, [, w]) => sum + w, 0)
    if (Math.abs(total - 1) > SUM_TOLERANCE) throw new Error(`${where}: weights add up to ${total}, not 1`)

    const [[target, targetWeight], ...rest] = parts
    rest.sort((a, b) => b[1] - a[1])
    exercises.push({
      id,
      name,
      group,
      muscles: Object.fromEntries(parts),
      credit: Object.fromEntries([
        [target, 1],
        ...rest.map(([m, w]) => [m, Math.min(SECONDARY_CAP, w / targetWeight)]),
      ]),
      primary: [target],
      secondary: rest.map(([m]) => m),
    })
  }
  return exercises
}

export const EXERCISES: Exercise[] = loadExercises(csv)

export const EXERCISES_BY_ID: Record<string, Exercise> = Object.fromEntries(
  EXERCISES.map((e) => [e.id, e]),
)

/** All muscles an exercise works as [muscle, share], biggest first. */
export function muscleEntries(exercise: Exercise): Array<[MuscleId, number]> {
  return (Object.entries(exercise.muscles) as Array<[MuscleId, number]>).sort((a, b) => b[1] - a[1])
}

/**
 * How much of a set an exercise counts for on a muscle or group, 0 if none.
 * A group takes its best part, so a set of bench press is one set of chest,
 * not one plus the clavicular pec's share.
 */
export function creditOf(exercise: Exercise, target: Target): number {
  return Math.max(0, ...musclesOf(target).map((m) => exercise.credit[m] ?? 0))
}

/** An exercise's share of the work on a muscle or group (a group adds up its parts), 0 if none. */
const shareOf = (exercise: Exercise, target: Target) =>
  musclesOf(target).reduce((sum, m) => sum + (exercise.muscles[m] ?? 0), 0)

/** Whether an exercise is listed under `target`: its own group, or a part of that group. */
const listedUnder = (exercise: Exercise, target: Target) =>
  exercise.group === target || (target in exercise.muscles && groupOf(target as MuscleId) === exercise.group)

/**
 * Exercises listed under a muscle or group. Every exercise in a group is
 * primary for it; for a part, primary means the part is the target and
 * secondary that it's one of the other parts worked.
 */
export function exercisesForTarget(target: Target) {
  const listed = EXERCISES.filter((e) => listedUnder(e, target))
  const isPrimary = (e: Exercise) => e.group === target || e.primary.includes(target as MuscleId)
  const share = (e: Exercise) => shareOf(e, target)
  const biggestFirst = (a: Exercise, b: Exercise) => share(b) - share(a)
  return {
    primary: listed.filter(isPrimary).sort(biggestFirst),
    secondary: listed.filter((e) => !isPrimary(e)).sort(biggestFirst),
  }
}
