import { useEffect } from 'react'
import { useStore } from '../store'
import { UNITS } from '../units'
import type { Unit } from '../units'
import { Stepper } from './Steppers'

const UNIT_LABELS: Record<Unit, string> = { kg: 'Kilograms (kg)', lb: 'Pounds (lb)' }

/** Settings dialog, opened from the cog in the top bar. Saved with the plan. */
export default function Settings() {
  const open = useStore((s) => s.settingsOpen)
  const setOpen = useStore((s) => s.setSettingsOpen)
  const unit = useStore((s) => s.unit)
  const setUnit = useStore((s) => s.setUnit)
  const defaultSets = useStore((s) => s.defaultSets)
  const defaultReps = useStore((s) => s.defaultReps)
  const setDefaults = useStore((s) => s.setDefaults)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, setOpen])

  if (!open) return null
  return (
    <div className="overlay" onClick={() => setOpen(false)}>
      <div
        className="sheet settings"
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="settings-head">
          <h2 id="settings-title">Settings</h2>
          <button className="icon-btn" onClick={() => setOpen(false)} aria-label="Close settings">
            ✕
          </button>
        </div>

        <section className="setting" aria-labelledby="setting-unit">
          <h3 id="setting-unit">Weight unit</h3>
          <div className="tag-seg" role="radiogroup" aria-label="Weight unit">
            {UNITS.map((u) => (
              <button
                key={u}
                role="radio"
                aria-checked={unit === u}
                className={unit === u ? 'active' : ''}
                onClick={() => setUnit(u)}
                title={UNIT_LABELS[u]}
              >
                {u}
              </button>
            ))}
          </div>
          <p className="muted setting-help">
            Weights in your plan are shown and entered in {UNIT_LABELS[unit].toLowerCase()}. Switching converts them.
          </p>
        </section>

        <section className="setting" aria-labelledby="setting-defaults">
          <h3 id="setting-defaults">When adding an exercise</h3>
          <div className="plan-controls">
            <Stepper label="Sets" value={defaultSets} onChange={(n) => setDefaults({ defaultSets: n })} />
            <Stepper label="Reps" value={defaultReps} onChange={(n) => setDefaults({ defaultReps: n })} />
          </div>
          <p className="muted setting-help">What the add dialog starts at. Weight always starts blank.</p>
        </section>
      </div>
    </div>
  )
}
