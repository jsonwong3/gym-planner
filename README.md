# Muscle Explorer (frontend prototype)

Rotate a 3D body, tap a muscle, see exercises that train it, add them to a plan, then see a heatmap of which muscles the plan works.

Stack: Vite + React + TypeScript, three.js via React Three Fiber + drei, Zustand (plan persisted to `localStorage`). Plain CSS, no UI library.

## Run

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # type-check + production build
```

## How it fits together

| File | Role |
| --- | --- |
| `src/data/bodyParts.ts` | Placeholder body made of primitives. Meshes are named `lats_L`, `abs_C`, etc., one part per muscle per side |
| `src/data/muscles.ts` | The 28 muscles, the 9 drill-down `GROUPS`, and `muscleFromMeshName()` (mesh name -> muscle id) |
| `src/data/exercises.ts` | Mock exercises, each with a `muscles` map of muscle -> intensity (0-1). Replace with an API call later |
| `src/idMap.ts` | GLB muscle ID map: lookup by UV, texel position bake, fill / assign, undo, PNG load/save |
| `src/lasso.ts` | Lasso drawing and picking the visible texels inside it |
| `src/heat.ts` | Heatmap maths + colour scale. Pure functions, no React |
| `src/useHeat.ts` | Hook: heat for the plan under the current scope |
| `src/store.ts` | Zustand store: selection, hover, camera snap, tabs, heatmap scope, plan (persisted) |
| `src/components/BodyViewer.tsx` | Canvas, raycast click/hover, orbit controls, camera snap, heat colouring |
| `src/components/ExercisePanel.tsx` | Exercises for the selected muscle, equipment filter, Add button |
| `src/components/PlanPanel.tsx` | Days with sets/reps, "Heatmap" shortcut per day |
| `src/components/HeatmapPanel.tsx` | Scope chips, legend, ranked muscle bars, per-muscle breakdown, untrained list |
| `src/components/TagPanel.tsx` | Tag-mode tools for painting the ID map |
| `src/components/MuscleTags.tsx` | Shows every muscle an exercise works, with its intensity |

Click behaviour worth knowing:
- Left and right meshes share a muscle id, so tapping either side highlights both.
- Muscles split into parts start as one group: hovering any delt says "Shoulders". See [Muscles](#muscles) for the list. Right-click drills into the parts (right-click a part to merge it back); **↺ Regroup** merges everything. On touch, the exercise panel offers the same through "Parts" chips and an "← All ..." link. Exercise data always uses the parts; a group's intensity is its strongest part's.
- Taps are told apart from orbit drags using R3F's `e.delta`.
- Skin meshes sit in the raycast too, so you can't click through the torso to a back muscle.

## Muscles

Named the way lifters split them, not full anatomy. Small or deep muscles are folded into a neighbour (rhomboids into mid/lower traps, brachioradialis into the forearm extensors, hip abductors into glute med/min); neck, rotator cuff, tibialis and the like aren't tracked.

| Group | Parts |
| --- | --- |
| Chest | upper, mid & lower |
| Shoulders | front, side, rear delts |
| Traps | upper, mid & lower |
| Triceps | long head, lateral & medial heads |
| Biceps | biceps brachii, brachialis |
| Forearms | flexors, extensors |
| Quads | rectus femoris, outer, inner |
| Glutes | max, med & min |
| Calves | gastrocnemius, soleus |

Single muscles: lats, abs, obliques, lower back, hamstrings, adductors, hip flexors, serratus.

## Muscle intensities

Every exercise lists all the muscles it works, each with an intensity from just above 0 up to 1:

```ts
ex('Barbell Bench Press', 'Barbell', I, {
  pec_lower: 1,
  pec_upper: 0.6,
  triceps_lateral: 0.5,
  triceps_long: 0.3,
  delt_front: 0.5,
})
```

| Intensity | Meaning | Example |
| --- | --- | --- |
| 1.0 | prime mover | bench press -> chest |
| 0.7-0.9 | co-prime mover | chin-up -> biceps |
| 0.4-0.6 | strong synergist | bench press -> triceps |
| 0.2-0.3 | stabiliser | push-up -> abs |

These are rough, relative numbers, not EMG data. Tune them freely.

`primary` and `secondary` are derived from this map (`primary` = intensity >= `PRIMARY_MIN`, 0.6), so the exercise lists keep working. A bad value (outside 0-1, or an exercise with no primary muscle) throws when the data loads.

## Heatmap

Open the **Heatmap** tab (or tap **Heatmap** on a day in the plan). The body is recoloured from the plan:

```
muscle load (effective sets) = sum of  sets x intensity
```

4 sets of bench press = 4 for sternal pec, 2 for triceps, 2 for front delts. A group uses its strongest part, so the same 4 sets count as 4 for "Chest", not 4 + 2.4. Reps are ignored; set count is the usual proxy for volume.

- **Scope:** all days, or a single day (chips at the top of the tab).
- **Colour scale:** load is divided by `FULL_HEAT_SETS` (10 for one day, 20 for all days, in `src/heat.ts`) and capped at 1. Purple -> crimson -> orange -> yellow. Grey means untrained.
- **Breakdown:** tap a muscle (on the model or in the list) to see which exercises contribute and how much.

## Real anatomy model (GLB)

`public/models/body.glb` is loaded by `GLBBody` in `BodyViewer.tsx`; the **GLB** button in the view controls toggles it against the placeholder (`model` in the store). It's scaled to the placeholder's height with its feet on the same floor, and wrapped in drei's `<Bvh>` so raycasting a ~2M-triangle mesh on every pointer move stays smooth. Metalness is forced to 0 because Tripo's metalness map renders black without an environment map.

A tap or hover is resolved to a muscle in this order:

1. **Mesh name**, if the model is split in Blender: name each muscle mesh `<muscle_id>_L|_R|_C` with the ids in `src/data/muscles.ts` (or extend `muscleFromMeshName`).
2. **ID map** (`src/idMap.ts`), for a single un-split mesh: one byte per texel of the base-colour texture, 0 = not a muscle, n = `MUSCLE_IDS[n - 1]`, looked up at the hit's UV. The material is patched (`onBeforeCompile`) to sample the same map, so selection, hover and heatmap colours tint just that muscle's texels, using the same colours as the placeholder's `look()`.

Anything that resolves to neither behaves like skin: it blocks the raycast and tapping it clears the selection.

### Tagging the ID map

Click **Tag** (visible while the GLB is on), pick a muscle, then use a tool:

- **Lasso** (default): draw a loop round an area; every texel of the model that's inside it *and visible from the camera* is tagged (`src/lasso.ts`). Each texel's model-space position is baked once by rendering the mesh flattened into UV space; on release, positions are projected to the screen, tested against the loop (rasterised to a mask) and against a depth pass from the current camera, so the far side of the body or a muscle behind an arm isn't tagged. While lassoing, orbit with right-drag or two fingers and pan with Ctrl/Cmd + left-drag (pan is only enabled in lasso mode; leaving it recentres the view). Scrolling zooms toward the cursor, down to 0.4 units from the body (2.5 for the placeholder). **Reset** in the view controls restores the starting camera at any time.
- **Fill**: tap a colour patch; flood-fills texels of similar colour (within **Tolerance**), stopping `FILL_REACH` (12% of the model's height, in 3D) from the tapped point, since UV islands from distant body parts can sit next to each other in the texture.
- **Erase**: a lasso that untags.

Right-click (without dragging) picks the muscle already tagged there. **Undo** (or Ctrl/Cmd+Z) keeps the last 20 steps. Gutter texels bordering a tagged area are tagged with it, so nearest sampling at island edges doesn't show seams.

Work in progress autosaves to `localStorage` (and wins over the file). **Download PNG** and save it as `public/models/body-ids.png` so other browsers and phones get it. The muscle code is in the red channel; green/blue are just for viewing. Codes are positions in `MUSCLE_IDS`, so reordering that list scrambles saved maps (append instead; drafts from the old 42-muscle list are translated on load, see `V1_MUSCLES`), and the PNG must match the texture's size (re-exporting the model with a new texture layout means re-tagging).

## Next

Backend: Postgres (`muscles`, `exercises`, `exercise_muscles` with an `intensity` column, `plans`, `plan_items`), an API route `GET /api/exercises?muscle=...`, and plan sync per user.
