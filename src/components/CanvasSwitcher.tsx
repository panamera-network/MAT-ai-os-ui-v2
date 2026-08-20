import type { ActiveCanvasView } from './ActiveCanvas'
import './CanvasSwitcher.css'

const OPTIONS: Array<{ id: ActiveCanvasView; label: string }> = [
  { id: 'presence', label: 'Presence' },
  { id: 'brain', label: 'Brain View' },
]

interface CanvasSwitcherProps {
  view: ActiveCanvasView
  onChange: (view: ActiveCanvasView) => void
}

/**
 * Temporary header-only control for switching `ActiveCanvas`'s mounted view
 * while there's no real navigation system yet. Purely a controlled input —
 * the view state itself lives in `HomeScreen`, same place `ActiveCanvas`'s
 * `view` prop already came from.
 */
export function CanvasSwitcher({ view, onChange }: CanvasSwitcherProps) {
  return (
    <div className="canvas-switcher" role="tablist" aria-label="Active Canvas view">
      {OPTIONS.map((option) => (
        <button
          key={option.id}
          type="button"
          role="tab"
          aria-selected={view === option.id}
          className={`canvas-switcher__button${view === option.id ? ' is-active' : ''}`}
          onClick={() => onChange(option.id)}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}
