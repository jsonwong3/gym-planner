import type { CSSProperties, KeyboardEvent, PointerEvent } from 'react'
import BodyViewer from './components/BodyViewer'
import DayPicker from './components/DayPicker'
import ExercisePanel from './components/ExercisePanel'
import HeatmapPanel from './components/HeatmapPanel'
import PlanPanel from './components/PlanPanel'
import Toast from './components/Toast'
import { SIDEBAR_DEFAULT, SIDEBAR_MAX, SIDEBAR_MIN, useStore } from './store'
import type { Tab } from './store'

const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'exercises', label: 'Exercises' },
  { id: 'plan', label: 'My plan' },
  { id: 'heatmap', label: 'Heatmap' },
]

/** Arrow-key step when resizing from the keyboard (px). */
const KEY_STEP = 24

/**
 * Drag handle on the sidebar's left edge (desktop only; hidden on phones by
 * CSS). Double-click resets the width.
 */
function ResizeHandle() {
  const width = useStore((s) => s.sidebarWidth)
  const setWidth = useStore((s) => s.setSidebarWidth)

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return
    e.preventDefault() // no text selection while dragging
    const handle = e.currentTarget
    handle.setPointerCapture(e.pointerId)
    // The sidebar's right edge stays put, so its width is that edge minus the pointer.
    const right = handle.parentElement!.getBoundingClientRect().right
    const move = (ev: globalThis.PointerEvent) => setWidth(right - ev.clientX)
    const up = () => {
      handle.removeEventListener('pointermove', move)
      handle.removeEventListener('pointerup', up)
      handle.removeEventListener('pointercancel', up)
    }
    handle.addEventListener('pointermove', move)
    handle.addEventListener('pointerup', up)
    handle.addEventListener('pointercancel', up)
  }

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const delta = e.key === 'ArrowLeft' ? KEY_STEP : e.key === 'ArrowRight' ? -KEY_STEP : 0
    if (!delta) return
    e.preventDefault()
    setWidth(width + delta)
  }

  return (
    <div
      className="sidebar-resize"
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize sidebar"
      aria-valuenow={width}
      aria-valuemin={SIDEBAR_MIN}
      aria-valuemax={SIDEBAR_MAX}
      tabIndex={0}
      title="Drag to resize · double-click to reset"
      onPointerDown={onPointerDown}
      onDoubleClick={() => setWidth(SIDEBAR_DEFAULT)}
      onKeyDown={onKeyDown}
    />
  )
}

export default function App() {
  const tab = useStore((s) => s.tab)
  const setTab = useStore((s) => s.setTab)
  const collapsed = useStore((s) => s.sidebarCollapsed)
  const width = useStore((s) => s.sidebarWidth)
  const toggleSidebar = useStore((s) => s.toggleSidebar)
  const planCount = useStore((s) => s.days.reduce((n, d) => n + d.items.length, 0))

  return (
    <div className="app">
      <header className="topbar">
        <span className="logo">◐</span>
        <h1>Muscle Explorer</h1>
      </header>

      <main
        className={`layout ${collapsed ? 'sidebar-collapsed' : ''}`}
        style={{ '--sidebar-w': `${width}px` } as CSSProperties}
      >
        <BodyViewer />

        <aside className="sidebar">
          {!collapsed && <ResizeHandle />}
          <div className="tabs" role="tablist">
            {TABS.map((t) => (
              <button
                key={t.id}
                role="tab"
                aria-selected={!collapsed && tab === t.id}
                className={!collapsed && tab === t.id ? 'active' : ''}
                onClick={() => setTab(t.id)}
              >
                {t.label}
                {t.id === 'plan' && planCount > 0 && <span className="badge">{planCount}</span>}
              </button>
            ))}
            <button
              className="sidebar-toggle"
              onClick={toggleSidebar}
              aria-expanded={!collapsed}
              aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden>
                <path d="M6 3l5 5-5 5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
          {!collapsed && (tab === 'exercises' ? <ExercisePanel /> : tab === 'plan' ? <PlanPanel /> : <HeatmapPanel />)}
        </aside>
      </main>

      <DayPicker />
      <Toast />
    </div>
  )
}
