# CLAUDE.md

Frontend-only prototype: rotate a 3D body, tap a muscle, browse exercises, build a multi-day plan, view a heatmap of trained muscles. See [README.md](README.md) for the file-by-file map, intensity scale, heatmap formula and GLB swap guide; don't duplicate it here, and keep it current when behaviour changes.

## Commands

```bash
npm run dev      # Vite dev server, http://localhost:5173
npm run build    # tsc --noEmit && vite build — the only correctness check
```

There are no tests, linter or formatter. Verify changes with `npm run build`.

## Stack

Vite + React 19 + TypeScript (strict), three.js via `@react-three/fiber` + `drei`, Zustand (`persist` to `localStorage`). Plain CSS in `src/styles.css`, no UI library. No backend; exercises come from `muscle_list.csv` (repo root), imported with `?raw` and parsed in `src/data/exercises.ts`.

## Architecture rules

- **`src/heat.ts` stays pure**: no React, no store access. Components get heat through `useHeat()`.
- **All app state lives in `src/store.ts`**. Only `days`, `unit`, `defaultSets` and `defaultReps` are persisted (`partialize`). If you change the shape of `Day` / `PlanItem` or add a persisted setting, bump `version` and extend `migrate` so existing users' plans survive.
- **Weights are stored in kg** (`PlanItem.weight`, null = unset) and converted only for display/input via `src/units.ts`, so switching unit never changes stored values.
- **`muscle_list.csv` is the source of truth for exercises.** Muscles and `target_group` are written as labels or ids (case, punctuation and a trailing "s" ignored). Each row's weights are shares of the work: each in (0, 1], adding up to 1. A bad row throws at load; rows with no name or no `target_part` are skipped as unfinished.
- **An exercise is listed only under its `target_group`** (and, after drilling in, under the parts of that group it works), even if it works other muscles. The heatmap still counts every muscle it works.
- **Exercise ids are the CSV's `exercise_id`.** Names can change freely; never renumber or reuse an id, or saved plans point at the wrong exercise (`computeHeat` silently skips unknown ids).
- **Mesh name → muscle** goes only through `muscleFromMeshName()` (`<muscle_id>_L|_R|_C`). Left/right meshes share one muscle id.
- Muscles are listed in the README; several areas are still WIP: one whole-area muscle each (e.g. `biceps`), to be split into a group of parts later (steps at the top of `muscles.ts`). Adding a muscle: add it to `MUSCLE_IDS`, `MUSCLES` and `MUSCLE_CODES` in `src/data/muscles.ts` (next unused code, or a `RETIRED_CODES` one covering the same area, then delete it there), then lasso it in tag mode. Never change an existing muscle's code: it's what saved ID maps store. Records keyed by `MuscleId` are exhaustive, so `tsc` will point out what's missing.
- **Muscle vs. group vs. target**: `GROUPS` bundle parts for drill-down. Group ids share a namespace with muscle ids, so they must differ (splitting the whole-area `back` muscle into a `back` group meant removing that muscle). `hovered` / `selected` / heat use `Target` (muscle or group); exercise data only ever names muscles. Map a mesh's muscle to what it currently shows as with `displayTarget(muscle, expanded)`. In the heatmap a set counts 1 for the target part and `min(SECONDARY_CAP, weight / target weight)` for other parts (`credit`); a group takes its best part (`creditOf`), never the sum.

## Gotchas

- Don't use `crypto.randomUUID` — the app is often opened over plain http on a LAN IP for phone testing (not a secure context). Use the existing `newId()`.
- Clicks vs. orbit drags are distinguished with R3F's `e.delta`; the body is one GLB mesh, so the first hit wins and untagged areas act as skin (you can't click through the torso).
- `select()` keeps the user on the heatmap tab if they're there (shows the breakdown); elsewhere it switches to exercises.
- UI must work on touch / phone widths.

## Style

2-space indent, no semicolons, single quotes, trailing commas. Short JSDoc on non-obvious fields and functions; comments explain *why*. British spelling in prose/comments (colour, stabiliser).
