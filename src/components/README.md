# components

Shared presentational building blocks used across screens. No adapter or
fetch calls — data and callbacks come in as props; any adapter call a
component's data depends on lives in a `hooks/` hook instead (see
`useThink.ts` feeding `ActivityPanel`).

`ActiveCanvas.tsx` is the exception to "no data of its own" in one specific
way: it owns *which* `canvas-views/` view is mounted, though never that
view's own data — see `canvas-views/README.md`.
