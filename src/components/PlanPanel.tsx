import { useEffect, useRef, useState } from 'react'
import type { KeyboardEvent, MouseEvent, PointerEvent } from 'react'
import { EXERCISES_BY_ID } from '../data/exercises'
import { TARGETS, displayTarget } from '../data/muscles'
import type { Target } from '../data/muscles'
import { isTitleTaken, useStore } from '../store'
import type { Day, PlanItem } from '../store'
import MuscleTags from './MuscleTags'
import { Stepper, WeightInput } from './Steppers'

function PlanRow({ dayId, item }: { dayId: string; item: PlanItem }) {
  const exercise = EXERCISES_BY_ID[item.exerciseId]
  const update = useStore((s) => s.updateItem)
  const remove = useStore((s) => s.removeFromDay)
  if (!exercise) return null
  return (
    <li className="plan-row">
      <div className="plan-top">
        <div>
          <div className="row-name">{exercise.name}</div>
          <MuscleTags exercise={exercise} />
        </div>
        <button
          className="icon-btn"
          onClick={() => remove(dayId, item.exerciseId)}
          aria-label={`Remove ${exercise.name}`}
        >
          ✕
        </button>
      </div>
      <div className="plan-controls">
        <Stepper label="Sets" value={item.sets} onChange={(n) => update(dayId, item.exerciseId, { sets: n })} />
        <Stepper label="Reps" value={item.reps} onChange={(n) => update(dayId, item.exerciseId, { reps: n })} />
        <WeightInput kg={item.weight} onChange={(kg) => update(dayId, item.exerciseId, { weight: kg })} />
      </div>
    </li>
  )
}

/**
 * Edits a draft and only saves on blur/Enter, since typing can pass through
 * another day's title on the way ("Day 1" -> "Day 10"). A blank or duplicate
 * title reverts to the saved one; Esc also reverts.
 */
function DayTitleInput({ day }: { day: Day }) {
  const days = useStore((s) => s.days)
  const rename = useStore((s) => s.renameDay)
  const [draft, setDraft] = useState(day.title)
  const cancelled = useRef(false)
  useEffect(() => setDraft(day.title), [day.title])

  const taken = isTitleTaken(days, draft, day.id)
  const commit = () => {
    if (!cancelled.current && draft.trim() && !taken) {
      rename(day.id, draft)
      setDraft(draft.trim())
    } else {
      setDraft(day.title)
    }
    cancelled.current = false
  }

  return (
    <div className="day-title-field">
      <input
        className={`day-title ${taken ? 'invalid' : ''}`}
        value={draft}
        maxLength={40}
        aria-label="Day title"
        aria-invalid={taken}
        aria-describedby={taken ? `title-error-${day.id}` : undefined}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Escape') cancelled.current = true
          if (e.key === 'Enter' || e.key === 'Escape') e.currentTarget.blur()
        }}
      />
      {taken && (
        <div className="field-error" id={`title-error-${day.id}`}>
          Another day is already called that
        </div>
      )}
    </div>
  )
}

/** Edge band (px) of the plan's scroll area that scrolls it while dragging a day. */
const DRAG_SCROLL_EDGE = 48

/**
 * Grip that reorders a day by dragging (pointer events, so mouse and touch
 * both work) or with the arrow keys. The list reorders live: the day goes to
 * the slot whose neighbours' midpoints the pointer is between.
 */
function DragHandle({ day, index, onDragging }: { day: Day; index: number; onDragging: (on: boolean) => void }) {
  const moveDay = useStore((s) => s.moveDay)

  const onPointerDown = (e: PointerEvent<HTMLButtonElement>) => {
    if (e.button !== 0) return
    e.preventDefault()
    const handle = e.currentTarget
    const list = handle.closest('.day-list')
    const scroller = handle.closest('.scroll')
    if (!list) return
    handle.setPointerCapture(e.pointerId)
    onDragging(true)
    const move = (ev: globalThis.PointerEvent) => {
      if (scroller) {
        const r = scroller.getBoundingClientRect()
        if (ev.clientY < r.top + DRAG_SCROLL_EDGE) scroller.scrollTop -= 12
        else if (ev.clientY > r.bottom - DRAG_SCROLL_EDGE) scroller.scrollTop += 12
      }
      const others = [...list.querySelectorAll<HTMLElement>('[data-day-id]')].filter((c) => c.dataset.dayId !== day.id)
      const slot = others.filter((c) => {
        const r = c.getBoundingClientRect()
        return ev.clientY > r.top + r.height / 2
      }).length
      moveDay(day.id, slot)
    }
    const up = () => {
      handle.removeEventListener('pointermove', move)
      handle.removeEventListener('pointerup', up)
      handle.removeEventListener('pointercancel', up)
      onDragging(false)
    }
    handle.addEventListener('pointermove', move)
    handle.addEventListener('pointerup', up)
    handle.addEventListener('pointercancel', up)
  }

  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    const delta = e.key === 'ArrowUp' ? -1 : e.key === 'ArrowDown' ? 1 : 0
    if (!delta) return
    e.preventDefault()
    moveDay(day.id, index + delta)
  }

  return (
    <button
      className="drag-handle"
      aria-label={`Reorder ${day.title} (drag, or arrow keys)`}
      title="Drag to reorder"
      onPointerDown={onPointerDown}
      onKeyDown={onKeyDown}
    >
      ⠿
    </button>
  )
}

function DayCard({ day, index }: { day: Day; index: number }) {
  const removeDay = useStore((s) => s.removeDay)
  const select = useStore((s) => s.select)
  const showHeatmap = useStore((s) => s.showHeatmap)
  const expanded = useStore((s) => s.expanded)
  const focused = useStore((s) => s.planFocus === day.id)
  const focusDay = useStore((s) => s.focusDay)
  const setActive = useStore((s) => s.setDayActive)
  const [dragging, setDragging] = useState(false)

  const covered = new Set<Target>()
  let totalSets = 0
  for (const item of day.items) {
    totalSets += item.sets
    EXERCISES_BY_ID[item.exerciseId]?.primary.forEach((m) => covered.add(displayTarget(m, expanded)))
  }

  const onDelete = () => {
    if (day.items.length === 0 || window.confirm(`Delete "${day.title}" and its ${day.items.length} exercises?`)) {
      removeDay(day.id)
    }
  }

  // Clicking the card (not one of its controls) highlights the day's muscles on the model.
  const onCardClick = (e: MouseEvent<HTMLElement>) => {
    if ((e.target as HTMLElement).closest('button, input, label, a')) return
    focusDay(day.id)
  }

  return (
    <section
      className={`day ${focused ? 'focused' : ''} ${day.active ? '' : 'inactive'} ${dragging ? 'dragging' : ''}`}
      data-day-id={day.id}
      onClick={onCardClick}
      onKeyDown={(e) => {
        if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault()
          focusDay(day.id)
        }
      }}
      tabIndex={0}
      aria-current={focused || undefined}
      aria-label={`${day.title}${focused ? ', highlighted on the model' : ''}`}
      title={focused ? 'Click to stop highlighting' : 'Click to highlight on the model'}
    >
      <header className="day-head">
        <DragHandle day={day} index={index} onDragging={setDragging} />
        <DayTitleInput day={day} />
        <label className="day-active" title="Untick while you're still working this day out: it's left out of the all-days heatmap">
          <input type="checkbox" checked={day.active} onChange={(e) => setActive(day.id, e.target.checked)} />
          Active
        </label>
        {day.items.length > 0 && (
          <button className="text-btn neutral" onClick={() => showHeatmap(day.id)}>
            Heatmap
          </button>
        )}
        <button className="text-btn" onClick={onDelete}>
          Delete
        </button>
      </header>
      <div className="muted day-sub">
        {day.items.length} {day.items.length === 1 ? 'exercise' : 'exercises'} · {totalSets} sets
        {!day.active && ' · draft, not in the all-days heatmap'}
      </div>

      {day.items.length === 0 ? (
        <p className="muted day-empty">Nothing here yet. Tap a muscle and add exercises to this day.</p>
      ) : (
        <ul className="list">
          {day.items.map((item) => (
            <PlanRow key={item.exerciseId} dayId={day.id} item={item} />
          ))}
        </ul>
      )}

      {covered.size > 0 && (
        <div className="chips wrap day-chips">
          {[...covered].map((m) => (
            <button key={m} className="chip small" onClick={() => select(m)}>
              {TARGETS[m].label}
            </button>
          ))}
        </div>
      )}
    </section>
  )
}

export default function PlanPanel() {
  const days = useStore((s) => s.days)
  const addDay = useStore((s) => s.addDay)
  const clearAll = useStore((s) => s.clearAll)

  if (days.length === 0) {
    return (
      <div className="empty">
        <div className="empty-icon">＋</div>
        <p>No days yet. Add an exercise from the model to create one, or start with an empty day.</p>
        <button className="primary" onClick={() => addDay()}>
          + New day
        </button>
      </div>
    )
  }

  const totalExercises = days.reduce((n, d) => n + d.items.length, 0)

  return (
    <div className="panel-body">
      <div className="panel-head">
        <h2>My plan</h2>
        <span className="muted">
          {days.length} {days.length === 1 ? 'day' : 'days'} · {totalExercises} exercises
        </span>
      </div>

      <div className="scroll">
        <div className="day-list">
          {days.map((d, i) => (
            <DayCard key={d.id} day={d} index={i} />
          ))}
        </div>

        <div className="plan-actions">
          <button className="secondary" onClick={() => addDay()}>
            + New day
          </button>
          <button
            className="danger"
            onClick={() => {
              if (window.confirm('Delete all days and exercises?')) clearAll()
            }}
          >
            Clear all
          </button>
        </div>
      </div>
    </div>
  )
}
