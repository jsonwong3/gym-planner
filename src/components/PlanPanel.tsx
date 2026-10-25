import { useEffect, useRef, useState } from 'react'
import type { KeyboardEvent, MouseEvent, PointerEvent } from 'react'
import { EXERCISES_BY_ID } from '../data/exercises'
import { TARGETS, displayTarget } from '../data/muscles'
import type { Target } from '../data/muscles'
import { isTitleTaken, splitGroups, useStore } from '../store'
import type { Day, PlanItem } from '../store'
import MuscleTags from './MuscleTags'
import { Stepper, WeightInput } from './Steppers'

/**
 * Exercise order within a day. Up/down buttons rather than a drag grip, so it
 * can't be mistaken for (or fight with) dragging the whole day.
 */
function OrderButtons({ dayId, item, index, count }: { dayId: string; item: PlanItem; index: number; count: number }) {
  const moveItem = useStore((s) => s.moveItem)
  const name = EXERCISES_BY_ID[item.exerciseId]?.name ?? 'exercise'
  return (
    <div className="order-btns">
      <button
        className="order-btn"
        disabled={index === 0}
        onClick={() => moveItem(dayId, item.exerciseId, index - 1)}
        aria-label={`Move ${name} up`}
        title="Move up"
      >
        ▲
      </button>
      <button
        className="order-btn"
        disabled={index === count - 1}
        onClick={() => moveItem(dayId, item.exerciseId, index + 1)}
        aria-label={`Move ${name} down`}
        title="Move down"
      >
        ▼
      </button>
    </div>
  )
}

function PlanRow({ dayId, item, index, count }: { dayId: string; item: PlanItem; index: number; count: number }) {
  const exercise = EXERCISES_BY_ID[item.exerciseId]
  const update = useStore((s) => s.updateItem)
  const remove = useStore((s) => s.removeFromDay)
  if (!exercise) return null
  return (
    <li className="plan-row">
      <div className="plan-top">
        {count > 1 && <OrderButtons dayId={dayId} item={item} index={index} count={count} />}
        <div className="plan-main">
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
 * the slot whose neighbours' midpoints the pointer is between, and the card
 * follows the pointer so it's clear what's being moved.
 */
function DragHandle({ day, index, onDragging }: { day: Day; index: number; onDragging: (on: boolean) => void }) {
  const moveDay = useStore((s) => s.moveDay)

  const onPointerDown = (e: PointerEvent<HTMLButtonElement>) => {
    if (e.button !== 0) return
    e.preventDefault()
    const handle = e.currentTarget
    const list = handle.closest<HTMLElement>('.day-list')
    const card = handle.closest<HTMLElement>('.day')
    const scroller = handle.closest('.scroll')
    if (!list || !card) return
    handle.setPointerCapture(e.pointerId)
    onDragging(true)
    list.classList.add('reordering')
    // Where on the card it was grabbed, so the card keeps that point under the pointer.
    const grabOffset = e.clientY - card.getBoundingClientRect().top
    let pointerY = e.clientY
    let frame = 0
    let scrollFrame = 0
    // Offsets the card from wherever the list has put it to under the pointer,
    // kept inside the list. Unclamped, the offset card grows the scroll area,
    // which the edge scroll then chases forever. Measured with the offset
    // cleared, since the slot moves as the list reorders.
    const place = () => {
      card.style.transform = ''
      const own = card.getBoundingClientRect()
      const bounds = list.getBoundingClientRect()
      const top = Math.max(bounds.top, Math.min(bounds.bottom - own.height, pointerY - grabOffset))
      card.style.transform = `translateY(${top - own.top}px)`
    }
    const reorder = () => {
      const others = [...list.querySelectorAll<HTMLElement>('[data-day-id]')].filter((c) => c.dataset.dayId !== day.id)
      const slot = others.filter((c) => {
        const r = c.getBoundingClientRect()
        return pointerY > r.top + r.height / 2
      }).length
      moveDay(day.id, slot)
      place()
      // Again once React has moved the card to its new slot.
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(place)
    }
    // Keeps scrolling while the pointer rests near an edge, until the list runs out.
    const autoScroll = () => {
      scrollFrame = 0
      if (!scroller) return
      const r = scroller.getBoundingClientRect()
      const step = pointerY < r.top + DRAG_SCROLL_EDGE ? -12 : pointerY > r.bottom - DRAG_SCROLL_EDGE ? 12 : 0
      if (!step) return
      const before = scroller.scrollTop
      scroller.scrollTop += step
      if (scroller.scrollTop === before) return
      reorder()
      scrollFrame = requestAnimationFrame(autoScroll)
    }
    const move = (ev: globalThis.PointerEvent) => {
      if (ev.pointerId !== e.pointerId) return
      pointerY = ev.clientY
      reorder()
      if (!scrollFrame) scrollFrame = requestAnimationFrame(autoScroll)
    }
    const up = (ev: globalThis.PointerEvent) => {
      if (ev.pointerId !== e.pointerId) return
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
      cancelAnimationFrame(frame)
      cancelAnimationFrame(scrollFrame)
      card.style.transform = ''
      list.classList.remove('reordering')
      onDragging(false)
    }
    // On window, not the handle: React moves the card's node when it reorders
    // the list, which drops pointer capture, and the handle would stop getting
    // moves and the release, leaving the drag stuck.
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
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
  // Parts while a day is highlighted, so the chips match the model.
  const expanded = useStore(splitGroups)
  const focused = useStore((s) => s.planFocus === day.id)
  const focusDay = useStore((s) => s.focusDay)
  const setActive = useStore((s) => s.setDayActive)
  const setCollapsed = useStore((s) => s.setDayCollapsed)
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
      className={`day ${focused ? 'focused' : ''} ${day.active ? '' : 'inactive'} ${dragging ? 'dragging' : ''} ${day.collapsed ? 'collapsed' : ''}`}
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
        <button
          className="collapse-btn"
          onClick={() => setCollapsed(day.id, !day.collapsed)}
          aria-expanded={!day.collapsed}
          aria-label={`${day.collapsed ? 'Expand' : 'Collapse'} ${day.title}`}
          title={day.collapsed ? 'Expand' : 'Collapse'}
        >
          ▾
        </button>
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

      {day.collapsed ? null : day.items.length === 0 ? (
        <p className="muted day-empty">Nothing here yet. Tap a muscle and add exercises to this day.</p>
      ) : (
        <ul className="list">
          {day.items.map((item, i) => (
            <PlanRow key={item.exerciseId} dayId={day.id} item={item} index={i} count={day.items.length} />
          ))}
        </ul>
      )}

      {!day.collapsed && covered.size > 0 && (
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
