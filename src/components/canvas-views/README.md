# canvas-views

Each file here is one thing `ActiveCanvas` can mount in the HUD's center
stage — a self-contained mini-screen that owns whatever data/hooks it needs
(see `MatPresenceView.tsx`). `ActiveCanvas` itself only knows the mapping
from a view id to one of these; it never reaches into a view's own data.

Adding a new view (Brain View, Skill View, ...): add one file here following
`MatPresenceView.tsx`'s shape, then register it in `ActiveCanvas.tsx`'s
`CANVAS_VIEWS` map and add its id to the `ActiveCanvasView` union. Nothing
else in `ActiveCanvas` changes.
