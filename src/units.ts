/**
 * Weight units. Weights are stored in kg and only converted for display and
 * input, so switching units in settings converts what's shown rather than
 * reinterpreting the numbers. Pure, like heat.ts.
 */
export type Unit = 'kg' | 'lb'

export const UNITS: Unit[] = ['kg', 'lb']

const KG_PER_LB = 0.45359237

/** What the +/- buttons on a weight add or remove, in the user's unit: a small plate pair. */
export const WEIGHT_STEP: Record<Unit, number> = { kg: 2.5, lb: 5 }

/** Heaviest weight accepted, in kg; anything above is treated as a typo. */
export const MAX_KG = 1000

export const toUnit = (kg: number, unit: Unit) => (unit === 'kg' ? kg : kg / KG_PER_LB)
export const fromUnit = (value: number, unit: Unit) => (unit === 'kg' ? value : value * KG_PER_LB)

/** A stored weight as the user sees it: their unit, at most one decimal, no trailing ".0". */
export const formatWeight = (kg: number, unit: Unit) => String(Math.round(toUnit(kg, unit) * 10) / 10)
