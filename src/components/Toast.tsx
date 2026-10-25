import { useEffect } from 'react'
import { useStore } from '../store'

export default function Toast() {
  const toast = useStore((s) => s.toast)
  const dismiss = useStore((s) => s.dismissToast)
  const setTab = useStore((s) => s.setTab)

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(dismiss, 3500)
    return () => clearTimeout(t)
  }, [toast, dismiss])

  if (!toast) return null
  return (
    <div className="toast" role="status">
      <span>{toast.message}</span>
      {toast.viewPlan && (
        <button
          onClick={() => {
            setTab('plan')
            dismiss()
          }}
        >
          View plan
        </button>
      )}
    </div>
  )
}
