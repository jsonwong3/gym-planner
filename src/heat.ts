import { EXERCISES_BY_ID, intensityOf } from './data/exercises'
import { ALL_TARGETS } from './data/muscles'
import type { Target } from './data/muscles'
import type { Day } from './store'

/**
 * Heatmap maths. Pure functions, no React or store access, so it is easy to
 * test and to move to the server later.
 *
 * Each muscle's load is "effective sets":  sum over planned exercises of
 *   sets x intensity(exercise, muscle)
 * so 4 sets of bench press = 4 for chest, 2 for triceps, 1.6 for shoulders.
 * Reps are ignored on purpose; set count is the usual proxy for volume.
 *
 * Groups (e.g. the whole deltoid) are computed the same way using the
 * group's intensity (its strongest part), not the sum of its parts.
 */

/** Scope is either every day in the plan, or a single day's id. */
export type HeatScope = string
export const ALL_DAYS: HeatScope = 'all'

/**
 * Effective sets that count as "full heat" (top of the colour scale).
 * Roughly: a solid single session vs. a solid week. Tune to taste.
 */
export const FULL_HEAT_SETS = { day: 10, all: 20 }

/** Anything trained shows at least this much colour, so it never looks untrained. */
const MIN_VISIBLE = 0.08

export interface Contribution {
  exerciseId: string
  dayId: string
  dayTitle: string
  sets: number
  intensity: number
  /** sets x intensity */
  effective: number
}

export interface HeatResult {
  /** The scope actually used (falls back to ALL_DAYS if the day no longer exists). */
  scope: HeatScope
  /** Effective sets that map to full colour for this scope. */
  fullAt: number
  exerciseCount: number
  setCount: number
  /** Effective sets per muscle or group. */
  load: Record<Target, number>
  /** load / fullAt, capped at 1. */
  heat: Record<Target, number>
  /** Which planned exercises feed each muscle or group, biggest first. */
  contributions: Record<Target, Contribution[]>
}

function emptyRecord<T>(make: () => T): Record<Target, T> {
  return Object.fromEntries(ALL_TARGETS.map((t) => [t, make()])) as Record<Target, T>
}

export function computeHeat(days: Day[], scope: HeatScope): HeatResult {
  const match = scope === ALL_DAYS ? undefined : days.find((d) => d.id === scope)
  const included = match ? [match] : days
  const fullAt = match ? FULL_HEAT_SETS.day : FULL_HEAT_SETS.all

  const load = emptyRecord(() => 0)
  const contributions = emptyRecord<Contribution[]>(() => [])
  let exerciseCount = 0
  let setCount = 0

  for (const day of included) {
    for (const item of day.items) {
      const exercise = EXERCISES_BY_ID[item.exerciseId]
      if (!exercise) continue
      exerciseCount += 1
      setCount += item.sets
      for (const target of ALL_TARGETS) {
        const intensity = intensityOf(exercise, target)
        if (intensity === 0) continue
        const effective = item.sets * intensity
        load[target] += effective
        contributions[target].push({
          exerciseId: item.exerciseId,
          dayId: day.id,
          dayTitle: day.title,
          sets: item.sets,
          intensity,
          effective,
        })
      }
    }
  }

  const heat = emptyRecord(() => 0)
  for (const m of ALL_TARGETS) {
    heat[m] = Math.min(1, load[m] / fullAt)
    contributions[m].sort((a, b) => b.effective - a.effective)
  }

  return { scope: match ? scope : ALL_DAYS, fullAt, exerciseCount, setCount, load, heat, contributions }
}

/** 0 = untrained, otherwise 0.08-1 for colouring. */
export function levelOf(result: HeatResult, target: Target): number {
  return result.load[target] > 0 ? Math.max(MIN_VISIBLE, result.heat[target]) : 0
}

/** Of `targets` (what is on show), those with any load, hardest-hit first. */
export function rankedMuscles(result: HeatResult, targets: Target[]): Target[] {
  return targets.filter((t) => result.load[t] > 0).sort((a, b) => result.load[b] - result.load[a])
}

export function untrainedMuscles(result: HeatResult, targets: Target[]): Target[] {
  return targets.filter((t) => result.load[t] === 0)
}

export const formatSets = (n: number) => String(Math.round(n * 10) / 10)

// Colour scale -------------------------------------------------------------
// Sequential purple -> crimson -> orange -> yellow. Lightness rises with heat,
// so it still reads for colour-blind users and on the dark background.

export const UNTRAINED = '#3a4556'

const STOPS: Array<[number, string]> = [
  [0, '#6a3d9a'],
  [0.4, '#d1345b'],
  [0.7, '#ff8a3d'],
  [1, '#ffe066'],
]

export const HEAT_GRADIENT_CSS = `linear-gradient(90deg, ${STOPS.map(([p, c]) => `${c} ${p * 100}%`).join(', ')})`

const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))

/** t in 0..1 -> "#rrggbb" */
export function heatColor(t: number): string {
  const x = Math.min(1, Math.max(0, t))
  for (let i = 1; i < STOPS.length; i++) {
    const [p1, c1] = STOPS[i]
    if (x <= p1) {
      const [p0, c0] = STOPS[i - 1]
      const k = (x - p0) / (p1 - p0)
      const a = rgb(c0)
      const b = rgb(c1)
      return '#' + a.map((v, j) => Math.round(v + (b[j] - v) * k).toString(16).padStart(2, '0')).join('')
    }
  }
  return STOPS[STOPS.length - 1][1]
}
