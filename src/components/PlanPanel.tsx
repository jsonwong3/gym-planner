import { useEffect, useRef, useState } from 'react'
import { EXERCISES_BY_ID } from '../data/exercises'
import { TARGETS, displayTarget } from '../data/muscles'
import type { Target } from '../data/muscles'
import { isTitleTaken, useStore } from '../store'
import type { Day, PlanItem } from '../store'
import MuscleTags from './MuscleTags'

function Stepper({
  label,
  value,
  onChange,
}: {
  label: string
  value: number
  onChange: (n: number) => void
}) {
  return (
    <label className="stepper">
      <span>{label}</span>
      <div>
        <button type="button" onClick={() => onChange(value - 1)} aria-label={`Decrease ${label}`}>
          −
        </button>
        <input
          inputMode="numeric"
          value={value}
          onChange={(e) => onChange(Number(e.target.value.replace(/\D/g, '')))}
        />
        <button type="button" onClick={() => onChange(value + 1)} aria-label={`Increase ${label}`}>
          +
        </button>
      </div>
    </label>
  )
}

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
          <div className="row-meta">{exercise.equipment}</div>
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

function DayCard({ day }: { day: Day }) {
  const removeDay = useStore((s) => s.removeDay)
  const select = useStore((s) => s.select)
  const showHeatmap = useStore((s) => s.showHeatmap)
  const expanded = useStore((s) => s.expanded)

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

  return (
    <section className="day">
      <header className="day-head">
        <DayTitleInput day={day} />
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
        {days.map((d) => (
          <DayCard key={d.id} day={d} />
        ))}

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
