import type { ReactNode } from 'react'
import { MatPresenceView } from './canvas-views/MatPresenceView'
import { BrainViewCanvas } from './canvas-views/BrainViewCanvas'
import { IAmMatCanvas } from './canvas-views/IAmMatCanvas'
import type { UseHealthResult } from '../hooks/useHealth'
import './ActiveCanvas.css'

/**
 * Every view `ActiveCanvas` can mount — one id per file in `canvas-views/`.
 * Add to this union, and to `CANVAS_VIEWS` below, when a new view (Skill
 * View, ...) gets its own file there. Nothing else here changes.
 */
export type ActiveCanvasView = 'presence' | 'brain' | 'iammat'

/** `health` is only ever consumed by the `iammat` view today (identity/
 * faculty inspection needs `HomeScreen`'s already-polled `useHealth()`
 * result, never a second poll of the same endpoint) — `presence`/`brain`
 * simply ignore the argument, which a zero-parameter function is already
 * assignable to. */
const CANVAS_VIEWS: Record<ActiveCanvasView, (health: UseHealthResult) => ReactNode> = {
  presence: () => <MatPresenceView />,
  brain: () => <BrainViewCanvas />,
  iammat: (health) => <IAmMatCanvas healthResource={health} />,
}

interface ActiveCanvasProps {
  view?: ActiveCanvasView
  health: UseHealthResult
}

/**
 * The one mounting point for the HUD's center-stage visual. Owns only
 * *which* view is mounted here — never what that view renders or what data
 * it needs (each view in `canvas-views/` is self-contained, `iammat`'s own
 * `health` prop aside — see above). No navigation exists yet to change
 * `view` at runtime; the prop and its default are the seam that future
 * navigation will drive, not a feature by themselves.
 */
export function ActiveCanvas({ view = 'presence', health }: ActiveCanvasProps) {
  return <div className="active-canvas">{CANVAS_VIEWS[view](health)}</div>
}
