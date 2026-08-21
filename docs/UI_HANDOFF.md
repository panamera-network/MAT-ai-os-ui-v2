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
| Left (row 2, col 1) | `HudLeftPanel` | Agents / Loops / LLM / Governance / MCP / Skills snapshot |
| **Center (row 2, col 2)** | — | **deliberately empty** — nothing is ever placed here, so Active Canvas stays fully visible/unobstructed |
| Right (row 2, col 3) | `HudRightPanel` | OS Controls (incl. Force Kill), Model Routing, Service Controls (start/stop/restart), Memory Health |
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
| `useModels` | `GET /models` | `HudLeftPanel`, `HudRightPanel`'s `ModelRoutingCard` (own independent call) | count of non-null slots across the 8×4 capability/tier `profiles` matrix |
| `useGovernance` | `GET /governance` | `HudLeftPanel` | `laws.active_count`, `lifecycle.total_cases` |
| `useMcp` | `GET /mcp` | `HudLeftPanel` | `servers.length`, `pending_approvals.length` |
| `useSkills` | `GET /skills` | `HudLeftPanel` | `skills.length` — see "Skills surface" below for why it's just a count today |
| `useServices` | `GET /services` | `HudRightPanel` | `id`, `display_name`, `state` per service |
| `useServiceControl` | `POST /services/{id}/start\|stop\|restart` | `HudRightPanel`'s per-service toggle + restart icon | real request; row re-renders only after `services.refetch()`, no optimistic flip |
| `useMemoryStats` | `GET /memory` | `HudRightPanel` | `total_memories`, `estimated_size_bytes` (guarded by `hasMemoryStats()` — `tiers` can legitimately be `{}`) |
| `useBodyControl` | `POST /control/start\|stop\|restart\|watchdog-check\|kill` | `HudRightPanel`'s OS Controls (incl. Force Kill) | echoes each response's real `status`/`action` field verbatim as `lastResult` |
| `useModelSelect` | `POST /models/select` | `HudRightPanel`'s `ModelRoutingCard` | capability + tier dropdowns, provider + model text inputs; empty provider/model clears that slot (the API's own semantics); echoes the real outcome as `lastResult`, refetches `useModels()` on settle |
| `useThink` | `POST /think` | `GlassChatPanel` → `ActivityPanel` | full conversation flow |

### Skills surface

`useSkills()` is a thin `useVisionResource` wrapper — the same shape as
every other snapshot hook, genuinely fetching `GET /skills`. Today it's
consumed as one more compact count row in `HudLeftPanel` ("SKILLS · N"),
matching this pass's instruction to wire it into a "non-intrusive
surface/drawer-ready data path" rather than invent a skills list/drawer UI.
The hook itself has no UI opinion — a future skills drawer/browser can call
`useSkills()` directly with no changes to the data layer.

### Adapter methods audited and left intentionally unwired

Every `VisionApiAdapter` method was checked. Everything above is now wired.
What's left, and why:

| Method | Endpoint | Why unwired |
|---|---|---|
| `getSoul` | `GET /soul` | No existing HUD zone is "MAT's persona/soul" — wiring it would mean inventing a new UI surface, not filling a gap in an existing one. Same reasoning as Skills, but there's no established "count row" pattern that fits soul_prompt/response_styles/safety_rules. |
| `getIdentity` | `GET /identity` | Same as `getSoul` — no natural existing surface; wiring it means designing new UX, which this pass was told not to do. |
| `getControlStatus` | `GET /control/status` | Redundant with `useHealth()`'s `health.body` (`body_attached`/`running`/`degraded`), already shown in `HudStatus` and implicitly informing OS Controls. A second poller for the same data isn't a real gap. |
| `getService` | `GET /services/{id}` | Redundant with `useServices()`'s list, which `HudRightPanel` already has in full. No UI need for fetching one service in isolation. |
| `see`, `listen`, `speak` | `POST /see\|listen\|speak` | Multi-modal (image upload, audio record/playback) — wiring any of these means building real new interaction surfaces (file picker, mic capture, audio player), which is exactly the "invent new UX" this pass was told to avoid. Legitimate future feature work, not a wiring gap. |

None of these are bugs. They're the honest boundary of "wire what clearly
belongs somewhere that already exists" versus "design a new feature."

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

- **Presentational components never call the adapter directly** — `HudLeftPanel`/`HudRightPanel`/`HudStatus`/`ActivityPanel`/`PresenceHero` all take data via hooks or props only. `ModelRoutingCard` (a small function component inside `HudRightPanel.tsx`) still only talks to `useModels`/`useModelSelect`, same rule.
- **Every adapter call lives in `src/hooks/`.** Most snapshot hooks are thin wrappers around the shared `useVisionResource<T>(fetcher)` (fetch-on-mount, `{data, error, loading, refetch}`). `useHealth` (polls) and `useThink`/`useBodyControl`/`useServiceControl`/`useModelSelect` (mutation-only, no GET) are hand-rolled since their shape doesn't fit that pattern.
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

The functional wiring pass is complete — every adapter method that clearly
belongs to an existing zone is wired (Agents/Loops/LLM/Governance/MCP/Skills
snapshots, OS Controls incl. Force Kill, Model Routing, per-service
start/stop/restart, Memory Health). What's left is either deliberately
out of scope (mock data, no real source) or deliberately not invented
(no existing surface to attach it to):

- **No real navigation.** `CanvasSwitcher` is a temporary header control;
  there's no route/screen system behind it.
- **Brain View has no real data source** (see "Active Canvas views" above)
  — redesign its visuals freely, but its content is fixture data, not live.
- **Skills is a count, not a browser.** `useSkills()` is real and
  drawer-ready; there's no drawer/list UI yet (see "Skills surface" above).
- **MCP approvals are read-only** — the API itself has no approve/deny
  route, so `pending_approvals` can only ever be *displayed*, never acted on.
- **Soul/Identity, single-service GET, and the multi-modal endpoints
  (`see`/`listen`/`speak`) are intentionally unwired** — see "Adapter
  methods audited and left intentionally unwired" above for why each one
  specifically doesn't have an existing surface to attach to without
  inventing new UX.
- **`ChamberBackground` is locked** — do not restyle without an explicit,
  deliberate request; it went through several dedicated tuning passes.
- **Icon sets are per-file, not shared** — `HudLeftPanel.tsx` and
  `HudRightPanel.tsx` each define their own small inline SVG icon
  components with no shared library. Fine functionally, but worth
  consolidating into one icon module during the visual pass if the icon
  language changes.
- **No test suite exists** (`vitest` is configured but zero test files) —
  not a gap this pass was asked to fill, noting it for awareness.
