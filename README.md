# Muscle Explorer (frontend prototype)

Rotate a 3D body, tap a muscle, see exercises that train it, add them to a plan, then see a heatmap of which muscles the plan works.

Stack: Vite + React + TypeScript, three.js via React Three Fiber + drei, Zustand (plan persisted to `localStorage`). Plain CSS, no UI library.

## Run

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # type-check + production build
```

## Desktop and Android

The same web app (`dist/`) is wrapped for both; nothing in `src/` knows which it's running in. The browser version works as before.

**Desktop (Windows, Electron):** `electron/main.js` opens a window and serves `dist/` from a custom `app://bundle/` scheme rather than `file://`, so `fetch()` of the model works, `/models/...` paths resolve, and localStorage (the saved plan) has a stable origin.

```bash
npm run desktop:dev    # Vite + an Electron window on the dev server, with hot reload
npm run desktop        # build, then run the built app in Electron
npm run desktop:dist   # build installers into release/: "Muscle Explorer Setup x.y.z.exe" and a portable .exe
```

The installers aren't code-signed, so Windows SmartScreen warns on first run ("More info" -> "Run anyway"). There's no app icon yet (the Electron default is used): add `build/icon.ico` (256x256) and electron-builder picks it up. If Electron starts as plain Node ("bad option" or "does not provide an export named BrowserWindow"), the shell has `ELECTRON_RUN_AS_NODE` set (VS Code's extension host does this); unset it.

**Android (Capacitor):** `capacitor.config.ts` plus the generated Android Studio project in `android/` (committed; its own `.gitignore` leaves out builds and the copied web files). Needs [Android Studio](https://developer.android.com/studio), which brings the SDK, Java and the emulator.

```bash
npm run android:sync   # build, then copy dist/ into the Android project (do this after every web change)
npm run android:open   # open android/ in Android Studio (run, debug, build an APK/AAB from there)
npm run android        # build, sync and run on a connected phone or a running emulator
```

Emulator: Android Studio -> Device Manager -> create a device (e.g. Pixel, recent x86_64 image), set Graphics to Hardware (the model needs WebGL). Windows needs virtualisation enabled in the BIOS plus Windows Hypervisor Platform (or the Android Emulator hypervisor driver from the SDK Manager). Quick check without Capacitor: `npm run dev -- --host`, then open `http://10.0.2.2:5173` in the emulator's Chrome (10.0.2.2 is the host PC).

## How it fits together

| File | Role |
| --- | --- |
| `src/data/muscles.ts` | The muscles, their fixed ID map codes (`MUSCLE_CODES`), the drill-down `GROUPS`, and `muscleFromMeshName()` (mesh name -> muscle id) |
| `src/data/muscle_list.csv` | The exercise list: target group, target part and secondary parts with their shares. See [Exercises](#exercises-muscle_listcsv) |
| `src/data/exercises.ts` | Parses and validates `muscle_list.csv`; which exercises a muscle or group lists. Replace with an API call later |
| `src/idMap.ts` | GLB muscle ID map: lookup by UV, texel position bake, fill / assign, undo, PNG load/save |
| `src/lasso.ts` | Lasso drawing and picking the visible texels inside it |
| `src/heat.ts` | Heatmap maths + colour scale. Pure functions, no React |
| `src/units.ts` | kg/lb conversion and formatting. Weights are stored in kg; the unit only changes display and input |
| `src/components/Settings.tsx` | Settings dialog (cog in the top bar): weight unit, default sets/reps for new exercises, heatmap colour scale |
| `src/components/Steppers.tsx` | Sets/reps stepper and weight box, shared by the plan, the add dialog and settings |
| `src/components/DayPicker.tsx` | "+ Add" dialog: sets, reps, weight and an optional note for the exercise, then which day (or a new one) |
| `src/components/NoteField.tsx` | Auto-growing note box, shared by plan rows, day cards and the add dialog |
| `src/useHeat.ts` | Hook: heat for the plan under the current scope |
| `src/store.ts` | Zustand store: selection, hover, camera snap, tabs, heatmap scope, settings; plan, notes, tracker log, unit, default sets/reps and heatmap colours persisted |
| `src/components/BodyViewer.tsx` | Canvas, raycast click/hover, orbit controls, camera snap, heat colouring |
| `src/components/ExercisePanel.tsx` | Search box, group/part filter chips, then search results, every exercise, or the selected muscle's exercises; Add button |
| `src/search.ts` | Fuzzy exercise search: word prefixes, typos (1 for 4-6 letters, 2 from 7, swaps count as 1), letters in order as a last resort; muscle names and ids match too, weighted by their share of the work. Pure |
| `src/components/PlanPanel.tsx` | Days with sets/reps/weight and notes: click to highlight on the model, drag to reorder, Active checkbox, "Heatmap" shortcut |
| `src/components/HeatmapPanel.tsx` | Scope chips, legend, ranked muscle bars, per-muscle breakdown, untrained list |
| `src/tracking.ts` | Tracker weeks (Monday keys), set marks and tallies. Pure |
| `src/components/TrackPanel.tsx` | Tracker tab: week picker, each active day's sets to mark hit or missed |
| `src/components/TagPanel.tsx` | Tag-mode tools for painting the ID map |
| `src/components/MuscleTags.tsx` | Shows every muscle an exercise works, with its share of the work |

Click behaviour worth knowing:
- Left and right meshes share a muscle id, so tapping either side highlights both.
- Muscles split into parts start as one group: hovering any delt says "Shoulders". See [Muscles](#muscles) for the list. Right-click drills into the parts (right-click a part to merge it back); **↺ Regroup** merges everything. On touch, the exercise panel offers the same through its part chips. Exercise data always uses the parts; in the heatmap a group counts its best part.
- Taps are told apart from orbit drags using R3F's `e.delta`.
- The sidebar folds away with the chevron in its tab bar (to a thin rail on desktop, to just the tab bar on phones; tapping a tab reopens it). On desktop, drag its left edge to resize it (360-760px, default 560, wide enough for sets, reps and weight on one line; arrow keys work when the edge is focused, double-click resets). Neither is persisted.
- The model is one mesh, so the raycast stops at the first surface hit: untagged areas act as skin, and you can't click through the torso to a back muscle.

## Muscles

| Group | Parts |
| --- | --- |
| Shoulders | anterior, lateral, posterior deltoid |
| Triceps | long, lateral, medial head |
| Chest | clavicular head, sternal head, serratus anterior |
| Core | abs, obliques |
| Back | upper, middle, lower trapezius; infraspinatus & teres minor; latissimus dorsi & teres major; erector spinae |
| Forearms | brachioradialis, extensors, flexors |
| Legs | glutes, quadriceps, hamstrings, adductors, abductors, calves |
| Neck, Biceps | WIP: one whole-area muscle each, no parts yet |

WIP areas work like any single muscle (tag, select, heatmap) until they're split; see the comment at the top of `muscles.ts` for how to split one without losing its tags.

## Exercises (`muscle_list.csv`)

The exercise list is `src/data/muscle_list.csv`; `src/data/exercises.ts` parses it at load. One row per exercise:

| Column | Meaning |
| --- | --- |
| `exercise_id` | Stable id saved in plans. Never renumber or reuse one; names can change freely |
| `exercise_name` | Shown in the app and searched |
| `target_group` | The one muscle or group whose list shows this exercise (e.g. `Chest`, `Biceps`), even if it works others |
| `target_part`, `target_part_weight` | The main part worked and its share |
| `secondary_part_N`, `secondary_part_weight_N` | Up to five more parts and their shares |

Muscles and groups can be written as their label or id; case, punctuation and a trailing "s" are ignored (`Tricep` = `Triceps`). Weights are shares of the work, so a row's weights add up to 1:

```
Barbell Bench Press, Chest, Sternal Head 0.5, Clavicular Head 0.15, Anterior Deltoid 0.15,
  Triceps Lateral Head 0.1, Triceps Long Head 0.05, Triceps Medial Head 0.05
```

Rows without a name or a `target_part` are skipped as unfinished. Anything else that's wrong (unknown muscle, duplicate id, weights not adding up to 1) throws when the data loads.

With nothing selected, the Exercises tab lists every exercise, in sections by group; the chips above it filter to one group (same as tapping it on the model), and a group's parts then show as a second row of chips to drill into. Selecting a group lists every exercise whose `target_group` is that group. After drilling into a part, exercises from that group that target the part are primary, and ones that only work it as a secondary part are listed under "Also works this muscle". The weights are rough, relative numbers, not EMG data; tune them freely.

## Heatmap

Open the **Heatmap** tab (or tap **Heatmap** on a day in the plan). The body is recoloured from the plan:

```
muscle load (effective sets) = sum of  sets x credit
credit = 1 for the target part, else min(0.5, weight / target part's weight)
```

A set counts in full for the exercise's target part; the weights only set how much the other parts get, relative to the target, capped at half a set (research counts indirect work as about half, Pelland et al. 2025). 4 sets of bench press = 4 for the sternal pec, 1.2 for the clavicular pec and front delts, 0.8 for the lateral triceps. A group counts its best part, so the same 4 sets count as 4 for "Chest", not 4 + 1.2. Reps are ignored: hard sets of roughly 6-30 reps build about the same muscle, and set count is what the research measures.

- **Scope:** all days, or a single day (chips at the top of the tab). "All days" counts only days ticked **Active** in the plan; unticked (draft) days are dashed and only show when picked on their own.
- **From the plan:** click a day's card on the My plan tab to colour what that day works on the model (same scale, one-day scope, groups shown as groups); click it again to clear. Drag a day by its ⠿ handle (or focus it and use the arrow keys) to reorder; the card follows the pointer and the other days dim while you drag. ▾ next to the handle collapses a day to its header (remembered). Exercises within a day reorder with the ▲/▼ buttons on each row.
- **Colour scale:** load is divided by `FULL_HEAT_SETS` (8 for one day, 12 for all days, in `src/heat.ts`) and capped at 1. All days is treated as a week: 12-20 sets per muscle per week is the usual recommendation, so 12 already counts as full, and one session stops adding much past about 11. The colours are picked in Settings (`HEAT_PALETTES` in `src/heat.ts`): Ember (purple -> crimson -> orange -> yellow, the default), Viridis, Plasma, Ocean, Mint and Traffic light. Grey means untrained.
- **Parts, not groups:** wherever heat is showing (the heatmap, or a day highlighted on the plan tab) every group is split into its parts (on the model and in the lists), so you can see e.g. front vs. rear delts; drill-down is off there. Showing heat with a whole group selected clears the selection; leaving it with a part selected drills into that part's group so it stays selected.
- **Breakdown:** tap a muscle (on the model or in the list) to see which exercises contribute and how much.

## Notes and tracker

- **Notes:** each exercise in a day has a note (**+ Note** under its sets/reps/weight, or the add dialog's note box), and each day has one (**+ Day note** under its title). Up to 500 characters, saved on blur; Esc reverts.
- **Tracker tab:** a first-pass template, one week (Monday-Sunday) at a time, with ‹ › to change week. Every active day lists its exercises with the planned sets × reps @ weight; tap a set once for hit (did the planned reps), again for missed, again to clear. **All hit** marks a whole exercise or day. The log is kept per week (`log` in the store, keyed by Monday's date) and counted against the plan as it is now, so changing an exercise's set count changes past weeks' totals too. Deleting a day deletes its history; **Clear all** clears the log.

## Real anatomy model (GLB)

`public/models/gray-body.glb` (the same mesh and UVs as the original coloured Tripo export, with a grey 256px texture) is the body, loaded by `GLBBody` in `BodyViewer.tsx`. It's scaled to a fixed height with its feet on a fixed floor (`BODY_HEIGHT`, `BODY_FEET_Y`) so the camera framing fits, and wrapped in drei's `<Bvh>` so raycasting a ~2M-triangle mesh on every pointer move stays smooth. Metalness is forced to 0 because Tripo's metalness map renders black without an environment map.

The shipped GLB is meshopt-compressed (~11 MB instead of ~59 MB; drei's `useGLTF` decodes it with no extra setup or network fetch). The uncompressed original is kept as `models-src/gray-body.source.glb`; edit that one, then regenerate with:

```bash
npx @gltf-transform/cli meshopt models-src/gray-body.source.glb public/models/gray-body.glb --quantize-texcoord 16
```

Use `meshopt` rather than `optimize`: `optimize` also simplifies and welds the mesh, and may re-encode textures (KTX2 can't be drawn to a canvas, which tag mode needs). `--quantize-texcoord 16` keeps UVs well under a texel of the 1024px ID map; the default 12 bits is a quarter-texel. Avoid Draco: drei fetches its decoder from a CDN, which breaks offline use. `models-src/` also holds tag-mode outputs (`mask-*.png`, per-muscle `body-ids-*.png`) that the app doesn't load; only files in `public/` are shipped.

A tap or hover is resolved to a muscle in this order:

1. **Mesh name**, if the model is split in Blender: name each muscle mesh `<muscle_id>_L|_R|_C` with the ids in `src/data/muscles.ts` (or extend `muscleFromMeshName`).
2. **ID map** (`src/idMap.ts`), for a single un-split mesh: one byte per texel of the base-colour texture, 0 = not a muscle, otherwise a `MUSCLE_CODES` value, looked up at the hit's UV. The material is patched (`onBeforeCompile`) to sample the same map, so selection, hover and heatmap colours tint just that muscle's texels, using the colours from `look()`.

Anything that resolves to neither behaves like skin: it blocks the raycast and tapping it clears the selection.

### Tagging the ID map

Click **Tag** (visible while the GLB is on), pick a muscle, then use a tool:

- **Lasso** (default): draw a loop round an area; every texel of the model that's inside it *and visible from the camera* is tagged (`src/lasso.ts`). Each texel's model-space position is baked once by rendering the mesh flattened into UV space; on release, positions are projected to the screen, tested against the loop (rasterised to a mask) and against a depth pass from the current camera, so the far side of the body or a muscle behind an arm isn't tagged. While lassoing, orbit with right-drag or two fingers and pan with Ctrl/Cmd + left-drag (pan works with every tag tool but only in tag mode; leaving it recentres the view). In tag mode scrolling zooms toward the cursor, down to 0.4 units from the body. **Reset** in the view controls restores the starting camera at any time.
- **Fill**: tap a colour patch; flood-fills texels of similar colour (within **Tolerance**), stopping `FILL_REACH` (12% of the model's height, in 3D) from the tapped point, since UV islands from distant body parts can sit next to each other in the texture.
- **Erase**: a lasso that untags.

Right-click (without dragging) picks the muscle already tagged there. **Undo** (or Ctrl/Cmd+Z) keeps the last 20 steps. Gutter texels bordering a tagged area are tagged with it, so nearest sampling at island edges doesn't show seams.

**Clean up** tidies hand-lassoed tags in one undoable step (`IdMap.cleanUp`): stray specks of up to 40 texels take whatever surrounds them; untagged slivers up to 3 texels wide with tags on both sides (straight across or down) are closed, repeated until nothing changes; untagged holes of up to 400 texels enclosed by tags are filled, each texel with its nearest muscle. Texels only count as neighbours if they're also close on the body, so nothing crosses UV seams, and open edges where muscle meets skin are left alone. Running it twice does nothing the second time. A toast says how many texels each pass changed.

Work in progress autosaves to `localStorage` (and wins over the file). **Download PNG** saves `body-ids-<muscle_id>.png`, named after the muscle last tagged so a series of saves is easy to tell apart; save the one to ship as `public/models/body-ids.png` so other browsers and phones get it. Each PNG holds every tag so far, not just that muscle. **Download all** saves `body-ids.png` (every tag, ready to ship) plus a `mask-<muscle_id>.png` per tagged muscle holding only that muscle; the browser may ask once to allow multiple downloads. The muscle code is in the red channel; green/blue are just for viewing. Codes are fixed per muscle (`MUSCLE_CODES`), so muscles can be added, renamed or removed without scrambling saved maps. A removed muscle's code goes in `RETIRED_CODES`: its texels stay in the map, untagged, until a new part reuses the code (only reuse one for the same area). Drafts from the original 42-muscle list are translated on load (`V1_CODES`). The PNG must be `ID_MAP_SIZE` (1024) square, whatever the model's texture size (re-exporting the model with a new texture layout means re-tagging).

## Next

Backend: Postgres (`muscles`, `exercises`, `exercise_muscles` with a `share` column, `plans`, `plan_items`), an API route `GET /api/exercises?muscle=...`, and plan sync per user.
