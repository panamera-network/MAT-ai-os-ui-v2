# components

Shared presentational building blocks used across screens. No adapter or
fetch calls — data and callbacks come in as props; any adapter call a
component's data depends on lives in a `hooks/` hook instead (see
`useThink.ts` feeding `ActivityPanel`).
