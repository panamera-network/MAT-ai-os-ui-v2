import type { ReactNode } from 'react'
import { MatPresenceView } from './canvas-views/MatPresenceView'
import { BrainViewCanvas } from './canvas-views/BrainViewCanvas'
import './ActiveCanvas.css'

/**
 * Every view `ActiveCanvas` can mount — one id per file in `canvas-views/`.
 * Add to this union, and to `CANVAS_VIEWS` below, when a new view (Skill
 * View, ...) gets its own file there. Nothing else here changes.
 */
export type ActiveCanvasView = 'presence' | 'brain'

const CANVAS_VIEWS: Record<ActiveCanvasView, () => ReactNode> = {
  presence: () => <MatPresenceView />,
  brain: () => <BrainViewCanvas />,
}

interface ActiveCanvasProps {
  view?: ActiveCanvasView
}

/**
 * The one mounting point for the HUD's center-stage visual. Owns only
 * *which* view is mounted here — never what that view renders or what data
 * it needs (each view in `canvas-views/` is self-contained). No navigation
 * exists yet to change `view` at runtime; the prop and its default are the
 * seam that future navigation will drive, not a feature by themselves.
 */
export function ActiveCanvas({ view = 'presence' }: ActiveCanvasProps) {
  return <div className="active-canvas">{CANVAS_VIEWS[view]()}</div>
}
