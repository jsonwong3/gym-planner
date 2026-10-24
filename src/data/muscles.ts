/**
 * Muscle list, as a lifter would name things rather than full anatomy: big
 * muscles split into the parts that train differently (upper vs. mid/lower
 * chest, three delt heads...), small or deep muscles folded into their
 * neighbours (rhomboids into mid/lower traps, brachioradialis into the forearm
 * extensors, hip abductors into glute med/min).
 *
 * Codes in the GLB's ID map are positions in this list (src/idMap.ts), so
 * append rather than reorder once a map has been tagged.
 */
export const MUSCLE_IDS = [
  // Chest
  'pec_upper',
  'pec_lower',
  'serratus',
  // Shoulders
  'delt_front',
  'delt_side',
  'delt_rear',
  // Back
  'traps_upper',
  'traps_mid',
  'lats',
  'lower_back',
  // Upper arms
  'triceps_long',
  'triceps_lateral',
  'biceps_brachii',
  'brachialis',
  // Forearms
  'forearm_flexors',
  'forearm_extensors',
  // Core
  'abs',
  'obliques',
  // Hips
  'glute_max',
  'glute_med',
  'hip_flexors',
  // Thighs
  'quads_rectus',
  'quads_outer',
  'quads_inner',
  'hamstrings',
  'adductors',
  // Calves
  'gastrocnemius',
  'soleus',
] as const

export type MuscleId = (typeof MUSCLE_IDS)[number]

export type Region = 'Chest' | 'Shoulders' | 'Back' | 'Upper arms' | 'Forearms' | 'Core' | 'Hips' | 'Thighs' | 'Calves'

export interface Muscle {
  id: MuscleId
  label: string
  region: Region
}

const m = (id: MuscleId, label: string, region: Region): Muscle => ({ id, label, region })

export const MUSCLES: Record<MuscleId, Muscle> = {
  pec_upper: m('pec_upper', 'Upper chest', 'Chest'),
  pec_lower: m('pec_lower', 'Mid & lower chest', 'Chest'),
  serratus: m('serratus', 'Serratus', 'Chest'),

  delt_front: m('delt_front', 'Front delts', 'Shoulders'),
  delt_side: m('delt_side', 'Side delts', 'Shoulders'),
  delt_rear: m('delt_rear', 'Rear delts', 'Shoulders'),

  traps_upper: m('traps_upper', 'Upper traps', 'Back'),
  traps_mid: m('traps_mid', 'Mid & lower traps', 'Back'),
  lats: m('lats', 'Lats', 'Back'),
  lower_back: m('lower_back', 'Lower back', 'Back'),

  triceps_long: m('triceps_long', 'Triceps long head', 'Upper arms'),
  triceps_lateral: m('triceps_lateral', 'Triceps lateral & medial', 'Upper arms'),
  biceps_brachii: m('biceps_brachii', 'Biceps brachii', 'Upper arms'),
  brachialis: m('brachialis', 'Brachialis', 'Upper arms'),

  forearm_flexors: m('forearm_flexors', 'Forearm flexors', 'Forearms'),
  forearm_extensors: m('forearm_extensors', 'Forearm extensors', 'Forearms'),

  abs: m('abs', 'Abs', 'Core'),
  obliques: m('obliques', 'Obliques', 'Core'),

  glute_max: m('glute_max', 'Glute max', 'Hips'),
  glute_med: m('glute_med', 'Glute med & min', 'Hips'),
  hip_flexors: m('hip_flexors', 'Hip flexors', 'Hips'),

  quads_rectus: m('quads_rectus', 'Rectus femoris', 'Thighs'),
  quads_outer: m('quads_outer', 'Outer quads', 'Thighs'),
  quads_inner: m('quads_inner', 'Inner quads', 'Thighs'),
  hamstrings: m('hamstrings', 'Hamstrings', 'Thighs'),
  adductors: m('adductors', 'Adductors', 'Thighs'),

  gastrocnemius: m('gastrocnemius', 'Gastrocnemius', 'Calves'),
  soleus: m('soleus', 'Soleus', 'Calves'),
}

/**
 * Muscles that are split into parts. The model shows the group until the
 * user drills into it (right-click), then the parts. Exercise data always uses
 * the parts; a group's intensity is its strongest part's.
 */
export const GROUPS = {
  chest: { label: 'Chest', region: 'Chest', muscles: ['pec_upper', 'pec_lower'] },
  shoulders: { label: 'Shoulders', region: 'Shoulders', muscles: ['delt_front', 'delt_side', 'delt_rear'] },
  traps: { label: 'Traps', region: 'Back', muscles: ['traps_upper', 'traps_mid'] },
  triceps: { label: 'Triceps', region: 'Upper arms', muscles: ['triceps_long', 'triceps_lateral'] },
  biceps: { label: 'Biceps', region: 'Upper arms', muscles: ['biceps_brachii', 'brachialis'] },
  forearms: { label: 'Forearms', region: 'Forearms', muscles: ['forearm_flexors', 'forearm_extensors'] },
  quads: { label: 'Quads', region: 'Thighs', muscles: ['quads_rectus', 'quads_outer', 'quads_inner'] },
  glutes: { label: 'Glutes', region: 'Hips', muscles: ['glute_max', 'glute_med'] },
  calves: { label: 'Calves', region: 'Calves', muscles: ['gastrocnemius', 'soleus'] },
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
 * Maps a mesh name to a muscle id. Works for the placeholder body and for a
 * real GLB as long as meshes are named like `lats_L`, `lats_R`,
 * `abs_C` (or just `lats`). When you swap in a real anatomy
 * model, this mapping is the one place to translate its mesh names into your
 * muscle groups.
 */
export function muscleFromMeshName(name: string): MuscleId | null {
  const base = name.replace(/_(L|R|C)$/, '')
  return (MUSCLE_IDS as readonly string[]).includes(base) ? (base as MuscleId) : null
}
