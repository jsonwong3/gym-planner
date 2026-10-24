import BodyViewer from './components/BodyViewer'
import DayPicker from './components/DayPicker'
import ExercisePanel from './components/ExercisePanel'
import HeatmapPanel from './components/HeatmapPanel'
import PlanPanel from './components/PlanPanel'
import Toast from './components/Toast'
import { useStore } from './store'
import type { Tab } from './store'

const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'exercises', label: 'Exercises' },
  { id: 'plan', label: 'My plan' },
  { id: 'heatmap', label: 'Heatmap' },
]

export default function App() {
  const tab = useStore((s) => s.tab)
  const setTab = useStore((s) => s.setTab)
  const planCount = useStore((s) => s.days.reduce((n, d) => n + d.items.length, 0))

  return (
    <div className="app">
      <header className="topbar">
        <span className="logo">◐</span>
        <h1>Muscle Explorer</h1>
      </header>

      <main className="layout">
        <BodyViewer />

        <aside className="sidebar">
          <div className="tabs" role="tablist">
            {TABS.map((t) => (
              <button
                key={t.id}
                role="tab"
                aria-selected={tab === t.id}
                className={tab === t.id ? 'active' : ''}
                onClick={() => setTab(t.id)}
              >
                {t.label}
                {t.id === 'plan' && planCount > 0 && <span className="badge">{planCount}</span>}
              </button>
            ))}
          </div>
          {tab === 'exercises' ? <ExercisePanel /> : tab === 'plan' ? <PlanPanel /> : <HeatmapPanel />}
        </aside>
      </main>

      <DayPicker />
      <Toast />
    </div>
  )
}
