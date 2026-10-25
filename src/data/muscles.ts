/**
 * Muscle list, grouped the way the app drills down (see GROUPS). Areas that
 * aren't split into parts yet (WIP) are one muscle covering the whole area, so
 * they can still be tagged and selected.
 *
 * Splitting a WIP area later: add a GROUPS entry with the parts (the group id
 * can't equal a muscle id, so rename or remove the whole-area muscle), and give
 * its code to the part covering most of the area, or retire it. Tags live by
 * code, so the area already tagged carries over to that part.
 */
export const MUSCLE_IDS = [
  // Shoulders
  'delt_anterior',
  'delt_lateral',
  'delt_posterior',
  // Triceps
  'triceps_long',
  'triceps_lateral',
  'triceps_medial',
  // Chest
  'pec_clavicular',
  'pec_sternal',
  'serratus_anterior',
  // Core
  'abs',
  'obliques',
  // Back
  'traps_upper',
  'traps_middle',
  'traps_lower',
  'infraspinatus',
  'lats',
  'erector_spinae',
  // Forearms
  'brachioradialis',
  'forearm_extensors',
  'forearm_flexors',
  // Legs
  'glutes',
  'quadriceps',
  'hamstrings',
  'adductors',
  'abductors',
  'calves',
  // WIP: whole areas, not split into parts yet
  'neck',
  'biceps',
] as const

export type MuscleId = (typeof MUSCLE_IDS)[number]

export type Region =
  | 'Neck'
  | 'Shoulders'
  | 'Triceps'
  | 'Biceps'
  | 'Chest'
  | 'Core'
  | 'Back'
  | 'Forearms'
  | 'Legs'

export interface Muscle {
  id: MuscleId
  label: string
  region: Region
}

const m = (id: MuscleId, label: string, region: Region): Muscle => ({ id, label, region })

export const MUSCLES: Record<MuscleId, Muscle> = {
  delt_anterior: m('delt_anterior', 'Anterior Deltoid', 'Shoulders'),
  delt_lateral: m('delt_lateral', 'Lateral Deltoid', 'Shoulders'),
  delt_posterior: m('delt_posterior', 'Posterior Deltoid', 'Shoulders'),

  triceps_long: m('triceps_long', 'Triceps Long Head', 'Triceps'),
  triceps_lateral: m('triceps_lateral', 'Triceps Lateral Head', 'Triceps'),
  triceps_medial: m('triceps_medial', 'Triceps Medial Head', 'Triceps'),

  pec_clavicular: m('pec_clavicular', 'Clavicular Head', 'Chest'),
  pec_sternal: m('pec_sternal', 'Sternal Head', 'Chest'),
  serratus_anterior: m('serratus_anterior', 'Serratus Anterior', 'Chest'),

  abs: m('abs', 'Abs', 'Core'),
  obliques: m('obliques', 'Obliques', 'Core'),

  traps_upper: m('traps_upper', 'Upper Trapezius', 'Back'),
  traps_middle: m('traps_middle', 'Middle Trapezius', 'Back'),
  traps_lower: m('traps_lower', 'Lower Trapezius', 'Back'),
  infraspinatus: m('infraspinatus', 'Infraspinatus & Teres Minor', 'Back'),
  lats: m('lats', 'Latissimus Dorsi & Teres Major', 'Back'),
  erector_spinae: m('erector_spinae', 'Erector Spinae', 'Back'),

  brachioradialis: m('brachioradialis', 'Brachioradialis', 'Forearms'),
  forearm_extensors: m('forearm_extensors', 'Forearm Extensors', 'Forearms'),
  forearm_flexors: m('forearm_flexors', 'Forearm Flexors', 'Forearms'),

  glutes: m('glutes', 'Glutes', 'Legs'),
  quadriceps: m('quadriceps', 'Quadriceps', 'Legs'),
  hamstrings: m('hamstrings', 'Hamstrings', 'Legs'),
  adductors: m('adductors', 'Adductors', 'Legs'),
  abductors: m('abductors', 'Abductors', 'Legs'),
  calves: m('calves', 'Calves', 'Legs'),

  neck: m('neck', 'Neck', 'Neck'),
  biceps: m('biceps', 'Biceps', 'Biceps'),
}

/**
 * The byte each muscle is stored as in the GLB's ID map (src/idMap.ts).
 * Fixed numbers rather than list positions, so the list can change without
 * scrambling tagged maps. A new muscle takes the next unused number; reuse a
 * RETIRED_CODES number only for a part covering the same area, so its old
 * tags come back.
 */
export const MUSCLE_CODES: Record<MuscleId, number> = {
  pec_clavicular: 1,
  pec_sternal: 2,
  serratus_anterior: 3,
  delt_anterior: 4,
  delt_lateral: 5,
  delt_posterior: 6,
  triceps_long: 11,
  triceps_lateral: 12,
  traps_upper: 7,
  traps_middle: 8,
  biceps: 13,
  abs: 17,
  obliques: 18,
  hamstrings: 25,
  adductors: 26,
  triceps_medial: 29,
  // The whole back before it was split; lats cover most of it.
  lats: 32,
  // The whole forearm before it was split; the flexors cover most of the tagged area's inside.
  forearm_flexors: 33,
  quadriceps: 34,
  abductors: 35,
  calves: 36,
  glutes: 37,
  traps_lower: 38,
  infraspinatus: 39,
  forearm_extensors: 16,
  brachioradialis: 40,
  // Was `lower_back` in the 28-muscle list: same area, so its old tags come back.
  erector_spinae: 10,
  neck: 41,
}

/**
 * Codes of muscles from the previous list that have no part yet. Tags with
 * these codes stay in saved maps (they show as untagged) until a part reuses
 * the code.
 */
export const RETIRED_CODES: Record<number, string> = {
  9: 'lats (28-muscle list)',
  14: 'brachialis',
  15: 'forearm_flexors (28-muscle list)',
  19: 'glute_max',
  20: 'glute_med',
  21: 'hip_flexors',
  22: 'quads_rectus',
  23: 'quads_outer',
  24: 'quads_inner',
  27: 'gastrocnemius',
  28: 'soleus',
  30: 'biceps_short',
  31: 'pec_abdominal',
}

{
  const all = [...Object.values(MUSCLE_CODES), ...Object.keys(RETIRED_CODES).map(Number)]
  const dupe = all.find((c, i) => all.indexOf(c) !== i)
  if (dupe !== undefined) throw new Error(`ID map code ${dupe} is used twice`)
}

/**
 * Muscles that are split into parts. The model shows the group until the
 * user drills into it (right-click), then the parts. Exercise data always uses
 * the parts; a group's intensity is its strongest part's.
 */
export const GROUPS = {
  shoulders: { label: 'Shoulders', region: 'Shoulders', muscles: ['delt_anterior', 'delt_lateral', 'delt_posterior'] },
  triceps: { label: 'Triceps', region: 'Triceps', muscles: ['triceps_long', 'triceps_lateral', 'triceps_medial'] },
  chest: { label: 'Chest', region: 'Chest', muscles: ['pec_clavicular', 'pec_sternal', 'serratus_anterior'] },
  core: { label: 'Core', region: 'Core', muscles: ['abs', 'obliques'] },
  back: {
    label: 'Back',
    region: 'Back',
    muscles: ['traps_upper', 'traps_middle', 'traps_lower', 'infraspinatus', 'lats', 'erector_spinae'],
  },
  forearms: {
    label: 'Forearms',
    region: 'Forearms',
    muscles: ['brachioradialis', 'forearm_extensors', 'forearm_flexors'],
  },
  legs: {
    label: 'Legs',
    region: 'Legs',
    muscles: ['glutes', 'quadriceps', 'hamstrings', 'adductors', 'abductors', 'calves'],
  },
} as const satisfies Record<string, { label: string; region: Region; muscles: readonly MuscleId[] }>

export type GroupId = keyof typeof GROUPS
export const GROUP_IDS = Object.keys(GROUPS) as GroupId[]

/** What can be hovered, selected and heat-mapped: a single muscle or a whole group. */
export type Target = MuscleId | GroupId
export const ALL_TARGETS: Target[] = [...MUSCLE_IDS, ...GROUP_IDS]

export const TARGETS: Record<Target, { id: Target; label: string; region: Region }> = {
  ...MUSCLES,
  ...(Object.fromEntries(GROUP_IDS.map((g) => [g, { id: g, label: GROUPS[g].label, region: GROUPS[g].region }])) as Record<
    GroupId,
    { id: GroupId; label: string; region: Region }
  >),
}

export const isGroup = (t: Target): t is GroupId => t in GROUPS

export function groupOf(muscle: MuscleId): GroupId | null {
  return GROUP_IDS.find((g) => (GROUPS[g].muscles as readonly MuscleId[]).includes(muscle)) ?? null
}

export function musclesOf(target: Target): readonly MuscleId[] {
  return isGroup(target) ? GROUPS[target].muscles : [target]
}

/** What a muscle shows as right now: its group, unless the user has drilled into it. */
export function displayTarget(muscle: MuscleId, expanded: readonly GroupId[]): Target {
  const group = groupOf(muscle)
  return group && !expanded.includes(group) ? group : muscle
}

/** Every target currently on show, in MUSCLE_IDS order (a group sits where its first part would). */
export function visibleTargets(expanded: readonly GroupId[]): Target[] {
  return [...new Set(MUSCLE_IDS.map((m) => displayTarget(m, expanded)))]
}

/**
 * Maps a mesh name to a muscle id, for a GLB split into one mesh per muscle
 * (named like `obliques_L`, `obliques_R`, `abs_C`, or just `obliques`). The
 * current model is a single mesh and uses the ID map instead; this is the one
 * place to translate a split model's mesh names into muscle ids.
 */
export function muscleFromMeshName(name: string): MuscleId | null {
  const base = name.replace(/_(L|R|C)$/, '')
  return (MUSCLE_IDS as readonly string[]).includes(base) ? (base as MuscleId) : null
}
