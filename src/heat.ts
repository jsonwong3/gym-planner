import { EXERCISES_BY_ID, creditOf } from './data/exercises'
import { ALL_TARGETS } from './data/muscles'
import type { Target } from './data/muscles'
import type { Day } from './store'

/**
 * Heatmap maths. Pure functions, no React or store access, so it is easy to
 * test and to move to the server later.
 *
 * The all-days scope leaves out inactive days (`Day.active`).
 *
 * Each muscle's load is "effective sets":  sum over planned exercises of
 *   sets x credit(exercise, muscle)
 * A set counts in full for the exercise's target part; other parts get their
 * weight relative to the target's, at most SECONDARY_CAP. So 4 sets of bench
 * press = 4 for the sternal pec, 1.2 for the clavicular pec and front delts,
 * 0.8 for the lateral triceps... Reps are ignored on purpose: hard sets of
 * roughly 6-30 reps build about the same muscle, and set count is what the
 * research measures.
 *
 * Groups (e.g. the whole deltoid) take their best part, so the same bench
 * press counts 4 for "Chest", not 4 + 1.2.
 */

/** Scope is either every day in the plan, or a single day's id. */
export type HeatScope = string
export const ALL_DAYS: HeatScope = 'all'

/**
 * Effective sets that count as "full heat" (top of the colour scale). All days
 * is treated as a week: 12-20 sets per muscle per week is the usual
 * recommendation, so a muscle is full once it reaches 12. One session stops adding much past
 * about 11 sets, so a day is full at 8. Tune to taste.
 */
export const FULL_HEAT_SETS = { day: 8, all: 12 }

/** Anything trained shows at least this much colour, so it never looks untrained. */
const MIN_VISIBLE = 0.08

export interface Contribution {
  exerciseId: string
  dayId: string
  dayTitle: string
  sets: number
  /** How much of each set counts for this muscle or group (`creditOf`). */
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
  // All days means the active ones; a day still being worked out only shows when picked on its own.
  const included = match ? [match] : days.filter((d) => d.active)
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
        const intensity = creditOf(exercise, target)
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

// Colour scales ------------------------------------------------------------
// All sequential, and all but `traffic` get lighter with heat, so they still
// read for colour-blind users and on the dark background. Each starts bright
// enough to stand out from UNTRAINED.

export const UNTRAINED = '#3a4556'

type Stops = Array<[number, string]>

/**
 * Picked in settings. Ids are persisted, so don't rename or remove one
 * without handling it in the store's `migrate`.
 */
export const HEAT_PALETTES = {
  ember: {
    label: 'Ember',
    stops: [[0, '#6a3d9a'], [0.4, '#d1345b'], [0.7, '#ff8a3d'], [1, '#ffe066']],
  },
  viridis: {
    label: 'Viridis',
    stops: [[0, '#482878'], [0.3, '#31688e'], [0.55, '#26a784'], [0.8, '#7ad151'], [1, '#fde725']],
  },
  plasma: {
    label: 'Plasma',
    stops: [[0, '#5b02a3'], [0.3, '#b12a90'], [0.55, '#e16462'], [0.8, '#fca636'], [1, '#f0f921']],
  },
  ocean: {
    label: 'Ocean',
    stops: [[0, '#25407f'], [0.4, '#2a7fba'], [0.7, '#4fc3e0'], [1, '#d4f6ff']],
  },
  mint: {
    label: 'Mint',
    stops: [[0, '#1f5c52'], [0.4, '#2a9d80'], [0.7, '#5fd3a0'], [1, '#d8ffe4']],
  },
  traffic: {
    label: 'Traffic light',
    stops: [[0, '#2e9e5b'], [0.5, '#f2d544'], [1, '#e5533d']],
  },
} satisfies Record<string, { label: string; stops: Stops }>

export type HeatPalette = keyof typeof HEAT_PALETTES
export const HEAT_PALETTE_IDS = Object.keys(HEAT_PALETTES) as HeatPalette[]
export const DEFAULT_HEAT_PALETTE: HeatPalette = 'ember'

/** Unknown ids (e.g. a palette since removed) fall back to the default. */
const stopsOf = (palette: HeatPalette): Stops => (HEAT_PALETTES[palette] ?? HEAT_PALETTES[DEFAULT_HEAT_PALETTE]).stops as Stops

export const heatGradientCss = (palette: HeatPalette) =>
  `linear-gradient(90deg, ${stopsOf(palette).map(([p, c]) => `${c} ${p * 100}%`).join(', ')})`

const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))

/** t in 0..1 -> "#rrggbb" */
export function heatColor(t: number, palette: HeatPalette): string {
  const stops = stopsOf(palette)
  const x = Math.min(1, Math.max(0, t))
  for (let i = 1; i < stops.length; i++) {
    const [p1, c1] = stops[i]
    if (x <= p1) {
      const [p0, c0] = stops[i - 1]
      const k = (x - p0) / (p1 - p0)
      const a = rgb(c0)
      const b = rgb(c1)
      return '#' + a.map((v, j) => Math.round(v + (b[j] - v) * k).toString(16).padStart(2, '0')).join('')
    }
  }
  return stops[stops.length - 1][1]
}
