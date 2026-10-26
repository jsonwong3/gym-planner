import { useEffect } from 'react'
import { EXERCISES_BY_ID } from '../data/exercises'
import { TARGETS, visibleTargets } from '../data/muscles'
import {
  ALL_DAYS,
  formatSets,
  heatColor,
  heatGradientCss,
  levelOf,
  rankedMuscles,
  untrainedMuscles,
} from '../heat'
import { useHeat } from '../useHeat'
import { splitGroups, useStore } from '../store'

export default function HeatmapPanel() {
  const days = useStore((s) => s.days)
  const selected = useStore((s) => s.selected)
  const select = useStore((s) => s.select)
  const setScope = useStore((s) => s.setHeatScope)
  const setTab = useStore((s) => s.setTab)
  const expanded = useStore(splitGroups)
  const heat = useHeat()
  const palette = useStore((s) => s.heatPalette)

  // Tapping a muscle on the model should bring its row into view.
  useEffect(() => {
    if (selected) document.getElementById(`heat-${selected}`)?.scrollIntoView({ block: 'nearest' })
  }, [selected])

  if (days.length === 0) {
    return (
      <div className="empty">
        <div className="empty-icon">◐</div>
        <p>Add exercises to a day and the muscles they work will light up here.</p>
        <button className="primary" onClick={() => setTab('exercises')}>
          Browse exercises
        </button>
      </div>
    )
  }

  const shown = visibleTargets(expanded)
  const ranked = rankedMuscles(heat, shown)
  const untrained = untrainedMuscles(heat, shown)
  const dayIndex = days.findIndex((d) => d.id === heat.scope)
  const scopeLabel = dayIndex >= 0 ? days[dayIndex].title || `Day ${dayIndex + 1}` : 'any active day'

  return (
    <div className="panel-body">
      <div className="panel-head">
        <h2>Heatmap</h2>
        <span className="muted">
          {heat.exerciseCount} {heat.exerciseCount === 1 ? 'exercise' : 'exercises'} · {heat.setCount} sets
        </span>
      </div>

      {days.length > 1 && (
        <div className="chips" role="group" aria-label="Heatmap scope">
          <button
            className={`chip ${heat.scope === ALL_DAYS ? 'active' : ''}`}
            onClick={() => setScope(ALL_DAYS)}
          >
            All days
          </button>
          {days.map((d, i) => (
            <button
              key={d.id}
              className={`chip ${heat.scope === d.id ? 'active' : ''} ${d.active ? '' : 'draft'}`}
              onClick={() => setScope(d.id)}
              title={d.active ? undefined : 'Draft: not counted in All days'}
            >
              {d.title || `Day ${i + 1}`}
            </button>
          ))}
        </div>
      )}

      <div className="scroll">
        {heat.exerciseCount === 0 ? (
          <p className="muted pad">No exercises in {scopeLabel} yet.</p>
        ) : (
          <>
            <div className="heat-legend">
              <div className="heat-gradient" style={{ background: heatGradientCss(palette) }} />
              <div className="heat-legend-labels">
                <span>Light</span>
                <span>{heat.fullAt}+ sets</span>
              </div>
            </div>
            <p className="muted pad heat-note">
              Sets are weighted by how hard each exercise hits the muscle, so 4 bench sets count as 4 for chest but
              only 2 for triceps. Tap a muscle for the breakdown.
            </p>

            <ul className="list">
              {ranked.map((m) => {
                const open = selected === m
                const fill = heat.heat[m]
                return (
                  <li key={m} id={`heat-${m}`}>
                    <button
                      className={`heat-row ${open ? 'selected' : ''}`}
                      aria-expanded={open}
                      onClick={() => select(open ? null : m)}
                    >
                      <span className="heat-name">{TARGETS[m].label}</span>
                      <span className="heat-bar">
                        <span
                          className="heat-fill"
                          style={{ width: `${Math.max(fill, 0.04) * 100}%`, background: heatColor(levelOf(heat, m), palette) }}
                        />
                      </span>
                      <span className="heat-val">{formatSets(heat.load[m])}</span>
                    </button>
                    {open && (
                      <div className="heat-detail">
                        <ul className="list">
                          {heat.contributions[m].map((c) => (
                            <li key={`${c.dayId}-${c.exerciseId}`}>
                              <span>
                                {EXERCISES_BY_ID[c.exerciseId]?.name}
                                <small>
                                  {c.sets} sets × {Math.round(c.intensity * 100)}%
                                  {heat.scope === ALL_DAYS && days.length > 1 ? ` · ${c.dayTitle}` : ''}
                                </small>
                              </span>
                              <span>{formatSets(c.effective)}</span>
                            </li>
                          ))}
                        </ul>
                        <button className="text-btn neutral" onClick={() => setTab('exercises')}>
                          More {TARGETS[m].label.toLowerCase()} exercises →
                        </button>
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>

            {untrained.length > 0 && (
              <section>
                <h3 className="section-title">
                  Not trained <span>{untrained.length}</span>
                </h3>
                <div className="chips wrap">
                  {untrained.map((m) => (
                    <span key={m} className="chip small">
                      {TARGETS[m].label}
                    </span>
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </div>
  )
}
