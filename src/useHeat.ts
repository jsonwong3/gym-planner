import { useMemo } from 'react'
import { computeHeat } from './heat'
import { useStore } from './store'

/**
 * Heat for what the model is showing: the day highlighted on the plan tab, else
 * the heatmap's scope. Recomputes only when the plan or scope changes.
 */
export function useHeat() {
  const days = useStore((s) => s.days)
  const scope = useStore((s) => (s.tab === 'plan' && s.planFocus ? s.planFocus : s.heatScope))
  return useMemo(() => computeHeat(days, scope), [days, scope])
}
