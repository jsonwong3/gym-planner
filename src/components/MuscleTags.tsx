import type { CSSProperties } from 'react'
import { muscleEntries } from '../data/exercises'
import type { Exercise } from '../data/exercises'
import { MUSCLES, musclesOf } from '../data/muscles'
import type { MuscleId, Target } from '../data/muscles'

/** Every muscle an exercise works with its intensity. Stronger = more opaque. */
export default function MuscleTags({
  exercise,
  highlight,
}: {
  exercise: Exercise
  /** A muscle, or a group (highlights all its parts). */
  highlight?: Target | null
}) {
  const highlighted: readonly MuscleId[] = highlight ? musclesOf(highlight) : []
  return (
    <div className="mtags">
      {muscleEntries(exercise).map(([m, v]) => (
        <span
          key={m}
          className={`mtag ${highlighted.includes(m) ? 'hl' : ''}`}
          style={{ '--i': v } as CSSProperties}
          title={`${MUSCLES[m].label}: ${Math.round(v * 100)}% intensity`}
        >
          {MUSCLES[m].label} {Math.round(v * 100)}%
        </span>
      ))}
    </div>
  )
}
