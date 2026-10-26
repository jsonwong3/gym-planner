import type { Day } from './store'

/**
 * Weekly tracking: whether each planned set was done as planned. Pure, like
 * heat.ts. A first-pass template; expect the shape to change.
 *
 * Weeks run Monday-Sunday in local time and are keyed by Monday's date
 * (`YYYY-MM-DD`). Each set is unlogged (null), hit (did the planned reps) or
 * missed.
 */

export type SetMark = 'hit' | 'miss' | null

/** One week: day id -> exercise id -> a mark per set (index = set number - 1). */
export type WeekLog = Record<string, Record<string, SetMark[]>>

const pad = (n: number) => String(n).padStart(2, '0')
const keyOf = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

/** Local date from a week key (not `new Date(key)`, which reads it as UTC midnight). */
function dateOf(week: string): Date {
  const [y, m, d] = week.split('-').map(Number)
  return new Date(y, m - 1, d)
}

/** The Monday of `date`'s week. */
export function weekOf(date = new Date()): string {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7))
  return keyOf(d)
}

export function shiftWeek(week: string, by: number): string {
  const d = dateOf(week)
  d.setDate(d.getDate() + 7 * by)
  return keyOf(d)
}

/** "20 – 26 Oct 2026", or "27 Oct – 2 Nov 2026" across a month. */
export function formatWeek(week: string): string {
  const start = dateOf(week)
  const end = dateOf(shiftWeek(week, 1))
  end.setDate(end.getDate() - 1)
  const month = (d: Date) => d.toLocaleDateString('en-GB', { month: 'short' })
  const from = start.getMonth() === end.getMonth() ? `${start.getDate()}` : `${start.getDate()} ${month(start)}`
  return `${from} – ${end.getDate()} ${month(end)} ${end.getFullYear()}`
}

/** Tapping a set cycles unlogged -> hit -> missed -> unlogged. */
export const nextMark = (mark: SetMark): SetMark => (mark === null ? 'hit' : mark === 'hit' ? 'miss' : null)

export interface Tally {
  planned: number
  hit: number
  missed: number
}

/**
 * Sets planned, hit and missed for `days` in one week. Counts against the
 * plan as it is now: marks past an exercise's current set count are ignored.
 */
export function tally(days: Day[], log: WeekLog | undefined): Tally {
  const t: Tally = { planned: 0, hit: 0, missed: 0 }
  for (const day of days) {
    for (const item of day.items) {
      t.planned += item.sets
      const marks = log?.[day.id]?.[item.exerciseId]?.slice(0, item.sets) ?? []
      t.hit += marks.filter((m) => m === 'hit').length
      t.missed += marks.filter((m) => m === 'miss').length
    }
  }
  return t
}
