# MAT-AI-OS UI V2

Fresh UI codebase for MAT-AI-OS, built from zero alongside the existing
[`MAT-AI-OS-ui`](../MAT-AI-OS-ui) app, which stays untouched as a
reference/fallback until this one replaces it.

## Rules

- Same VISION API (`MAT-AI-OS-V2/api`) as the existing UI — no backend changes.
- Visual direction: clean futuristic HUD.
- UX principle: lawn-mower simplicity — simple, obvious, minimal interaction.
- Architecture is not a copy of the old UI's — see `src/*/README.md` for the
  domain/adapters separation used here instead.

## Stack

React 19 + TypeScript + Vite for the renderer, Electron for the desktop shell
(`electron/` — see [docs/ELECTRON_ARCHITECTURE.md](docs/ELECTRON_ARCHITECTURE.md)),
vitest + Testing Library for tests, ESLint (flat config) for linting. pnpm as
package manager.

```bash
pnpm install
pnpm dev          # Vite + Electron together, with HMR
pnpm test
pnpm typecheck    # renderer (src/) + electron (electron/), two separate tsconfigs
pnpm lint
pnpm build        # renderer dist/ + electron dist-electron/main, dist-electron/preload
pnpm dist:electron # package an installer (electron-builder) — not run as part of CI/verification yet
```

## Docs

- [docs/VISION_API_CONTRACT.md](docs/VISION_API_CONTRACT.md) — the backend contract
- [docs/OLD_UI_REFERENCE.md](docs/OLD_UI_REFERENCE.md) — what to reuse/avoid from `MAT-AI-OS-ui`
- [docs/V2_DATA_SURFACE.md](docs/V2_DATA_SURFACE.md) — what V2 can display/control today
- [docs/ELECTRON_ARCHITECTURE.md](docs/ELECTRON_ARCHITECTURE.md) — main/preload/renderer split, IPC trust boundary
