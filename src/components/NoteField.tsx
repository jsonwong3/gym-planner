import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { NOTE_MAX } from '../store'

/**
 * Free-text note that grows with its text. Edits a draft and saves on blur
 * (or every keystroke with `live`, for forms whose submit button may not take
 * focus; see WeightInput). Esc reverts.
 */
export function NoteField({
  value,
  onChange,
  label,
  placeholder = 'Add a note',
  live = false,
  autoFocus = false,
  onDone,
}: {
  value: string
  onChange: (note: string) => void
  label: string
  placeholder?: string
  live?: boolean
  autoFocus?: boolean
  /** Called after it blurs, e.g. to fold an empty note away again. */
  onDone?: (note: string) => void
}) {
  const [draft, setDraft] = useState(value)
  const ref = useRef<HTMLTextAreaElement>(null)
  const cancelled = useRef(false)
  const editing = useRef(false)
  /** What it was when focused, so Esc can undo live updates too. */
  const atFocus = useRef(value)
  useEffect(() => {
    if (!editing.current) setDraft(value)
  }, [value])

  // Grow to fit (no `field-sizing: content` on Safari/Firefox yet).
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight + 2}px`
  }, [draft])

  const commit = () => {
    editing.current = false
    const next = cancelled.current ? atFocus.current : draft
    cancelled.current = false
    setDraft(next)
    if (next !== value) onChange(next)
    onDone?.(next.trim())
  }

  return (
    <textarea
      ref={ref}
      className="note-field"
      rows={1}
      value={draft}
      maxLength={NOTE_MAX}
      placeholder={placeholder}
      aria-label={label}
      autoFocus={autoFocus}
      onFocus={() => {
        editing.current = true
        atFocus.current = value
      }}
      onChange={(e) => {
        setDraft(e.target.value)
        if (live) onChange(e.target.value)
      }}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          cancelled.current = true
          e.currentTarget.blur()
          // Don't let the dialog's Esc handler close it as well.
          e.stopPropagation()
        }
      }}
    />
  )
}
