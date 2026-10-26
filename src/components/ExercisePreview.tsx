import { useEffect, useState } from 'react'
import { EXERCISES_BY_ID } from '../data/exercises'
import { useStore } from '../store'

/**
 * How long the preview stays after the mouse leaves a row (ms), so moving
 * down the list swaps the GIF instead of closing and reopening the box.
 */
const LINGER_MS = 150

/** Downloaded from the exercise dataset by `npm run gifs` (or, on desktop, by electron/main.js). */
const gifUrl = (exerciseId: string) => `/exercise-gifs/${exerciseId}.gif`

/**
 * The hovered exercise's GIF, in a fixed spot against the sidebar's left edge
 * (the model view's top-right corner, clear of its other overlays). Rendered
 * inside the sidebar. Mouse only (rows set it on hover), and hidden by CSS
 * when the sidebar is stacked under the model.
 */
export default function ExercisePreview() {
  const hovered = useStore((s) => s.previewExerciseId)
  const [shown, setShown] = useState<string | null>(null)
  // An exercise without a GIF (e.g. a hand-written row) shows nothing rather than a broken image.
  const [missing, setMissing] = useState<string | null>(null)

  useEffect(() => {
    if (hovered) {
      setShown(hovered)
      return
    }
    const timer = setTimeout(() => setShown(null), LINGER_MS)
    return () => clearTimeout(timer)
  }, [hovered])

  if (!shown || missing === shown) return null
  return (
    <div className="exercise-preview" aria-hidden>
      <img key={shown} src={gifUrl(shown)} width={180} height={180} alt="" onError={() => setMissing(shown)} />
      <div className="exercise-preview-name">{EXERCISES_BY_ID[shown]?.name}</div>
      {/* Required by the GIFs' licence (the exercises-dataset repo's NOTICE.md). */}
      <div className="exercise-preview-credit">© Gym visual — https://gymvisual.com/</div>
    </div>
  )
}
