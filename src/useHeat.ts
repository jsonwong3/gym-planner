import { useMemo } from 'react'
import { computeHeat } from './heat'
import { useStore } from './store'

/** Heat for the plan under the currently selected scope. Recomputes only when the plan or scope changes. */
export function useHeat() {
  const days = useStore((s) => s.days)
  const scope = useStore((s) => s.heatScope)
  return useMemo(() => computeHeat(days, scope), [days, scope])
}
