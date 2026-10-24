import { useState } from 'react'
import { exercisesForTarget } from '../data/exercises'
import type { Equipment, Exercise } from '../data/exercises'
import { MUSCLES, TARGETS, groupOf, isGroup, musclesOf } from '../data/muscles'
import type { MuscleId, Target } from '../data/muscles'
import { useStore } from '../store'
import MuscleTags from './MuscleTags'

const EQUIPMENT: Array<Equipment | 'All'> = ['All', 'Bodyweight', 'Dumbbell', 'Barbell', 'Machine']

function ExerciseRow({ exercise, muscle }: { exercise: Exercise; muscle: Target }) {
  const openPicker = useStore((s) => s.openPicker)
  // Titles of the days this exercise is already in (a string, so the selector stays stable).
  const inDays = useStore((s) =>
    s.days
      .filter((d) => d.items.some((i) => i.exerciseId === exercise.id))
      .map((d) => d.title)
      .join(', '),
  )
  return (
    <li className="row">
      <div className="row-main">
        <div className="row-name">{exercise.name}</div>
        <div className="row-meta">
          {exercise.equipment} · {exercise.level}
        </div>
        <MuscleTags exercise={exercise} highlight={muscle} />
        {inDays && <div className="row-in">✓ {inDays}</div>}
      </div>
      <button
        className="add"
        onClick={() => openPicker(exercise.id)}
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
 * Same drill-down as right-clicking the model, for touch screens: a group
 * lists its parts, and a part links back to its whole group.
 */
function Breakdown({ target, onDrill }: { target: Target; onDrill: (part: MuscleId) => void }) {
  if (isGroup(target)) {
    return (
      <div className="chips wrap breakdown" role="group" aria-label="Parts">
        <span className="muted">Parts:</span>
        {musclesOf(target).map((m) => (
          <button key={m} className="chip small" onClick={() => onDrill(m)}>
            {MUSCLES[m].label}
          </button>
        ))}
      </div>
    )
  }
  const group = groupOf(target)
  if (!group) return null
  return (
    <div className="breakdown">
      <button className="text-btn neutral" onClick={() => onDrill(target)}>
        ← All {TARGETS[group].label.toLowerCase()}
      </button>
    </div>
  )
}

export default function ExercisePanel() {
  const selected = useStore((s) => s.selected)
  const drillDown = useStore((s) => s.drillDown)
  const [equipment, setEquipment] = useState<Equipment | 'All'>('All')

  if (!selected) {
    return (
      <div className="empty">
        <div className="empty-icon">☝︎</div>
        <p>Tap a muscle on the model to see exercises that train it.</p>
      </div>
    )
  }

  const { primary, secondary } = exercisesForTarget(selected)
  const filter = (list: Exercise[]) =>
    equipment === 'All' ? list : list.filter((e) => e.equipment === equipment)
  const p = filter(primary)
  const s = filter(secondary)

  return (
    <div className="panel-body">
      <div className="panel-head">
        <h2>{TARGETS[selected].label}</h2>
        <span className="muted">{TARGETS[selected].region}</span>
      </div>
      <Breakdown target={selected} onDrill={drillDown} />

      <div className="chips" role="group" aria-label="Filter by equipment">
        {EQUIPMENT.map((eq) => (
          <button
            key={eq}
            className={`chip ${equipment === eq ? 'active' : ''}`}
            onClick={() => setEquipment(eq)}
          >
            {eq}
          </button>
        ))}
      </div>

      <div className="scroll">
        <Section title="Primary" items={p} muscle={selected} />
        <Section title="Also works this muscle" items={s} muscle={selected} />
        {p.length + s.length === 0 && <p className="muted pad">No exercises match this filter.</p>}
      </div>
    </div>
  )
}
