import { MUSCLE_IDS, musclesOf } from './muscles'
import type { MuscleId, Target } from './muscles'

export type Equipment = 'Bodyweight' | 'Dumbbell' | 'Barbell' | 'Machine'
export type Level = 'Beginner' | 'Intermediate' | 'Advanced'

/**
 * How much of an exercise's work a muscle does, from just above 0 up to 1.
 * Muscles an exercise doesn't train are simply left out.
 *
 *   1.0       prime mover (bench press -> sternal pec)
 *   0.7-0.9   co-prime mover (chin-up -> biceps, chest dip -> lateral triceps)
 *   0.4-0.6   strong synergist (bench press -> triceps)
 *   0.2-0.3   stabiliser / assists (push-up -> abs)
 *
 * These are rough, relative numbers (not EMG data). Tune freely. The heatmap
 * multiplies them by the planned sets, so they only need to be sensible
 * relative to each other.
 */
export type MuscleIntensities = Partial<Record<MuscleId, number>>

/** At or above this an exercise counts as "primary" for the muscle. */
export const PRIMARY_MIN = 0.6

export interface Exercise {
  id: string
  name: string
  equipment: Equipment
  level: Level
  /** Source of truth: every muscle the exercise works, with its 0-1 intensity. */
  muscles: MuscleIntensities
  /** Derived from `muscles` (>= PRIMARY_MIN), strongest first. */
  primary: MuscleId[]
  /** Derived from `muscles` (< PRIMARY_MIN), strongest first. */
  secondary: MuscleId[]
}

/**
 * Muscles from the previous list in areas that are still WIP (back, forearm,
 * legs...: one whole-area muscle each, no parts yet). Exercise data keeps them
 * so nothing is lost; they're ignored until replaced with real muscles. Delete
 * each one here once it is.
 */
type PendingMuscle =
  | 'traps_mid'
  | 'lower_back'
  | 'forearm_flexors'
  | 'forearm_extensors'
  | 'glute_max'
  | 'glute_med'
  | 'hip_flexors'
  | 'quads_rectus'
  | 'quads_outer'
  | 'quads_inner'
  | 'hamstrings'
  | 'gastrocnemius'
  | 'soleus'

const isMuscle = (m: string): m is MuscleId => (MUSCLE_IDS as readonly string[]).includes(m)

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')

/** Null while an exercise has no primary muscle outside the WIP groups, so it's left out for now. */
const ex = (
  name: string,
  equipment: Equipment,
  level: Level,
  data: Partial<Record<MuscleId | PendingMuscle, number>>,
): Exercise | null => {
  const all = Object.entries(data) as Array<[string, number]>
  for (const [m, v] of all) {
    if (!(v > 0 && v <= 1)) throw new Error(`${name}: intensity for "${m}" must be in (0, 1], got ${v}`)
  }
  const entries = all.filter((e): e is [MuscleId, number] => isMuscle(e[0])).sort((a, b) => b[1] - a[1])
  const muscles: MuscleIntensities = Object.fromEntries(entries)
  const primary = entries.filter(([, v]) => v >= PRIMARY_MIN).map(([m]) => m)
  if (primary.length === 0) {
    if (entries.length < all.length) return null
    throw new Error(`${name}: needs at least one muscle >= ${PRIMARY_MIN}`)
  }
  const secondary = entries.filter(([, v]) => v < PRIMARY_MIN).map(([m]) => m)
  return { id: slug(name), name, equipment, level, muscles, primary, secondary }
}

const B = 'Beginner'
const I = 'Intermediate'
const A = 'Advanced'

// Mock data. In the real app this comes from your API / database
// (exercises + exercise_muscles join table with an `intensity` column).
// Exercises that only train WIP groups come out null and are dropped for now.
export const EXERCISES: Exercise[] = [
  // Chest
  ex('Push-Up', 'Bodyweight', B, {
    pec_sternal: 1,
    pec_clavicular: 0.6,
    triceps_lateral: 0.5,
    triceps_long: 0.3,
    delt_anterior: 0.5,
    serratus_anterior: 0.3,
    abs: 0.25,
  }),
  ex('Barbell Bench Press', 'Barbell', I, {
    pec_sternal: 1,
    pec_clavicular: 0.6,
    triceps_lateral: 0.5,
    triceps_long: 0.3,
    delt_anterior: 0.5,
  }),
  ex('Incline Dumbbell Press', 'Dumbbell', I, {
    pec_clavicular: 1,
    delt_anterior: 0.6,
    pec_sternal: 0.5,
    triceps_lateral: 0.4,
    triceps_long: 0.25,
  }),
  ex('Dumbbell Fly', 'Dumbbell', I, { pec_sternal: 1, pec_clavicular: 0.6, delt_anterior: 0.3, bicep: 0.2 }),
  ex('Cable Crossover', 'Machine', I, { pec_sternal: 1, pec_clavicular: 0.5, delt_anterior: 0.3 }),
  ex('Chest Dip', 'Bodyweight', A, {
    pec_sternal: 0.9,
    triceps_lateral: 0.8,
    triceps_long: 0.5,
    delt_anterior: 0.5,
    traps_mid: 0.3,
    lats: 0.3,
  }),
  ex('Dumbbell Pullover', 'Dumbbell', I, { pec_sternal: 0.8, lats: 0.7, triceps_long: 0.4, serratus_anterior: 0.3 }),
  // Scapular depression: lower traps pull the shoulder blades down, lats and lower pecs help.
  ex('Dip Shrug', 'Bodyweight', I, { traps_mid: 0.8, lats: 0.5, pec_sternal: 0.4 }),
  ex('Scapular Push-Up', 'Bodyweight', B, { serratus_anterior: 1, abs: 0.3 }),

  // Shoulders
  ex('Overhead Press', 'Barbell', I, {
    delt_anterior: 1,
    delt_lateral: 0.6,
    triceps_lateral: 0.5,
    triceps_long: 0.4,
    pec_clavicular: 0.4,
    traps_upper: 0.4,
    serratus_anterior: 0.4,
    abs: 0.25,
  }),
  ex('Lateral Raise', 'Dumbbell', B, { delt_lateral: 1, delt_anterior: 0.3, traps_upper: 0.3, serratus_anterior: 0.3 }),
  ex('Arnold Press', 'Dumbbell', I, {
    delt_anterior: 1,
    delt_lateral: 0.7,
    triceps_lateral: 0.4,
    triceps_long: 0.3,
    pec_clavicular: 0.3,
  }),
  ex('Front Raise', 'Dumbbell', B, { delt_anterior: 1, pec_clavicular: 0.5, delt_lateral: 0.3, serratus_anterior: 0.3 }),
  ex('Face Pull', 'Machine', B, { delt_posterior: 1, traps_mid: 0.7 }),
  ex('Reverse Fly', 'Dumbbell', B, { delt_posterior: 1, traps_mid: 0.6 }),
  ex('Pike Push-Up', 'Bodyweight', I, {
    delt_anterior: 1,
    triceps_lateral: 0.5,
    triceps_long: 0.4,
    pec_clavicular: 0.4,
    delt_lateral: 0.4,
    serratus_anterior: 0.3,
  }),
  ex('Full Can Raise', 'Dumbbell', B, { delt_lateral: 0.8, delt_anterior: 0.7, traps_upper: 0.3, serratus_anterior: 0.3 }),
  // Mostly rotator cuff, which isn't modelled; the rear delt is the main visible muscle.
  ex('Cable External Rotation', 'Machine', B, { delt_posterior: 0.7, traps_mid: 0.3 }),

  // Biceps / upper arm
  ex('Barbell Curl', 'Barbell', B, {
    bicep: 1,
    forearm_extensors: 0.5,
    forearm_flexors: 0.3,
  }),
  ex('Hammer Curl', 'Dumbbell', B, { forearm_extensors: 1, bicep: 0.9 }),
  ex('Incline Dumbbell Curl', 'Dumbbell', I, { bicep: 1, forearm_extensors: 0.3 }),
  ex('Cable Curl', 'Machine', B, { bicep: 1, forearm_extensors: 0.3 }),
  ex('Chin-Up', 'Bodyweight', I, {
    lats: 1,
    bicep: 0.8,
    traps_mid: 0.5,
    pec_sternal: 0.3,
    forearm_flexors: 0.3,
    triceps_long: 0.2,
  }),

  // Triceps. Arms overhead stretch the long head; arms at the sides favour the lateral/medial heads.
  ex('Close-Grip Bench Press', 'Barbell', I, {
    triceps_lateral: 1,
    triceps_long: 0.7,
    pec_sternal: 0.5,
    pec_clavicular: 0.4,
    delt_anterior: 0.4,
  }),
  ex('Triceps Pushdown', 'Machine', B, { triceps_lateral: 1, triceps_long: 0.6 }),
  ex('Overhead Triceps Extension', 'Dumbbell', B, { triceps_long: 1, triceps_lateral: 0.6 }),
  ex('Bench Dip', 'Bodyweight', B, {
    triceps_lateral: 1,
    triceps_long: 0.6,
    delt_anterior: 0.5,
    pec_sternal: 0.4,
    traps_mid: 0.2,
  }),
  ex('Skull Crusher', 'Barbell', I, { triceps_long: 1, triceps_lateral: 0.8 }),

  // Forearms (brachioradialis counts as an extensor)
  ex('Wrist Curl', 'Dumbbell', B, { forearm_flexors: 1 }),
  ex('Reverse Wrist Curl', 'Dumbbell', B, { forearm_extensors: 1 }),
  ex('Reverse Curl', 'Barbell', B, { forearm_extensors: 1, bicep: 0.8 }),
  ex('Wrist Pronation', 'Dumbbell', B, { forearm_flexors: 0.8, forearm_extensors: 0.3 }),
  ex('Wrist Supination', 'Dumbbell', B, { forearm_extensors: 0.8, bicep: 0.4 }),
  ex("Farmer's Carry", 'Dumbbell', B, {
    forearm_flexors: 1,
    traps_upper: 0.7,
    lower_back: 0.5,
    obliques: 0.4,
    abs: 0.4,
  }),

  // Abs / core
  ex('Plank', 'Bodyweight', B, { abs: 1, obliques: 0.5, delt_anterior: 0.3, serratus_anterior: 0.3, glute_max: 0.3 }),
  ex('Bicycle Crunch', 'Bodyweight', B, { abs: 1, obliques: 0.8, hip_flexors: 0.5, quads_rectus: 0.3 }),
  ex('Cable Crunch', 'Machine', I, { abs: 1, obliques: 0.4 }),
  ex('Hanging Leg Raise', 'Bodyweight', A, {
    hip_flexors: 1,
    abs: 0.8,
    quads_rectus: 0.5,
    obliques: 0.5,
    forearm_flexors: 0.4,
    lats: 0.2,
  }),
  ex('Lying Leg Raise', 'Bodyweight', B, { hip_flexors: 1, abs: 0.6, quads_rectus: 0.4, obliques: 0.3 }),
  ex('Ab Wheel Rollout', 'Bodyweight', A, { abs: 1, obliques: 0.5, lats: 0.4, hip_flexors: 0.4, delt_anterior: 0.3 }),
  ex('Dead Bug', 'Bodyweight', B, { abs: 1, hip_flexors: 0.4, obliques: 0.4 }),

  // Obliques / lateral core
  ex('Russian Twist', 'Bodyweight', B, { obliques: 1, abs: 0.5, hip_flexors: 0.4 }),
  ex('Side Plank', 'Bodyweight', B, { obliques: 1, lower_back: 0.7, glute_med: 0.6, abs: 0.5, delt_lateral: 0.3 }),
  ex('Cable Woodchop', 'Machine', I, { obliques: 1, abs: 0.5, delt_anterior: 0.3 }),
  ex('Dumbbell Side Bend', 'Dumbbell', B, { obliques: 1, lower_back: 0.7 }),
  ex('Suitcase Carry', 'Dumbbell', I, {
    lower_back: 1,
    obliques: 0.8,
    forearm_flexors: 0.6,
    traps_upper: 0.5,
    abs: 0.4,
  }),

  // Traps
  ex('Barbell Shrug', 'Barbell', B, { traps_upper: 1, forearm_flexors: 0.4 }),
  ex('Dumbbell Shrug', 'Dumbbell', B, { traps_upper: 1, forearm_flexors: 0.4 }),
  ex('Prone Y Raise', 'Dumbbell', B, { traps_mid: 1, delt_posterior: 0.5, serratus_anterior: 0.3 }),
  ex('Rack Pull', 'Barbell', I, {
    traps_upper: 0.8,
    lower_back: 0.8,
    glute_max: 0.6,
    hamstrings: 0.5,
    forearm_flexors: 0.5,
    quads_outer: 0.3,
    quads_inner: 0.2,
  }),

  // Lats / mid back
  ex('Pull-Up', 'Bodyweight', I, {
    lats: 1,
    bicep: 0.5,
    traps_mid: 0.5,
    pec_sternal: 0.3,
    forearm_flexors: 0.3,
  }),
  ex('Lat Pulldown', 'Machine', B, { lats: 1, bicep: 0.5, traps_mid: 0.5, pec_sternal: 0.3 }),
  ex('Bent-Over Row', 'Barbell', I, {
    lats: 0.9,
    traps_mid: 0.8,
    delt_posterior: 0.6,
    bicep: 0.5,
    lower_back: 0.5,
    hamstrings: 0.3,
  }),
  ex('One-Arm Dumbbell Row', 'Dumbbell', B, {
    lats: 1,
    traps_mid: 0.7,
    delt_posterior: 0.5,
    bicep: 0.5,
  }),
  ex('Seated Cable Row', 'Machine', B, {
    traps_mid: 0.9,
    lats: 0.8,
    delt_posterior: 0.5,
    bicep: 0.5,
    lower_back: 0.3,
  }),

  // Lower back
  ex('Back Extension', 'Bodyweight', B, { lower_back: 1, glute_max: 0.6, hamstrings: 0.5 }),
  ex('Good Morning', 'Barbell', I, { lower_back: 0.9, hamstrings: 0.9, glute_max: 0.6, adductors: 0.3 }),
  ex('Deadlift', 'Barbell', I, {
    glute_max: 1,
    hamstrings: 0.8,
    lower_back: 0.8,
    quads_outer: 0.6,
    quads_inner: 0.5,
    adductors: 0.5,
    forearm_flexors: 0.5,
    traps_upper: 0.4,
    lats: 0.3,
    soleus: 0.3,
    quads_rectus: 0.2,
  }),
  ex('Superman', 'Bodyweight', B, { lower_back: 1, glute_max: 0.5, hamstrings: 0.3 }),

  // Glutes / hips
  ex('Hip Thrust', 'Barbell', I, {
    glute_max: 1,
    hamstrings: 0.5,
    glute_med: 0.4,
    adductors: 0.3,
    quads_outer: 0.3,
  }),
  ex('Glute Bridge', 'Bodyweight', B, { glute_max: 1, hamstrings: 0.5, glute_med: 0.3 }),
  ex('Cable Kickback', 'Machine', B, { glute_max: 1, hamstrings: 0.4, glute_med: 0.3 }),
  ex('Bulgarian Split Squat', 'Dumbbell', I, {
    quads_outer: 0.9,
    quads_inner: 0.9,
    glute_max: 0.8,
    adductors: 0.5,
    quads_rectus: 0.4,
    glute_med: 0.4,
    hamstrings: 0.3,
    soleus: 0.3,
  }),
  ex('Hip Abduction Machine', 'Machine', B, { glute_med: 1, glute_max: 0.3 }),
  ex('Side-Lying Leg Raise', 'Bodyweight', B, { glute_med: 1 }),
  ex('Clamshell', 'Bodyweight', B, { glute_med: 1, glute_max: 0.5 }),
  ex('Seated Hip External Rotation', 'Machine', I, { glute_max: 0.8, glute_med: 0.6 }),
  ex('Hip Adduction Machine', 'Machine', B, { adductors: 1, hip_flexors: 0.3 }),
  ex('Copenhagen Plank', 'Bodyweight', A, { adductors: 1, obliques: 0.6, lower_back: 0.4, abs: 0.3 }),

  // Quads
  ex('Back Squat', 'Barbell', I, {
    quads_outer: 1,
    quads_inner: 0.9,
    glute_max: 0.8,
    adductors: 0.6,
    lower_back: 0.5,
    quads_rectus: 0.4,
    hamstrings: 0.3,
    soleus: 0.3,
    abs: 0.2,
  }),
  ex('Goblet Squat', 'Dumbbell', B, {
    quads_inner: 1,
    quads_outer: 0.9,
    glute_max: 0.6,
    adductors: 0.5,
    quads_rectus: 0.4,
    abs: 0.3,
    lower_back: 0.3,
  }),
  ex('Leg Press', 'Machine', B, {
    quads_outer: 1,
    quads_inner: 0.9,
    glute_max: 0.6,
    adductors: 0.5,
    quads_rectus: 0.4,
    soleus: 0.3,
  }),
  ex('Walking Lunge', 'Dumbbell', I, {
    quads_outer: 0.9,
    quads_inner: 0.9,
    glute_max: 0.8,
    adductors: 0.5,
    quads_rectus: 0.4,
    glute_med: 0.3,
    hamstrings: 0.3,
    soleus: 0.3,
  }),
  // Rectus femoris also crosses the hip, so it works hardest with the hip already flexed, as here.
  ex('Leg Extension', 'Machine', B, { quads_rectus: 1, quads_outer: 0.9, quads_inner: 0.8 }),

  // Hamstrings
  ex('Romanian Deadlift', 'Barbell', I, {
    hamstrings: 1,
    glute_max: 0.8,
    lower_back: 0.5,
    adductors: 0.5,
    forearm_flexors: 0.3,
  }),
  ex('Lying Leg Curl', 'Machine', B, { hamstrings: 1, gastrocnemius: 0.4 }),
  ex('Seated Leg Curl', 'Machine', B, { hamstrings: 1, gastrocnemius: 0.3, adductors: 0.2 }),
  ex('Nordic Curl', 'Bodyweight', A, { hamstrings: 1, gastrocnemius: 0.4, glute_max: 0.3 }),

  // Calves
  ex('Standing Calf Raise', 'Machine', B, { gastrocnemius: 1, soleus: 0.7 }),
  ex('Seated Calf Raise', 'Machine', B, { soleus: 1, gastrocnemius: 0.3 }),
  ex('Single-Leg Calf Raise', 'Bodyweight', B, { gastrocnemius: 1, soleus: 0.7 }),
].filter((e) => e !== null)

export const EXERCISES_BY_ID: Record<string, Exercise> = Object.fromEntries(
  EXERCISES.map((e) => [e.id, e]),
)

/** All muscles an exercise works as [muscle, intensity], strongest first. */
export function muscleEntries(exercise: Exercise): Array<[MuscleId, number]> {
  return (Object.entries(exercise.muscles) as Array<[MuscleId, number]>).sort((a, b) => b[1] - a[1])
}

/** How hard an exercise works a muscle or group (a group counts its strongest part), 0 if not at all. */
export function intensityOf(exercise: Exercise, target: Target): number {
  return Math.max(0, ...musclesOf(target).map((m) => exercise.muscles[m] ?? 0))
}

export function exercisesForTarget(target: Target) {
  const weight = (e: Exercise) => intensityOf(e, target)
  const strongestFirst = (a: Exercise, b: Exercise) => weight(b) - weight(a)
  return {
    primary: EXERCISES.filter((e) => weight(e) >= PRIMARY_MIN).sort(strongestFirst),
    secondary: EXERCISES.filter((e) => weight(e) > 0 && weight(e) < PRIMARY_MIN).sort(strongestFirst),
  }
}
