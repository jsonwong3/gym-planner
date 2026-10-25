import type { CSSProperties } from 'react'
import { muscleEntries } from '../data/exercises'
import type { Exercise } from '../data/exercises'
import { MUSCLES, musclesOf } from '../data/muscles'
import type { MuscleId, Target } from '../data/muscles'

/** Every muscle an exercise works with its share of the work. Bigger share = more opaque. */
export default function MuscleTags({
  exercise,
  highlight,
}: {
  exercise: Exercise
  /** A muscle, or a group (highlights all its parts). */
  highlight?: Target | null
}) {
  const highlighted: readonly MuscleId[] = highlight ? musclesOf(highlight) : []
  const entries = muscleEntries(exercise)
  // Shares add up to 1, so scale opacity to the biggest one or most tags would be faint.
  const top = entries[0]?.[1] ?? 1
  return (
    <div className="mtags">
      {entries.map(([m, v]) => (
        <span
          key={m}
          className={`mtag ${highlighted.includes(m) ? 'hl' : ''}`}
          style={{ '--i': v / top } as CSSProperties}
          title={`${MUSCLES[m].label}: ${Math.round(v * 100)}% of the work`}
        >
          {MUSCLES[m].label} {Math.round(v * 100)}%
        </span>
      ))}
    </div>
  )
}
