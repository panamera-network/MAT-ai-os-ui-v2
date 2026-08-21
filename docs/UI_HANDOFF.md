# UI Handoff — functional baseline for visual redesign

Where the wiring pass landed. Written for whoever (Codex) redesigns this
visually next — the point of this document is "what's real, what's stubbed,
what's off-limits, and where things live," not a feature list.

## Layer structure (`AppShell.tsx`)

Three stacked layers inside `.hud-shell`, siblings — not nested:

1. **`ChamberBackground`** — the wireframe chamber SVG. `z-index: -1`,
   `position: absolute; inset: 0`. Explicitly commented **LOCKED** in its own
   source file ("approved after several rounds of visual tuning... treat any
   further restyling here as a deliberate, explicit request"). Purely
   decorative, `aria-hidden`, no data.
2. **`.hud-shell__canvas-layer`** (`z-index: 1`) — renders `<ActiveCanvas>`,
   full-bleed.
3. **`<GlassHud>`** (`z-index: 2`) — the overlay. `position: absolute; inset:
   0; pointer-events: none` on the grid itself; each zone re-enables
   `pointer-events: auto`. Overlays Active Canvas, never contains it.

## HUD zones (`GlassHud.tsx`, a 3-row × 3-col CSS grid)

| Zone | Component | Content |
|---|---|---|
| Header (row 1, full width) | `TopBar` + `HudStatus` + `CanvasSwitcher` | brand mark, global MAT identity/health, view switcher |
| Left (row 2, col 1) | `HudLeftPanel` | Agents / Loops / LLM / Governance / MCP snapshot |
| **Center (row 2, col 2)** | — | **deliberately empty** — nothing is ever placed here, so Active Canvas stays fully visible/unobstructed |
| Right (row 2, col 3) | `HudRightPanel` | OS Controls, Service Controls, Memory Health |
| Bottom-center (row 3) | `GlassChatPanel` → `ActivityPanel` | chat, collapsible |

`CanvasSwitcher` is explicitly a **temporary** stand-in (its own doc comment
says so) — there is no real navigation system yet.

## Active Canvas views (`ActiveCanvas.tsx`)

`ActiveCanvasView = 'presence' | 'brain'`, registered in one `CANVAS_VIEWS`
map. `HomeScreen` owns which one is mounted (`view` state, driven today only
by `CanvasSwitcher`).

- **`presence`** → `MatPresenceView` → `PresenceHero` (pure centering
  wrapper) → `@panamera-network/mat-presence-orb`'s `<MatPresence>`. Orb
  visual state (`idle`/`thinking`/`error`) is driven by `useHealth()`'s
  `connection`; `audioLevel`/`activityLevel` are hardcoded `0` — no real
  voice/activity signal exists yet, so `0` is the honest value, not a fake
  pulse.
- **`brain`** → `BrainViewCanvas` → `@mat-ai-os/brain-view`'s `<BrainView>`,
  fed **100% by `BrainViewCanvas.mockDomains.ts`** (3 hardcoded domains:
  Trading, Automation, Vision). No VISION API call backs this view at all.
  See "Remaining mock data" below — this is deliberate and already isolated,
  not something this pass was scoped to fix.

Both packages are consumed via pnpm `link:` to sibling repos
(`../MAT-presence-orb`, `../MAT-AI-BrainView`) — a fresh clone of just this
repo won't build without those two directories present alongside it.

## Real API fields currently wired

Every hook below lives in `src/hooks/`, calls the real `VisionApiAdapter`
(`src/adapters/vision/`, base URL `VITE_MAT_API_BASE_URL` or
`http://127.0.0.1:8000`), and is documented per-file with which endpoint it
hits.

| Hook | Endpoint | Consumed by | Real fields shown |
|---|---|---|---|
| `useHealth` (polls 5s) | `GET /health` | `HudStatus`, both `MatPresenceView` and `HomeScreen` independently, `ActivityPanel`'s online gate | connection state, `active_model.{provider,model}`, `body.*` → body label, `degraded.*` → config notes |
| `useAgents` | `GET /agents` | `HudLeftPanel` | `agents.length` |
| `useLoops` | `GET /loops` | `HudLeftPanel` | active-count / total from `loops[].status` |
| `useModels` | `GET /models` | `HudLeftPanel` | count of non-null slots across the 8×4 capability/tier `profiles` matrix |
| `useGovernance` | `GET /governance` | `HudLeftPanel` | `laws.active_count`, `lifecycle.total_cases` |
| `useMcp` | `GET /mcp` | `HudLeftPanel` | `servers.length`, `pending_approvals.length` |
| `useServices` | `GET /services` | `HudRightPanel` | `id`, `display_name`, `state` per service |
| `useServiceControl` | `POST /services/{id}/start|stop` | `HudRightPanel`'s per-service toggle | real request; row re-renders only after `services.refetch()`, no optimistic flip |
| `useMemoryStats` | `GET /memory` | `HudRightPanel` | `total_memories`, `estimated_size_bytes` (guarded by `hasMemoryStats()` — `tiers` can legitimately be `{}`) |
| `useBodyControl` | `POST /control/start|stop|restart|watchdog-check` | `HudRightPanel`'s OS Controls | echoes each response's real `status`/`action` field verbatim as `lastResult` |
| `useThink` | `POST /think` | `GlassChatPanel` → `ActivityPanel` | full conversation flow |

**Not wired to any hook/UI yet** (adapter methods exist, nothing calls
them): `getSkills` (`GET /skills`), `selectModel` (`POST /models/select`),
`restartService` (`POST /services/{id}/restart` — only start/stop is wired
today), `getSoul`, `getIdentity`. None of these are bugs — they're simply
not part of any zone spec given to this pass.

## Standardized loading / offline / degraded / empty states

Added `formatResourceValue()` / `describeResourceStatus()` to
`useVisionResource.ts` (the shared hook every snapshot hook above wraps),
used by `HudLeftPanel` and `HudRightPanel` so all four states read
distinctly instead of collapsing into one ambiguous dash:

- **loading** → `…` (inline value) / `Loading…` (list/block section)
- **offline** (`VisionApiError.unreachable`, MAT unreachable) → `offline` / `Offline`
- **error** (a real non-2xx response) → `error` / `Error loading data`
- **empty** (request succeeded, genuinely nothing there — e.g. no body
  attached, so `agents: []`) → renders the real `0`/empty value, same as
  always; this was already correct, just not distinguished from loading
  before this pass

`HudStatus` uses a different, older pattern: it's driven directly by
`useHealth()`'s own 3-state `connection` machine (`checking`/`online`/
`offline`), not `useVisionResource` — already a clean distinct-states model,
just not the same helper. Worth noting, not worth unifying without a reason.

## Component / data boundaries

- **Presentational components never call the adapter directly** — `HudLeftPanel`/`HudRightPanel`/`HudStatus`/`ActivityPanel`/`PresenceHero` all take data via hooks or props only.
- **Every adapter call lives in `src/hooks/`.** Most snapshot hooks are thin wrappers around the shared `useVisionResource<T>(fetcher)` (fetch-on-mount, `{data, error, loading, refetch}`). `useHealth` (polls) and `useThink`/`useBodyControl`/`useServiceControl` (mutation-only, no GET) are hand-rolled since their shape doesn't fit that pattern.
- **Each hook owns its own request** — no shared cache/context. `useHealth` is called independently in three places (`HomeScreen`, `MatPresenceView`, implicitly by `ActivityPanel`'s prop from `HomeScreen`) and each polls on its own 5s timer. This is simple and already-established, not something this pass changed.
- **`components/README.md` and `canvas-views/README.md`** document this convention in-repo; both are current.

## Remaining mock/fallback data

**Only one real site left**, and it's intentionally kept per this task's own
instruction ("keep isolated only if real OS domain data is unavailable"):

- `src/components/canvas-views/BrainViewCanvas.mockDomains.ts` — hardcoded
  `BrainViewDomain[]` fixture (Trading/Automation/Vision, fake skills +
  knowledge). Clearly marked `TEMPORARY` in its own header comment. No
  VISION API endpoint currently returns data in this shape (domains with
  coordinates/icons/accents/nested skills+knowledge) — `GET /skills` is flat
  and has no domain-grouping, icons, colors, or knowledge-vs-skill split, so
  mapping it onto `BrainView`'s props would mean inventing most of the
  structure, not deriving it. Swap this file's export once a real domain
  data source exists; nothing else needs to change (`BrainViewCanvas.tsx`
  only depends on the `BrainViewDomain[]` shape).

Everything else audited clean — grepped the full `src/` tree for
TODO/FIXME/mock/fake/placeholder/hardcoded; every other hit is either a doc
comment describing a *planned, not-yet-built* mock adapter (`adapters/`
directory, for future offline UI dev) or a comment explicitly disclaiming
fake data, not an instance of one.

## Known functional gaps (for Codex, before touching visuals)

- **No real navigation.** `CanvasSwitcher` is a temporary header control;
  there's no route/screen system behind it.
- **Brain View has no real data source** (see above) — redesign its visuals
  freely, but its content is fixture data, not live.
- **Skills** (`GET /skills`) isn't surfaced anywhere in the UI.
- **Models are read-only** — no UI calls `POST /models/select`.
- **Services**: only start/stop is wired (via toggle); `restartService`
  exists on the adapter but nothing calls it.
- **MCP approvals are read-only** — the API itself has no approve/deny
  route, so `pending_approvals` can only ever be *displayed*, never acted on.
- **`ChamberBackground` is locked** — do not restyle without an explicit,
  deliberate request; it went through several dedicated tuning passes.
- **Icon sets are per-file, not shared** — `HudLeftPanel.tsx` and
  `HudRightPanel.tsx` each define their own small inline SVG icon
  components with no shared library. Fine functionally, but worth
  consolidating into one icon module during the visual pass if the icon
  language changes.
- **No test suite exists** (`vitest` is configured but zero test files) —
  not a gap this pass was asked to fill, noting it for awareness.
