import { EXERCISES_BY_ID } from '../data/exercises'
import { useStore } from '../store'
import type { Day, PlanItem } from '../store'
import { formatWeek, nextMark, shiftWeek, tally, weekOf } from '../tracking'
import type { SetMark, Tally, WeekLog } from '../tracking'
import { formatWeight } from '../units'

/**
 * Weekly tracker: for each active day, tap each planned set to mark it hit or
 * missed. A first-pass template (see src/tracking.ts).
 */

const MARK_LABEL: Record<'hit' | 'miss' | 'none', string> = { hit: 'hit', miss: 'missed', none: 'not logged' }

function Progress({ t }: { t: Tally }) {
  const pct = (n: number) => `${t.planned ? (n / t.planned) * 100 : 0}%`
  return (
    <div className="track-progress" aria-hidden>
      <span className="hit" style={{ width: pct(t.hit) }} />
      <span className="miss" style={{ width: pct(t.missed) }} />
    </div>
  )
}

const summary = (t: Tally) => `${t.hit}/${t.planned} hit${t.missed ? ` · ${t.missed} missed` : ''}`

function TrackRow({ day, item }: { day: Day; item: PlanItem }) {
  const exercise = EXERCISES_BY_ID[item.exerciseId]
  const unit = useStore((s) => s.unit)
  const marks = useStore((s) => s.log[s.trackWeek]?.[day.id]?.[item.exerciseId])
  const markSet = useStore((s) => s.markSet)
  const markSets = useStore((s) => s.markSets)
  if (!exercise) return null
  const markAt = (i: number): SetMark => marks?.[i] ?? null
  const allHit = Array.from({ length: item.sets }, (_, i) => markAt(i)).every((m) => m === 'hit')

  return (
    <li className="track-row">
      <div className="track-row-head">
        <div className="row-name">{exercise.name}</div>
        <span className="muted">
          {item.sets} × {item.reps}
          {item.weight !== null && ` @ ${formatWeight(item.weight, unit)} ${unit}`}
        </span>
      </div>
      {item.note && <p className="track-note muted">{item.note}</p>}
      <div className="track-sets" role="group" aria-label={`${exercise.name} sets`}>
        {Array.from({ length: item.sets }, (_, i) => {
          const mark = markAt(i)
          return (
            <button
              key={i}
              className={`set-pill ${mark ?? ''}`}
              onClick={() => markSet(day.id, item.exerciseId, i, nextMark(mark))}
              aria-label={`Set ${i + 1}: ${MARK_LABEL[mark ?? 'none']}. Tap to change`}
              title="Tap: hit → missed → clear"
            >
              {mark === 'hit' ? '✓' : mark === 'miss' ? '✗' : i + 1}
            </button>
          )
        })}
        <button
          className="text-btn neutral"
          onClick={() => markSets(day.id, [item.exerciseId], allHit ? null : 'hit')}
        >
          {allHit ? 'Clear' : 'All hit'}
        </button>
      </div>
    </li>
  )
}

function TrackDay({ day, log }: { day: Day; log: WeekLog | undefined }) {
  const markSets = useStore((s) => s.markSets)
  const t = tally([day], log)
  const done = t.planned > 0 && t.hit === t.planned
  return (
    <section className={`day track-day ${done ? 'done' : ''}`}>
      <header className="track-day-head">
        <h3>{day.title}</h3>
        <span className="muted">{summary(t)}</span>
        {day.items.length > 0 && (
          <button
            className="text-btn neutral"
            onClick={() =>
              markSets(
                day.id,
                day.items.map((i) => i.exerciseId),
                done ? null : 'hit',
              )
            }
          >
            {done ? 'Clear day' : 'All hit'}
          </button>
        )}
      </header>
      <Progress t={t} />
      {day.note && <p className="track-note muted day-sub">{day.note}</p>}
      {day.items.length === 0 ? (
        <p className="muted day-empty">No exercises on this day.</p>
      ) : (
        <ul className="list">
          {day.items.map((item) => (
            <TrackRow key={item.exerciseId} day={day} item={item} />
          ))}
        </ul>
      )}
    </section>
  )
}

export default function TrackPanel() {
  const days = useStore((s) => s.days)
  const week = useStore((s) => s.trackWeek)
  const setWeek = useStore((s) => s.setTrackWeek)
  const log = useStore((s) => s.log[s.trackWeek])
  const setTab = useStore((s) => s.setTab)
  const thisWeek = weekOf()
  const active = days.filter((d) => d.active)

  if (active.length === 0) {
    return (
      <div className="empty">
        <div className="empty-icon">✓</div>
        <p>Nothing to track yet. Add exercises to a day (and leave it ticked Active) to track it here each week.</p>
        <button className="secondary" onClick={() => setTab('plan')}>
          Go to my plan
        </button>
      </div>
    )
  }

  const t = tally(active, log)

  return (
    <div className="panel-body">
      <div className="track-week">
        <button className="icon-btn" onClick={() => setWeek(shiftWeek(week, -1))} aria-label="Previous week">
          ‹
        </button>
        <div className="track-week-label">
          <strong>{formatWeek(week)}</strong>
          {week === thisWeek ? (
            <span className="muted">This week</span>
          ) : (
            <button className="text-btn neutral" onClick={() => setWeek(thisWeek)}>
              Back to this week
            </button>
          )}
        </div>
        <button className="icon-btn" onClick={() => setWeek(shiftWeek(week, 1))} aria-label="Next week">
          ›
        </button>
      </div>

      <div className="track-summary">
        <span>
          <strong>{t.planned ? Math.round((t.hit / t.planned) * 100) : 0}%</strong> of planned sets hit
        </span>
        <span className="muted">{summary(t)}</span>
        <Progress t={t} />
      </div>

      <div className="scroll">
        <p className="muted pad">Tap a set once when you hit the planned reps, twice if you missed them.</p>
        {active.map((d) => (
          <TrackDay key={d.id} day={d} log={log} />
        ))}
      </div>
    </div>
  )
}
