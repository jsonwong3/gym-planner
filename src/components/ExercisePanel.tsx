import { EXERCISES, exercisesForTarget } from '../data/exercises'
import type { Exercise } from '../data/exercises'
import { MUSCLES, TARGETS, groupOf, isGroup, musclesOf, visibleTargets } from '../data/muscles'
import type { Target } from '../data/muscles'
import { useEffect, useMemo } from 'react'
import type { PointerEvent } from 'react'
import { searchExercises } from '../search'
import { useStore } from '../store'
import MuscleTags from './MuscleTags'

/** `muscle` is highlighted in the exercise's muscle tags (none in search results). */
function ExerciseRow({ exercise, muscle }: { exercise: Exercise; muscle: Target | null }) {
  const openPicker = useStore((s) => s.openPicker)
  const setPreview = useStore((s) => s.setPreviewExercise)
  // A row that disappears under the mouse (tab switch, new search) never gets a pointerleave.
  useEffect(
    () => () => {
      if (useStore.getState().previewExerciseId === exercise.id) setPreview(null)
    },
    [exercise.id, setPreview],
  )
  // Titles of the days this exercise is already in (a string, so the selector stays stable).
  const inDays = useStore((s) =>
    s.days
      .filter((d) => d.items.some((i) => i.exerciseId === exercise.id))
      .map((d) => d.title)
      .join(', '),
  )
  return (
    <li
      className="row"
      // Mouse only, like the chips' hover preview: a tap fires pointerenter but often no pointerleave.
      onPointerEnter={(e) => e.pointerType === 'mouse' && setPreview(exercise.id)}
      onPointerLeave={() => setPreview(null)}
    >
      <div className="row-main">
        <div className="row-name">{exercise.name}</div>
        <MuscleTags exercise={exercise} highlight={muscle} />
        {inDays && <div className="row-in">✓ {inDays}</div>}
      </div>
      <button
        className="add"
        onClick={() => {
          setPreview(null) // the dialog covers the row without a pointerleave
          openPicker(exercise.id)
        }}
        aria-label={`Add ${exercise.name} to a day`}
      >
        + Add
      </button>
    </li>
  )
}

function Section({ title, items, muscle }: { title: string; items: Exercise[]; muscle: Target }) {
  if (items.length === 0) return null
  return (
    <section>
      <h3 className="section-title">
        {title} <span>{items.length}</span>
      </h3>
      <ul className="list">
        {items.map((e) => (
          <ExerciseRow key={e.id} exercise={e} muscle={muscle} />
        ))}
      </ul>
    </section>
  )
}

/**
 * Mouse hover over a chip previews that muscle on the model. Mouse only: a tap
 * fires pointerenter but often no pointerleave, which would leave it lit.
 */
function useHoverPreview() {
  const hover = useStore((s) => s.hover)
  return (target: Target) => ({
    onPointerEnter: (e: PointerEvent) => e.pointerType === 'mouse' && hover(target),
    onPointerLeave: () => hover(null),
  })
}

/** The top-level filters: every group, plus muscles that aren't in one. */
const TOP_TARGETS = visibleTargets([])

/** The group (or ungrouped muscle) a target belongs to, i.e. its top-level filter. */
const topOf = (target: Target): Target => (isGroup(target) ? target : (groupOf(target) ?? target))

/**
 * Filter chips: "All" plus every top-level target. Picking one selects it, as
 * tapping the model would, so the model highlights it too.
 */
function GroupFilter({ selected }: { selected: Target | null }) {
  const select = useStore((s) => s.select)
  const preview = useHoverPreview()
  const active = selected && topOf(selected)
  return (
    <div className="chips wrap" role="group" aria-label="Filter by muscle group">
      <button className={`chip ${!active ? 'active' : ''}`} aria-pressed={!active} onClick={() => select(null)}>
        All
      </button>
      {TOP_TARGETS.map((t) => (
        <button
          key={t}
          className={`chip ${active === t ? 'active' : ''}`}
          aria-pressed={active === t}
          onClick={() => select(t)}
          {...preview(t)}
        >
          {TARGETS[t].label}
        </button>
      ))}
    </div>
  )
}

/**
 * Same drill-down as right-clicking the model, for touch screens: once a group
 * (or one of its parts) is picked, its parts show as a second row of chips.
 * Tapping the picked part again goes back to the whole group.
 */
function PartFilter({ selected }: { selected: Target }) {
  const select = useStore((s) => s.select)
  const drillDown = useStore((s) => s.drillDown)
  const preview = useHoverPreview()
  const group = topOf(selected)
  if (!isGroup(group)) return null
  const part = isGroup(selected) ? null : selected
  return (
    <div className="chips wrap parts" role="group" aria-label={`${TARGETS[group].label} parts`}>
      <button
        className={`chip small ${!part ? 'active' : ''}`}
        aria-pressed={!part}
        onClick={() => part && drillDown(part)}
        {...preview(group)}
      >
        All {TARGETS[group].label}
      </button>
      {musclesOf(group).map((m) => (
        <button
          key={m}
          className={`chip small ${part === m ? 'active' : ''}`}
          aria-pressed={part === m}
          // From the whole group, or back to it, is a drill-down; between parts is a plain select.
          onClick={() => (part && part !== m ? select(m) : drillDown(m))}
          {...preview(m)}
        >
          {MUSCLES[m].label}
        </button>
      ))}
    </div>
  )
}

/** Nothing selected: every exercise, in sections by the group it's listed under. */
function BrowseAll() {
  const sections = useMemo(
    () => TOP_TARGETS.map((t) => ({ target: t, items: EXERCISES.filter((e) => topOf(e.group) === t) })),
    [],
  )
  return (
    <div className="scroll">
      {sections.map(({ target, items }) => (
        <Section key={target} title={TARGETS[target].label} items={items} muscle={target} />
      ))}
      <p className="muted pad">Tap a muscle on the model or pick a group above to narrow this down.</p>
    </div>
  )
}

/** Fuzzy search over every exercise (src/search.ts). Esc clears it. */
function SearchBox() {
  const query = useStore((s) => s.exerciseQuery)
  const setQuery = useStore((s) => s.setExerciseQuery)
  return (
    <div className="search">
      <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden>
        <circle cx="11" cy="11" r="6.5" fill="none" stroke="currentColor" strokeWidth="2" />
        <path d="M16 16l4.5 4.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
      <input
        type="search"
        value={query}
        placeholder="Search exercises"
        aria-label="Search exercises"
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') setQuery('')
        }}
      />
      {query && (
        <button className="search-clear" onClick={() => setQuery('')} aria-label="Clear search">
          ✕
        </button>
      )}
    </div>
  )
}

function SearchResults({ query }: { query: string }) {
  const results = useMemo(() => searchExercises(query), [query])
  return (
    <div className="scroll">
      {results.length === 0 ? (
        <p className="muted pad">No exercises match "{query.trim()}".</p>
      ) : (
        <section>
          <h3 className="section-title">
            Results <span>{results.length}</span>
          </h3>
          <ul className="list">
            {results.map((e) => (
              <ExerciseRow key={e.id} exercise={e} muscle={null} />
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}

export default function ExercisePanel() {
  const selected = useStore((s) => s.selected)
  const query = useStore((s) => s.exerciseQuery)

  if (query.trim()) {
    return (
      <div className="panel-body">
        <SearchBox />
        <SearchResults query={query} />
      </div>
    )
  }

  if (!selected) {
    return (
      <div className="panel-body">
        <SearchBox />
        <GroupFilter selected={null} />
        <BrowseAll />
      </div>
    )
  }

  const { primary, secondary } = exercisesForTarget(selected)

  return (
    <div className="panel-body">
      <SearchBox />
      <GroupFilter selected={selected} />
      <PartFilter selected={selected} />
      <div className="panel-head">
        <h2>{TARGETS[selected].label}</h2>
        <span className="muted">{TARGETS[selected].region}</span>
      </div>

      <div className="scroll">
        <Section title="Primary" items={primary} muscle={selected} />
        <Section title="Also works this muscle" items={secondary} muscle={selected} />
        {primary.length + secondary.length === 0 && <p className="muted pad">No exercises for this muscle yet.</p>}
      </div>
    </div>
  )
}
