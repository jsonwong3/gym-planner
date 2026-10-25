import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { EXERCISES_BY_ID } from './data/exercises'
import { GROUP_IDS, displayTarget, groupOf, isGroup, musclesOf } from './data/muscles'
import type { GroupId, MuscleId, Target } from './data/muscles'
import { ALL_DAYS } from './heat'
import type { HeatScope } from './heat'
import { MAX_KG } from './units'
import type { Unit } from './units'

export interface PlanItem {
  exerciseId: string
  sets: number
  reps: number
  /** Weight per set in kg, shown in the user's unit; null until they set one (or for bodyweight work). */
  weight: number | null
}

/** A day is its own mini-plan, with a title and whether it counts yet. */
export interface Day {
  id: string
  title: string
  items: PlanItem[]
  /** Unticked while the user is still working a day out: it stays editable but is left out of the all-days heatmap. */
  active: boolean
  /** Folded down to its header in the plan tab. */
  collapsed: boolean
}

/** What the add dialog sets on a new plan item. */
export type ItemValues = Partial<Pick<PlanItem, 'sets' | 'reps' | 'weight'>>

export type Tab = 'exercises' | 'plan' | 'heatmap'

/** Desktop sidebar widths (px). CSS also caps it so the model keeps some room on narrow windows. */
export const SIDEBAR_DEFAULT = 560
export const SIDEBAR_MIN = 360
export const SIDEBAR_MAX = 760
export type TagTool = 'lasso' | 'fill' | 'erase'

interface State {
  selected: Target | null
  hovered: Target | null
  /** Groups the user has drilled into (right-click), so their parts show separately. Not persisted. */
  expanded: GroupId[]
  tab: Tab
  /** Sidebar folded away to a thin rail (desktop) or just its tab bar (phone). Not persisted. */
  sidebarCollapsed: boolean
  /** Sidebar width in px on desktop, set by dragging its edge. Not persisted. */
  sidebarWidth: number
  autoRotate: boolean
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
  /** Day clicked on the plan tab: the model colours what it works. Not persisted. */
  planFocus: string | null
  /** Set while the "add to which day?" picker is open. */
  picker: { exerciseId: string } | null
  /** `viewPlan` adds a "View plan" button (after adding an exercise). */
  toast: { message: string; nonce: number; viewPlan?: boolean } | null
  /** Unit weights are shown and entered in (stored in kg regardless). Persisted. */
  unit: Unit
  /** Sets and reps the "add to day" dialog starts at. Persisted. */
  defaultSets: number
  defaultReps: number
  settingsOpen: boolean
  /** Exercises tab search box; non-empty shows search results instead of the selected muscle's list. Not persisted. */
  exerciseQuery: string

  select: (id: Target | null) => void
  hover: (id: Target | null) => void
  /** Splits the muscle's group into its parts, or merges it back if already split. No-op on the heatmap, which always shows parts. */
  drillDown: (muscle: MuscleId) => void
  /** Merges every split group back together. */
  resetDrillDown: () => void
  /** Also unfolds the sidebar, so picking a tab always shows it. */
  setTab: (tab: Tab) => void
  toggleSidebar: () => void
  /** Clamped to SIDEBAR_MIN..SIDEBAR_MAX. */
  setSidebarWidth: (px: number) => void
  toggleAutoRotate: () => void
  toggleTagging: () => void
  setTagMuscle: (muscle: MuscleId) => void
  setTagTool: (tool: TagTool) => void
  setTagTolerance: (tolerance: number) => void
  bumpIdMap: () => void
  snapView: (azimuth: number) => void
  /** Back to the starting camera: centred, front-on, default zoom. */
  resetView: () => void

  setHeatScope: (scope: HeatScope) => void
  /** Highlights a day's muscles on the model, or clears it if that day is already highlighted. */
  focusDay: (dayId: string) => void
  /** Jump to the heatmap tab, optionally for one day. */
  showHeatmap: (scope?: HeatScope) => void

  openPicker: (exerciseId: string) => void
  closePicker: () => void
  /** Shows a short message in the toast. */
  notify: (message: string) => void
  dismissToast: () => void
  setUnit: (unit: Unit) => void
  /** Clamped like plan items (1-99). */
  setDefaults: (patch: Partial<Pick<State, 'defaultSets' | 'defaultReps'>>) => void
  /** Opens or closes the settings dialog (the cog in the top bar). */
  setSettingsOpen: (open: boolean) => void
  setExerciseQuery: (query: string) => void

  /** Creates an empty day and returns its id. Blank title falls back to the next free "Day N". */
  addDay: (title?: string) => string
  /** Ignored if the title is blank or another day already has it. */
  renameDay: (dayId: string, title: string) => void
  removeDay: (dayId: string) => void
  /** Moves a day to `index` in the list (clamped). */
  moveDay: (dayId: string, index: number) => void
  setDayActive: (dayId: string, active: boolean) => void
  setDayCollapsed: (dayId: string, collapsed: boolean) => void
  /** `values` come from the add dialog; anything missing falls back to the defaults (weight: none). */
  addToDay: (dayId: string, exerciseId: string, values?: ItemValues) => void
  addToNewDay: (exerciseId: string, title?: string, values?: ItemValues) => void
  removeFromDay: (dayId: string, exerciseId: string) => void
  /** Moves an exercise to `index` within its day (clamped). */
  moveItem: (dayId: string, exerciseId: string, index: number) => void
  updateItem: (
    dayId: string,
    exerciseId: string,
    patch: Partial<Pick<PlanItem, 'sets' | 'reps' | 'weight'>>,
  ) => void
  clearAll: () => void
}

// Not crypto.randomUUID: that needs a secure context, and this app is often
// opened over plain http on a LAN IP when testing on a phone.
const newId = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36)
/** Sets and reps: whole numbers, 1-99. */
export const clamp = (n: number) => Math.max(1, Math.min(99, Math.round(n) || 1))
/** Kg, kept to 0.01 kg (finer than any unit shows); blank, zero or nonsense clears it. */
const clampWeight = (kg: number | null) =>
  kg !== null && Number.isFinite(kg) && kg > 0 ? Math.round(Math.min(MAX_KG, kg) * 100) / 100 : null

/**
 * Keeps a selected target valid after the drill-down changes: a split group
 * becomes `part` (the muscle the user right-clicked) or its first part, and a
 * part of a merged group becomes the group.
 */
function remap(target: Target | null, expanded: readonly GroupId[], part?: MuscleId): Target | null {
  if (!target) return null
  if (!isGroup(target)) return displayTarget(target, expanded)
  if (!expanded.includes(target)) return target
  const parts = musclesOf(target)
  return part && parts.includes(part) ? part : parts[0]
}

/**
 * Whether the model shows heat colours: on the heatmap tab, or on the plan tab
 * while a day is highlighted (`planFocus`). `useHeat` picks the matching scope.
 */
export const showsHeat = (s: Pick<State, 'tab' | 'planFocus'>) => s.tab === 'heatmap' || (s.tab === 'plan' && !!s.planFocus)

/**
 * Groups currently showing as their parts: every group while heat is showing
 * (load is per part, so the parts are what's worth comparing), otherwise the
 * ones the user drilled into. Pass to `displayTarget` / `visibleTargets`.
 */
export const splitGroups = (s: Pick<State, 'tab' | 'planFocus' | 'expanded'>): readonly GroupId[] =>
  showsHeat(s) ? GROUP_IDS : s.expanded

/** Heat views only show parts, so a selected group has nothing to point at there. */
const partOnly = (target: Target | null) => (target && isGroup(target) ? null : target)

/**
 * Leaving a heat view with a part selected keeps it, drilling into its group
 * so the model shows it too; anything else is remapped to what's on show.
 */
function keepSelection(s: Pick<State, 'selected' | 'expanded'>): Pick<State, 'selected' | 'expanded'> {
  const group = s.selected && !isGroup(s.selected) ? groupOf(s.selected) : null
  const expanded = group && !s.expanded.includes(group) ? [...s.expanded, group] : s.expanded
  return { expanded, selected: remap(s.selected, expanded) }
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
      sidebarCollapsed: false,
      sidebarWidth: SIDEBAR_DEFAULT,
      autoRotate: false,
      tagging: false,
      tagMuscle: 'pec_sternal',
      tagTool: 'lasso',
      tagTolerance: 24,
      idMapRevision: 0,
      view: { azimuth: 0, reset: false, nonce: 0 },

      days: [],
      heatScope: ALL_DAYS,
      planFocus: null,
      picker: null,
      toast: null,
      unit: 'kg',
      defaultSets: 4,
      defaultReps: 10,
      settingsOpen: false,
      exerciseQuery: '',

      // Picking a muscle shows its exercises (so it also clears any search), except while looking at
      // the heatmap, where it should stay put and show that muscle's breakdown.
      select: (id) =>
        set((s) => {
          if (!id) return { selected: null }
          if (s.tab === 'heatmap') return { selected: id, exerciseQuery: '' }
          // A part picked from a heat view (a highlighted plan day) needs its group drilled into on the exercises tab.
          const group = isGroup(id) ? null : groupOf(id)
          const expanded = group && !s.expanded.includes(group) ? [...s.expanded, group] : s.expanded
          return { selected: id, tab: 'exercises', exerciseQuery: '', expanded }
        }),
      hover: (id) => set({ hovered: id }),
      drillDown: (muscle) =>
        set((s) => {
          const group = groupOf(muscle)
          if (!group || showsHeat(s)) return {}
          const expanded = s.expanded.includes(group)
            ? s.expanded.filter((g) => g !== group)
            : [...s.expanded, group]
          return { expanded, selected: remap(s.selected, expanded, muscle), hovered: displayTarget(muscle, expanded) }
        }),
      resetDrillDown: () => set((s) => ({ expanded: [], selected: remap(s.selected, []), hovered: null })),
      setTab: (tab) =>
        set((s) =>
          showsHeat({ ...s, tab })
            ? { tab, sidebarCollapsed: false, selected: partOnly(s.selected) }
            : { tab, sidebarCollapsed: false, ...keepSelection(s) },
        ),
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      setSidebarWidth: (px) => set({ sidebarWidth: Math.round(Math.max(SIDEBAR_MIN, Math.min(SIDEBAR_MAX, px))) }),
      toggleAutoRotate: () => set((s) => ({ autoRotate: !s.autoRotate })),
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
      focusDay: (dayId) =>
        set((s) =>
          s.planFocus === dayId
            ? { planFocus: null, ...keepSelection(s) }
            : { planFocus: dayId, selected: partOnly(s.selected) },
        ),
      showHeatmap: (scope = ALL_DAYS) =>
        set((s) => ({ heatScope: scope, tab: 'heatmap', selected: partOnly(s.selected) })),

      openPicker: (exerciseId) => set({ picker: { exerciseId } }),
      closePicker: () => set({ picker: null }),
      notify: (message) => set((s) => ({ toast: { message, nonce: (s.toast?.nonce ?? 0) + 1 } })),
      dismissToast: () => set({ toast: null }),
      setUnit: (unit) => set({ unit }),
      setDefaults: (patch) =>
        set({
          ...(patch.defaultSets !== undefined ? { defaultSets: clamp(patch.defaultSets) } : {}),
          ...(patch.defaultReps !== undefined ? { defaultReps: clamp(patch.defaultReps) } : {}),
        }),
      setSettingsOpen: (open) => set({ settingsOpen: open }),
      setExerciseQuery: (query) => set({ exerciseQuery: query }),

      addDay: (title) => {
        const id = newId()
        set((s) => ({
          days: [
            ...s.days,
            {
              id,
              title: title?.trim() ? uniqueTitle(s.days, title.trim()) : nextDayTitle(s.days),
              items: [],
              active: true,
              collapsed: false,
            },
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
          ...(s.planFocus === dayId ? { planFocus: null, ...keepSelection(s) } : {}),
        })),
      moveDay: (dayId, index) =>
        set((s) => {
          const from = s.days.findIndex((d) => d.id === dayId)
          const to = Math.max(0, Math.min(s.days.length - 1, index))
          if (from < 0 || from === to) return {}
          const days = [...s.days]
          days.splice(to, 0, ...days.splice(from, 1))
          return { days }
        }),
      setDayActive: (dayId, active) =>
        set((s) => ({ days: s.days.map((d) => (d.id === dayId ? { ...d, active } : d)) })),
      setDayCollapsed: (dayId, collapsed) =>
        set((s) => ({ days: s.days.map((d) => (d.id === dayId ? { ...d, collapsed } : d)) })),

      addToDay: (dayId, exerciseId, values = {}) => {
        const day = get().days.find((d) => d.id === dayId)
        if (!day) return
        if (day.items.some((i) => i.exerciseId === exerciseId)) {
          set({ picker: null })
          return
        }
        const name = EXERCISES_BY_ID[exerciseId]?.name ?? 'Exercise'
        set((s) => {
          const item: PlanItem = {
            exerciseId,
            sets: clamp(values.sets ?? s.defaultSets),
            reps: clamp(values.reps ?? s.defaultReps),
            weight: clampWeight(values.weight ?? null),
          }
          return {
            days: s.days.map((d) => (d.id === dayId ? { ...d, items: [...d.items, item] } : d)),
            picker: null,
            toast: { message: `Added ${name} to ${day.title}`, nonce: (s.toast?.nonce ?? 0) + 1, viewPlan: true },
          }
        })
      },
      addToNewDay: (exerciseId, title, values) => {
        const dayId = get().addDay(title)
        get().addToDay(dayId, exerciseId, values)
      },

      removeFromDay: (dayId, exerciseId) =>
        set((s) => ({
          days: s.days.map((d) =>
            d.id === dayId ? { ...d, items: d.items.filter((i) => i.exerciseId !== exerciseId) } : d,
          ),
        })),
      moveItem: (dayId, exerciseId, index) =>
        set((s) => ({
          days: s.days.map((d) => {
            if (d.id !== dayId) return d
            const from = d.items.findIndex((i) => i.exerciseId === exerciseId)
            const to = Math.max(0, Math.min(d.items.length - 1, index))
            if (from < 0 || from === to) return d
            const items = [...d.items]
            items.splice(to, 0, ...items.splice(from, 1))
            return { ...d, items }
          }),
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
                          ...(patch.weight !== undefined ? { weight: clampWeight(patch.weight) } : {}),
                        },
                  ),
                },
          ),
        })),
      clearAll: () => set({ days: [], heatScope: ALL_DAYS, planFocus: null }),
    }),
    {
      name: 'muscle-explorer-plan',
      version: 7,
      partialize: (s) => ({ days: s.days, unit: s.unit, defaultSets: s.defaultSets, defaultReps: s.defaultReps }),
      migrate: (persisted, version) => {
        const old = persisted as
          | { plan?: PlanItem[]; days?: Day[]; unit?: Unit; defaultSets?: number; defaultReps?: number }
          | undefined
        // v0 stored one flat `plan` array. Keep it by moving it into "Day 1".
        let days: Day[] =
          version < 1 && old?.plan?.length
            ? [{ id: newId(), title: 'Day 1', items: old.plan, active: true, collapsed: false }]
            : (old?.days ?? [])
        // v2 regrouped the muscles and dropped the exercises left without one (neck, tibialis...).
        if (version < 2) {
          days = days.map((d) => ({ ...d, items: d.items.filter((i) => i.exerciseId in EXERCISES_BY_ID) }))
        }
        // v3 added `active`; existing days were all in use.
        if (version < 3) days = days.map((d) => ({ ...d, active: d.active ?? true }))
        // v4 added a weight per exercise (unset) and the unit setting.
        if (version < 4) days = days.map((d) => ({ ...d, items: d.items.map((i) => ({ ...i, weight: i.weight ?? null })) }))
        // v5 added default sets/reps for the add dialog.
        // v6 replaced the exercise list with muscle_list.csv (numeric ids); old exercises are gone.
        if (version < 6) {
          days = days.map((d) => ({ ...d, items: d.items.filter((i) => i.exerciseId in EXERCISES_BY_ID) }))
        }
        // v7 added `collapsed`; existing days start open.
        if (version < 7) days = days.map((d) => ({ ...d, collapsed: d.collapsed ?? false }))
        return {
          days,
          unit: old?.unit ?? 'kg',
          defaultSets: old?.defaultSets ?? 4,
          defaultReps: old?.defaultReps ?? 10,
        } as unknown as State
      },
    },
  ),
)
