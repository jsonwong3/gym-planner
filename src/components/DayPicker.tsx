import { useEffect, useState } from 'react'
import { EXERCISES_BY_ID } from '../data/exercises'
import { isTitleTaken, nextDayTitle, useStore } from '../store'

/** "Add to which day?" dialog. Opens when the user taps + Add on an exercise. */
export default function DayPicker() {
  const picker = useStore((s) => s.picker)
  const days = useStore((s) => s.days)
  const close = useStore((s) => s.closePicker)
  const addToDay = useStore((s) => s.addToDay)
  const addToNewDay = useStore((s) => s.addToNewDay)
  const [title, setTitle] = useState('')

  const open = picker !== null

  // Fresh form each time it opens; Esc closes.
  useEffect(() => {
    if (!open) return
    setTitle('')
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, close])

  if (!picker) return null
  const exercise = EXERCISES_BY_ID[picker.exerciseId]
  if (!exercise) return null
  const taken = isTitleTaken(days, title)

  return (
    <div className="overlay" onClick={close}>
      <div
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="picker-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="picker-title">Add to which day?</h2>
        <p className="muted sheet-sub">{exercise.name}</p>

        {days.length > 0 && (
          <ul className="list day-options">
            {days.map((d) => {
              const has = d.items.some((i) => i.exerciseId === exercise.id)
              return (
                <li key={d.id}>
                  <button
                    className="day-option"
                    disabled={has}
                    onClick={() => addToDay(d.id, exercise.id)}
                  >
                    <span className="day-option-text">
                      <strong>{d.title}</strong>
                      <small>
                        {d.items.length} {d.items.length === 1 ? 'exercise' : 'exercises'}
                      </small>
                    </span>
                    <span className="day-option-action">{has ? '✓ Added' : 'Add'}</span>
                  </button>
                </li>
              )
            })}
          </ul>
        )}

        <form
          className="new-day"
          onSubmit={(e) => {
            e.preventDefault()
            if (!taken) addToNewDay(exercise.id, title)
          }}
        >
          <label htmlFor="new-day-title">
            {days.length > 0 ? 'Or create a new day' : 'Create your first day'}
          </label>
          <div className="new-day-row">
            <input
              id="new-day-title"
              value={title}
              maxLength={40}
              placeholder={nextDayTitle(days)}
              autoFocus={days.length === 0}
              aria-invalid={taken}
              aria-describedby={taken ? 'new-day-error' : undefined}
              className={taken ? 'invalid' : ''}
              onChange={(e) => setTitle(e.target.value)}
            />
            <button type="submit" className="primary" disabled={taken}>
              Create &amp; add
            </button>
          </div>
          {taken && (
            <div className="field-error" id="new-day-error">
              You already have a day called that. Pick it above or use another name.
            </div>
          )}
        </form>

        <button className="ghost" onClick={close}>
          Cancel
        </button>
      </div>
    </div>
  )
}
