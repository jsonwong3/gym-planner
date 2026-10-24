import type { MuscleId } from './muscles'

/**
 * Placeholder anatomy built from primitives so the app runs with no assets.
 * Conventions: +Y is up, +Z is the front of the body, and the `_L` mesh sits
 * on +X (the person's left is on the viewer's right when facing front).
 *
 * Replace this whole file with a GLB (see README) once you have a real model.
 */

export type Shape =
  | { kind: 'capsule'; radius: number; length: number }
  | { kind: 'sphere'; radius: number }
  | { kind: 'box'; size: [number, number, number] }

type Vec3 = [number, number, number]

export interface Part {
  muscle: MuscleId
  shape: Shape
  position: Vec3 // for mirrored parts, the +X (left) side
  scale?: Vec3
  rotation?: Vec3
  mirror?: boolean
}

const sphere = (radius: number): Shape => ({ kind: 'sphere', radius })
const capsule = (radius: number, length: number): Shape => ({ kind: 'capsule', radius, length })

/**
 * One part per muscle (per side), so mesh names stay unique. Muscles that
 * absorb smaller ones (mid/lower traps take in the rhomboids, forearm
 * extensors the brachioradialis) are sized to cover both areas.
 */
const PARTS: Part[] = [
  // Chest
  { muscle: 'pec_upper', shape: sphere(0.1), position: [0.14, 1.29, 0.12], scale: [1.3, 0.5, 0.5], mirror: true },
  { muscle: 'pec_lower', shape: sphere(0.13), position: [0.14, 1.15, 0.135], scale: [1.15, 0.7, 0.5], mirror: true },
  { muscle: 'serratus', shape: sphere(0.07), position: [0.27, 1.02, 0.05], scale: [0.6, 1.3, 0.8], mirror: true },

  // Shoulders: three delt heads around one centre
  { muscle: 'delt_front', shape: sphere(0.075), position: [0.375, 1.28, 0.06], scale: [0.95, 1.4, 0.85], mirror: true },
  { muscle: 'delt_side', shape: sphere(0.072), position: [0.43, 1.285, 0], scale: [0.8, 1.4, 0.95], mirror: true },
  { muscle: 'delt_rear', shape: sphere(0.075), position: [0.375, 1.28, -0.06], scale: [0.95, 1.4, 0.85], mirror: true },

  // Back
  { muscle: 'traps_upper', shape: sphere(0.1), position: [0.14, 1.42, -0.055], scale: [1.5, 0.65, 0.75], rotation: [0, 0, -0.35], mirror: true },
  { muscle: 'traps_mid', shape: sphere(0.1), position: [0, 1.16, -0.14], scale: [1.6, 2.1, 0.45] },
  { muscle: 'lats', shape: sphere(0.15), position: [0.21, 0.92, -0.11], scale: [0.8, 1.3, 0.45], rotation: [0, 0, -0.15], mirror: true },
  { muscle: 'lower_back', shape: capsule(0.045, 0.36), position: [0.055, 0.74, -0.15], mirror: true },

  // Upper arms. The triceps long head sits on the inner back of the arm, the lateral head on the outer.
  { muscle: 'biceps_brachii', shape: capsule(0.062, 0.22), position: [0.45, 1.0, 0.04], mirror: true },
  { muscle: 'brachialis', shape: capsule(0.04, 0.1), position: [0.5, 0.87, 0.005], mirror: true },
  { muscle: 'triceps_long', shape: capsule(0.045, 0.26), position: [0.425, 1.0, -0.055], mirror: true },
  { muscle: 'triceps_lateral', shape: capsule(0.042, 0.2), position: [0.485, 1.03, -0.04], mirror: true },

  // Forearms (palms face forward, +Z)
  { muscle: 'forearm_flexors', shape: capsule(0.036, 0.2), position: [0.46, 0.6, 0.035], mirror: true },
  { muscle: 'forearm_extensors', shape: capsule(0.038, 0.22), position: [0.49, 0.62, -0.025], mirror: true },

  // Core
  { muscle: 'abs', shape: sphere(0.13), position: [0, 0.86, 0.14], scale: [1, 1.9, 0.45] },
  { muscle: 'obliques', shape: sphere(0.09), position: [0.23, 0.84, 0.1], scale: [0.8, 1.9, 0.5], mirror: true },

  // Hips
  { muscle: 'glute_max', shape: sphere(0.14), position: [0.13, 0.32, -0.12], scale: [1, 1, 0.9], mirror: true },
  { muscle: 'glute_med', shape: sphere(0.08), position: [0.24, 0.44, -0.04], scale: [0.6, 1, 1], mirror: true },
  { muscle: 'hip_flexors', shape: sphere(0.06), position: [0.13, 0.3, 0.13], scale: [1, 1.4, 0.6], rotation: [0, 0, 0.4], mirror: true },

  // Thighs. Rectus femoris runs down the middle of the front, the outer quad (vastus lateralis)
  // along the side, the inner quad (vastus medialis) is the teardrop above the knee.
  { muscle: 'quads_rectus', shape: capsule(0.05, 0.48), position: [0.16, -0.17, 0.1], mirror: true },
  { muscle: 'quads_outer', shape: capsule(0.06, 0.44), position: [0.215, -0.22, 0.045], mirror: true },
  { muscle: 'quads_inner', shape: sphere(0.06), position: [0.11, -0.5, 0.075], scale: [0.9, 1.6, 0.8], mirror: true },
  { muscle: 'hamstrings', shape: capsule(0.095, 0.5), position: [0.16, -0.22, -0.05], mirror: true },
  { muscle: 'adductors', shape: capsule(0.05, 0.32), position: [0.06, -0.08, 0.005], rotation: [0, 0, 0.15], mirror: true },

  // Calves
  { muscle: 'gastrocnemius', shape: sphere(0.08), position: [0.15, -0.98, -0.06], scale: [1, 1.6, 0.8], mirror: true },
  { muscle: 'soleus', shape: capsule(0.062, 0.2), position: [0.15, -1.17, -0.04], mirror: true },
]

export interface MusclePartInstance {
  /** Mesh name, e.g. `lats_L`. Same convention as a real GLB. */
  name: string
  muscle: MuscleId
  shape: Shape
  position: Vec3
  scale: Vec3
  rotation: Vec3
}

export const MUSCLE_PARTS: MusclePartInstance[] = PARTS.flatMap((p) => {
  const scale = p.scale ?? [1, 1, 1]
  const rotation = p.rotation ?? [0, 0, 0]
  if (!p.mirror) {
    return [{ name: `${p.muscle}_C`, muscle: p.muscle, shape: p.shape, position: p.position, scale, rotation }]
  }
  const [x, y, z] = p.position
  return [
    { name: `${p.muscle}_L`, muscle: p.muscle, shape: p.shape, position: [x, y, z] as Vec3, scale, rotation },
    {
      name: `${p.muscle}_R`,
      muscle: p.muscle,
      shape: p.shape,
      position: [-x, y, z] as Vec3,
      scale,
      rotation: [rotation[0], -rotation[1], -rotation[2]] as Vec3,
    },
  ]
})

/** Non-interactive "skin" pieces that give the muscles something to sit on. */
export interface SkinPiece {
  name: string
  shape: Shape
  position: Vec3
  scale?: Vec3
  rotation?: Vec3
}

const side = (x: number): number[] => [x, -x]

export const SKIN: SkinPiece[] = [
  { name: 'head', shape: { kind: 'sphere', radius: 0.2 }, position: [0, 1.78, 0], scale: [0.9, 1.1, 1] },
  { name: 'neck', shape: { kind: 'capsule', radius: 0.07, length: 0.1 }, position: [0, 1.52, 0] },
  { name: 'torso', shape: { kind: 'sphere', radius: 0.3 }, position: [0, 0.95, 0], scale: [1, 1.6, 0.55] },
  { name: 'shoulder_girdle', shape: { kind: 'capsule', radius: 0.07, length: 0.62 }, position: [0, 1.32, 0], rotation: [0, 0, Math.PI / 2] },
  { name: 'pelvis', shape: { kind: 'sphere', radius: 0.27 }, position: [0, 0.35, 0], scale: [1, 0.7, 0.6] },
  ...side(0.45).map((x, i) => ({ name: `upper_arm_${i}`, shape: { kind: 'capsule', radius: 0.055, length: 0.35 } as Shape, position: [x, 1.0, 0] as Vec3 })),
  ...side(0.47).map((x, i) => ({ name: `forearm_${i}`, shape: { kind: 'capsule', radius: 0.045, length: 0.3 } as Shape, position: [x, 0.62, 0] as Vec3 })),
  ...side(0.47).map((x, i) => ({ name: `hand_${i}`, shape: { kind: 'sphere', radius: 0.05 } as Shape, position: [x, 0.38, 0] as Vec3, scale: [0.9, 1.3, 0.6] as Vec3 })),
  ...side(0.15).map((x, i) => ({ name: `thigh_${i}`, shape: { kind: 'capsule', radius: 0.09, length: 0.55 } as Shape, position: [x, -0.2, 0] as Vec3 })),
  ...side(0.15).map((x, i) => ({ name: `knee_${i}`, shape: { kind: 'sphere', radius: 0.08 } as Shape, position: [x, -0.73, 0] as Vec3, scale: [1, 1.5, 1] as Vec3 })),
  ...side(0.15).map((x, i) => ({ name: `shin_${i}`, shape: { kind: 'capsule', radius: 0.06, length: 0.45 } as Shape, position: [x, -1.17, 0] as Vec3 })),
  ...side(0.15).map((x, i) => ({ name: `foot_${i}`, shape: { kind: 'box', size: [0.12, 0.06, 0.26] } as Shape, position: [x, -1.5, 0.06] as Vec3 })),
]
