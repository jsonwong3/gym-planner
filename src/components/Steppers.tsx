import { useEffect, useRef, useState } from 'react'
import { useStore } from '../store'
import { WEIGHT_STEP, formatWeight, fromUnit, toUnit } from '../units'

/** A whole-number field with -/+ buttons (sets, reps). Clamping is up to `onChange`. */
export function Stepper({
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

/**
 * Weight per set, in the user's unit (stored in kg). Edits a draft and saves on
 * blur/Enter (or every keystroke with `live`), and never reformats the box while
 * it's being typed in, so "12." on the way to "12.5" survives; Esc reverts. The
 * +/- buttons step a plate pair (WEIGHT_STEP). Blank = no weight.
 */
export function WeightInput({
  kg,
  onChange,
  live = false,
}: {
  kg: number | null
  onChange: (kg: number | null) => void
  /**
   * Report every keystroke too, not just on blur. For forms submitted by a
   * button that may not take focus (Safari doesn't focus clicked buttons, so
   * the box never blurs and the typed weight would be lost).
   */
  live?: boolean
}) {
  const unit = useStore((s) => s.unit)
  const shown = kg === null ? '' : formatWeight(kg, unit)
  const [draft, setDraft] = useState(shown)
  const cancelled = useRef(false)
  const editing = useRef(false)
  /** What it was when focused, so Esc can undo live updates too. */
  const atFocus = useRef(kg)
  // Never overwrite what's being typed: a live update round-trips through kg and would turn "12." into "12".
  useEffect(() => {
    if (!editing.current) setDraft(shown)
  }, [shown])

  const parse = (text: string) => {
    const value = parseFloat(text.replace(',', '.'))
    return Number.isFinite(value) && value > 0 ? fromUnit(value, unit) : null
  }
  const commit = () => {
    editing.current = false
    if (cancelled.current) {
      cancelled.current = false
      if (live) onChange(atFocus.current)
      setDraft(atFocus.current === null ? '' : formatWeight(atFocus.current, unit))
      return
    }
    const next = parse(draft)
    onChange(next)
    setDraft(next === null ? '' : formatWeight(next, unit))
  }
  const step = (dir: 1 | -1) => {
    const size = WEIGHT_STEP[unit]
    const current = kg === null ? 0 : toUnit(kg, unit)
    // Snap to the step grid first, so 61.2 + 2.5 lands on 62.5 rather than 63.7.
    const next = dir > 0 ? (Math.floor(current / size + 1e-6) + 1) * size : (Math.ceil(current / size - 1e-6) - 1) * size
    const nextKg = next > 0 ? fromUnit(next, unit) : null
    onChange(nextKg)
    // Set the box directly too: if it still has focus (Safari doesn't move it to clicked buttons) it won't resync.
    setDraft(nextKg === null ? '' : formatWeight(nextKg, unit))
  }

  return (
    <label className="stepper weight">
      <span>Weight</span>
      <div>
        <button type="button" onClick={() => step(-1)} aria-label={`Decrease weight by ${WEIGHT_STEP[unit]} ${unit}`}>
          −
        </button>
        <input
          inputMode="decimal"
          value={draft}
          placeholder="–"
          aria-label={`Weight in ${unit}`}
          onFocus={() => {
            editing.current = true
            atFocus.current = kg
          }}
          onChange={(e) => {
            const text = e.target.value.replace(/[^\d.,]/g, '')
            setDraft(text)
            if (live) onChange(parse(text))
          }}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Escape') cancelled.current = true
            if (e.key === 'Enter' || e.key === 'Escape') e.currentTarget.blur()
          }}
        />
        <button type="button" onClick={() => step(1)} aria-label={`Increase weight by ${WEIGHT_STEP[unit]} ${unit}`}>
          +
        </button>
      </div>
      <span className="unit">{unit}</span>
    </label>
  )
}
