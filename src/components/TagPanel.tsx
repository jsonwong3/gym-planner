import { useEffect, useMemo } from 'react'
import { MUSCLES, MUSCLE_IDS } from '../data/muscles'
import type { MuscleId, Region } from '../data/muscles'
import { codeOf, currentIdMap, swatch } from '../idMap'
import { useStore } from '../store'
import type { TagTool } from '../store'

const TOOLS: Array<{ id: TagTool; label: string; title: string }> = [
  { id: 'lasso', label: 'Lasso', title: 'Draw round an area to tag everything visible inside it' },
  { id: 'fill', label: 'Fill', title: 'Tap a colour patch to tag it' },
  { id: 'erase', label: 'Erase', title: 'Draw round an area to untag it' },
]

/** Muscles grouped by region, in MUSCLE_IDS order, for the picker's optgroups. */
const BY_REGION = MUSCLE_IDS.reduce<Array<{ region: Region; muscles: MuscleId[] }>>((acc, id) => {
  const region = MUSCLES[id].region
  const last = acc[acc.length - 1]
  if (last?.region === region) last.muscles.push(id)
  else acc.push({ region, muscles: [id] })
  return acc
}, [])

/**
 * Tools for painting the GLB's muscle ID map: pick a muscle, tap its colour
 * patches on the model. The result is downloaded as a PNG and dropped into
 * `public/models/` so every device gets it.
 */
export default function TagPanel() {
  const tagMuscle = useStore((s) => s.tagMuscle)
  const tagTool = useStore((s) => s.tagTool)
  const tagTolerance = useStore((s) => s.tagTolerance)
  const revision = useStore((s) => s.idMapRevision)
  const setTagMuscle = useStore((s) => s.setTagMuscle)
  const setTagTool = useStore((s) => s.setTagTool)
  const setTagTolerance = useStore((s) => s.setTagTolerance)
  const bumpIdMap = useStore((s) => s.bumpIdMap)
  const idMap = currentIdMap()

  // The map mutates in place; `revision` is what says it changed.
  const counts = useMemo(() => idMap?.counts() ?? null, [idMap, revision])
  const tagged = counts ? MUSCLE_IDS.filter((m) => counts[codeOf(m)] > 0).length : 0
  const [r, g, b] = swatch(codeOf(tagMuscle))

  const run = (action: () => void) => {
    action()
    bumpIdMap()
  }

  // Ctrl/Cmd+Z undoes the last tag edit while tag mode is open.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.shiftKey || e.key.toLowerCase() !== 'z') return
      const map = currentIdMap()
      if (!map?.canUndo) return
      e.preventDefault()
      map.undo()
      bumpIdMap()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [bumpIdMap])

  const download = async () => {
    if (!idMap) return
    const url = URL.createObjectURL(await idMap.toPng())
    const a = document.createElement('a')
    a.href = url
    a.download = 'body-ids.png'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="tag-panel">
      <div className="tag-head">
        <strong>Tag muscles</strong>
        <span>
          {tagged} / {MUSCLE_IDS.length} tagged
        </span>
      </div>

      <div className="tag-row">
        <span className="tag-swatch" style={{ background: `rgb(${r}, ${g}, ${b})` }} />
        <select value={tagMuscle} onChange={(e) => setTagMuscle(e.target.value as MuscleId)} aria-label="Muscle to tag">
          {BY_REGION.map(({ region, muscles }) => (
            <optgroup key={region} label={region}>
              {muscles.map((m) => (
                <option key={m} value={m}>
                  {counts && counts[codeOf(m)] > 0 ? '✓ ' : ''}
                  {MUSCLES[m].label}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>

      <div className="tag-row">
        <div className="tag-seg" role="group" aria-label="Tool">
          {TOOLS.map((tool) => (
            <button
              key={tool.id}
              className={tagTool === tool.id ? 'active' : ''}
              onClick={() => setTagTool(tool.id)}
              aria-pressed={tagTool === tool.id}
              title={tool.title}
            >
              {tool.label}
            </button>
          ))}
        </div>
        {tagTool === 'fill' && (
          <label className="tag-tolerance" title="How different a colour can be and still count as the same patch">
            Tolerance
            <input
              type="range"
              min={4}
              max={80}
              value={tagTolerance}
              onChange={(e) => setTagTolerance(Number(e.target.value))}
            />
            <span>{tagTolerance}</span>
          </label>
        )}
      </div>

      <div className="tag-row">
        <button className="tag-btn" disabled={!idMap?.canUndo} title="Ctrl+Z" onClick={() => idMap && run(() => idMap.undo())}>
          Undo
        </button>
        <button
          className="tag-btn"
          disabled={!tagged}
          onClick={() => idMap && confirm('Remove every tag?') && run(() => idMap.clear())}
        >
          Clear
        </button>
        <button className="tag-btn primary" disabled={!idMap} onClick={download}>
          Download PNG
        </button>
      </div>

      <p className="tag-help">
        Lasso tags only what's visible inside the loop. Right-drag rotates, Ctrl-drag moves, scroll zooms (two fingers on
        touch). Work is kept in this browser; to ship it, save the PNG as <code>public/models/body-ids.png</code>.
      </p>
    </div>
  )
}
