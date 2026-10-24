import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { EXERCISES_BY_ID } from './data/exercises'
import { displayTarget, groupOf, isGroup, musclesOf } from './data/muscles'
import type { GroupId, MuscleId, Target } from './data/muscles'
import { ALL_DAYS } from './heat'
import type { HeatScope } from './heat'

export interface PlanItem {
  exerciseId: string
  sets: number
  reps: number
}

/** A day is its own mini-plan. For now the only editable config is the title. */
export interface Day {
  id: string
  title: string
  items: PlanItem[]
}

export type Tab = 'exercises' | 'plan' | 'heatmap'
export type TagTool = 'lasso' | 'fill' | 'erase'

interface State {
  selected: Target | null
  hovered: Target | null
  /** Groups the user has drilled into (right-click), so their parts show separately. Not persisted. */
  expanded: GroupId[]
  tab: Tab
  autoRotate: boolean
  /** Which body to draw: the built-in primitives or `public/models/body.glb`. Not persisted. */
  model: 'placeholder' | 'glb'
  /** Tag mode: taps paint the GLB's muscle ID map (src/idMap.ts) instead of selecting. Not persisted. */
  tagging: boolean
  /** Muscle that tag-mode taps assign. */
  tagMuscle: MuscleId
  /** Lasso tags what's drawn round, fill tags a tapped colour patch, erase is a lasso that untags. */
  tagTool: TagTool
  /** Fill tool's colour tolerance (RGB distance, 0-255 per channel). */
  tagTolerance: number
  /** Bumped on every ID map edit so UI showing its contents re-renders. */
  idMapRevision: number
  /** Camera request: snap to `azimuth` radians (0 = front), or `reset` to the starting view. `nonce` forces re-trigger. */
  view: { azimuth: number; reset: boolean; nonce: number }

  days: Day[]
  /** Heatmap scope: ALL_DAYS, or the id of a single day. */
  heatScope: HeatScope
  /** Set while the "add to which day?" picker is open. */
  picker: { exerciseId: string } | null
  toast: { message: string; nonce: number } | null

  select: (id: Target | null) => void
  hover: (id: Target | null) => void
  /** Splits the muscle's group into its parts, or merges it back if already split. */
  drillDown: (muscle: MuscleId) => void
  /** Merges every split group back together. */
  resetDrillDown: () => void
  setTab: (tab: Tab) => void
  toggleAutoRotate: () => void
  toggleModel: () => void
  toggleTagging: () => void
  setTagMuscle: (muscle: MuscleId) => void
  setTagTool: (tool: TagTool) => void
  setTagTolerance: (tolerance: number) => void
  bumpIdMap: () => void
  snapView: (azimuth: number) => void
  /** Back to the starting camera: centred, front-on, default zoom. */
  resetView: () => void

  setHeatScope: (scope: HeatScope) => void
  /** Jump to the heatmap tab, optionally for one day. */
  showHeatmap: (scope?: HeatScope) => void

  openPicker: (exerciseId: string) => void
  closePicker: () => void
  dismissToast: () => void

  /** Creates an empty day and returns its id. Blank title falls back to the next free "Day N". */
  addDay: (title?: string) => string
  /** Ignored if the title is blank or another day already has it. */
  renameDay: (dayId: string, title: string) => void
  removeDay: (dayId: string) => void
  addToDay: (dayId: string, exerciseId: string) => void
  addToNewDay: (exerciseId: string, title?: string) => void
  removeFromDay: (dayId: string, exerciseId: string) => void
  updateItem: (
    dayId: string,
    exerciseId: string,
    patch: Partial<Pick<PlanItem, 'sets' | 'reps'>>,
  ) => void
  clearAll: () => void
}

// Not crypto.randomUUID: that needs a secure context, and this app is often
// opened over plain http on a LAN IP when testing on a phone.
const newId = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36)
const clamp = (n: number) => Math.max(1, Math.min(99, Math.round(n) || 1))

/**
 * Keeps a selected target valid after the drill-down changes: a split group
 * becomes `part` (the muscle the user right-clicked) or its first part, and a
 * part of a merged group becomes the group.
 */
function remap(target: Target | null, expanded: GroupId[], part?: MuscleId): Target | null {
  if (!target) return null
  if (!isGroup(target)) return displayTarget(target, expanded)
  if (!expanded.includes(target)) return target
  const parts = musclesOf(target)
  return part && parts.includes(part) ? part : parts[0]
}

// Day titles are unique, ignoring case and surrounding spaces ("Push" = " push").
const titleKey = (title: string) => title.trim().toLowerCase()

export const isTitleTaken = (days: Day[], title: string, exceptDayId?: string) =>
  days.some((d) => d.id !== exceptDayId && titleKey(d.title) === titleKey(title))

/** First "Day N" not already used, counting up from the number of days. */
export function nextDayTitle(days: Day[]): string {
  let n = days.length + 1
  while (isTitleTaken(days, `Day ${n}`)) n++
  return `Day ${n}`
}

/** `title`, or `title (2)`, `title (3)`... if taken. A fallback; the UI blocks duplicates first. */
function uniqueTitle(days: Day[], title: string): string {
  let candidate = title
  for (let n = 2; isTitleTaken(days, candidate); n++) candidate = `${title} (${n})`
  return candidate
}

export const useStore = create<State>()(
  persist(
    (set, get) => ({
      selected: null,
      hovered: null,
      expanded: [],
      tab: 'exercises',
      autoRotate: false,
      model: 'glb',
      tagging: false,
      tagMuscle: 'pec_lower',
      tagTool: 'lasso',
      tagTolerance: 24,
      idMapRevision: 0,
      view: { azimuth: 0, reset: false, nonce: 0 },

      days: [],
      heatScope: ALL_DAYS,
      picker: null,
      toast: null,

      // Picking a muscle shows its exercises, except while looking at the
      // heatmap, where it should stay put and show that muscle's breakdown.
      select: (id) =>
        set((s) =>
          id ? { selected: id, tab: s.tab === 'heatmap' ? 'heatmap' : 'exercises' } : { selected: null },
        ),
      hover: (id) => set({ hovered: id }),
      drillDown: (muscle) =>
        set((s) => {
          const group = groupOf(muscle)
          if (!group) return {}
          const expanded = s.expanded.includes(group)
            ? s.expanded.filter((g) => g !== group)
            : [...s.expanded, group]
          return { expanded, selected: remap(s.selected, expanded, muscle), hovered: displayTarget(muscle, expanded) }
        }),
      resetDrillDown: () => set((s) => ({ expanded: [], selected: remap(s.selected, []), hovered: null })),
      setTab: (tab) => set({ tab }),
      toggleAutoRotate: () => set((s) => ({ autoRotate: !s.autoRotate })),
      // Tagging only makes sense on the GLB, so leaving it ends tag mode too.
      toggleModel: () => set((s) => ({ model: s.model === 'glb' ? 'placeholder' : 'glb', hovered: null, tagging: false })),
      toggleTagging: () => set((s) => ({ tagging: !s.tagging, hovered: null })),
      // Picking a muscle means you're about to tag it, so leave the eraser.
      setTagMuscle: (muscle) => set((s) => ({ tagMuscle: muscle, tagTool: s.tagTool === 'erase' ? 'lasso' : s.tagTool })),
      setTagTool: (tool) => set({ tagTool: tool }),
      setTagTolerance: (tolerance) => set({ tagTolerance: tolerance }),
      bumpIdMap: () => set((s) => ({ idMapRevision: s.idMapRevision + 1 })),
      snapView: (azimuth) =>
        set((s) => ({ autoRotate: false, view: { azimuth, reset: false, nonce: s.view.nonce + 1 } })),
      resetView: () => set((s) => ({ autoRotate: false, view: { azimuth: 0, reset: true, nonce: s.view.nonce + 1 } })),

      setHeatScope: (scope) => set({ heatScope: scope }),
      showHeatmap: (scope = ALL_DAYS) => set({ heatScope: scope, tab: 'heatmap' }),

      openPicker: (exerciseId) => set({ picker: { exerciseId } }),
      closePicker: () => set({ picker: null }),
      dismissToast: () => set({ toast: null }),

      addDay: (title) => {
        const id = newId()
        set((s) => ({
          days: [
            ...s.days,
            { id, title: title?.trim() ? uniqueTitle(s.days, title.trim()) : nextDayTitle(s.days), items: [] },
          ],
        }))
        return id
      },
      renameDay: (dayId, title) =>
        set((s) => {
          const t = title.trim()
          if (!t || isTitleTaken(s.days, t, dayId)) return {}
          return { days: s.days.map((d) => (d.id === dayId ? { ...d, title: t } : d)) }
        }),
      removeDay: (dayId) =>
        set((s) => ({
          days: s.days.filter((d) => d.id !== dayId),
          heatScope: s.heatScope === dayId ? ALL_DAYS : s.heatScope,
        })),

      addToDay: (dayId, exerciseId) => {
        const day = get().days.find((d) => d.id === dayId)
        if (!day) return
        if (day.items.some((i) => i.exerciseId === exerciseId)) {
          set({ picker: null })
          return
        }
        const name = EXERCISES_BY_ID[exerciseId]?.name ?? 'Exercise'
        set((s) => ({
          days: s.days.map((d) =>
            d.id === dayId ? { ...d, items: [...d.items, { exerciseId, sets: 3, reps: 10 }] } : d,
          ),
          picker: null,
          toast: { message: `Added ${name} to ${day.title}`, nonce: (s.toast?.nonce ?? 0) + 1 },
        }))
      },
      addToNewDay: (exerciseId, title) => {
        const dayId = get().addDay(title)
        get().addToDay(dayId, exerciseId)
      },

      removeFromDay: (dayId, exerciseId) =>
        set((s) => ({
          days: s.days.map((d) =>
            d.id === dayId ? { ...d, items: d.items.filter((i) => i.exerciseId !== exerciseId) } : d,
          ),
        })),
      updateItem: (dayId, exerciseId, patch) =>
        set((s) => ({
          days: s.days.map((d) =>
            d.id !== dayId
              ? d
              : {
                  ...d,
                  items: d.items.map((i) =>
                    i.exerciseId !== exerciseId
                      ? i
                      : {
                          ...i,
                          ...(patch.sets !== undefined ? { sets: clamp(patch.sets) } : {}),
                          ...(patch.reps !== undefined ? { reps: clamp(patch.reps) } : {}),
                        },
                  ),
                },
          ),
        })),
      clearAll: () => set({ days: [], heatScope: ALL_DAYS }),
    }),
    {
      name: 'muscle-explorer-plan',
      version: 2,
      partialize: (s) => ({ days: s.days }),
      migrate: (persisted, version) => {
        const old = persisted as { plan?: PlanItem[]; days?: Day[] } | undefined
        // v0 stored one flat `plan` array. Keep it by moving it into "Day 1".
        let days: Day[] =
          version < 1 && old?.plan?.length
            ? [{ id: newId(), title: 'Day 1', items: old.plan }]
            : (old?.days ?? [])
        // v2 regrouped the muscles and dropped the exercises left without one (neck, tibialis...).
        if (version < 2) {
          days = days.map((d) => ({ ...d, items: d.items.filter((i) => i.exerciseId in EXERCISES_BY_ID) }))
        }
        return { days } as unknown as State
      },
    },
  ),
)
