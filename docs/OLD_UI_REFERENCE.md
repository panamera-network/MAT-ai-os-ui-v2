# Old UI Reference Audit

`D:\MAT-AI-OS-ui` inspected as reference only — nothing here was modified. Findings
are grounded in what's actually reachable from `App.tsx`'s render tree, cross-checked
against [VISION_API_CONTRACT.md](./VISION_API_CONTRACT.md), not just what's
plausible-looking in a component file. A surprising amount of the old UI is not live
code — see "Dead/orphaned code" below before trusting any single file in isolation.

## What's actually live

`App.tsx` renders exactly: `ToastProvider > BackendProvider > LauncherProvider >
(Header, ControlMain, RightPanel, ToastHost)`. `App.tsx`'s own comment says it plainly:
*"'control' is the only view Phase 1 supports"* — this old UI already went through one
deliberate trim from a larger V1 surface down to what V2's API actually backs. That
trim is itself useful reference material, not just the leftover code.

## Useful data views

- **Core Engine grid** (`CoreEngineGrid.tsx`) — one card per faculty (Control,
  Services, Memory, Skills, Agents, Loops, LLM, Governance), each showing a
  one-line live status plus a "live" badge dot, opening a detail modal on click.
  This is a good *information architecture* to reuse: one glance shows which
  faculties are healthy, expand only the one you care about. Every card's summary
  line is real data (`useBackend()`), not decoration.
- **Control panel** (`ControlExpand`) — status line (reachable / body attached /
  running / degraded components) plus the five real actions (start/stop/restart/
  watchdog-check, kill behind a confirm step). Good model for "one screen, one
  faculty, its status and its actions together" rather than splitting status and
  control into separate views.
- **Services power switches** (`ServicesExpand`) — a toggle-style start/stop per
  service plus a restart button, with a per-row error line when a service is
  unconfigured or fails to start. Directly matches `/services` from the contract.
- **Memory tier breakdown** (`MemoryExpand`) — tier counts + total, straight from
  `/memory`. Simple, correct, worth keeping as-is conceptually.
- **Loop cards** (`LoopsExpand`) — name, status badge, task, last/next run, run
  count. Good density for a read-only loop list.
- **Model matrix** (`LLMExpand`) — capability × tier grid showing the configured
  `{provider, model}` per slot, plus a form to set one. Correctly models that this
  is a fixed matrix, not a discovery catalog (matches the contract).
- **Governance summary** (`GovernanceExpand`) — active law count + list, lifecycle
  case counts by state. Thin, accurate mirror of `/governance`.
- **Chat** (`ChatPanel.tsx`) — text send via `/think`, voice record-and-send via
  `/listen` with optional TTS playback of the reply, copy-to-clipboard, elapsed-time
  indicator while pending. The voice recording flow (MediaRecorder → blob → `/listen`
  → optional audio playback of `audio_base64`) is a complete, correct reference
  implementation of that route pair — reuse the *flow*, not the file (see below for
  what to drop from it).
- **PC health readout** (`Header.tsx`'s `StatCard`/`Sparkline`) — CPU/RAM/swap/disk
  with a rolling 24-sample sparkline. Good compact pattern, but note this reads from
  the *Launcher* service (port 8050), not the VISION API — see "Two service
  systems" below before reusing it as-is.

## Useful interactions

- **Confirm-before-destructive, inline, not a modal**: Kill Switch requires a second
  click with a visible warning line in place, not a separate dialog. Cheap, clear,
  worth keeping as the pattern for any V2 stop/kill/delete action.
- **Optimistic UI + reconciling poll**: service toggles set local `busyId` immediately,
  then let the next 5s poll correct the displayed state rather than trusting the
  action response alone. Reasonable for actions whose real completion is
  process-async (a service starting takes longer than the HTTP response).
- **Graceful "unreachable" states everywhere**, not just for the whole app: control
  status separately tracks "MAT unreachable" vs. "body not attached" vs. "stopped" as
  three distinct, distinctly-labeled states rather than collapsing them into one
  generic offline indicator. Matches the contract's own `body_attached`/`running`/
  `degraded` distinction — worth preserving that granularity in V2's presentation
  layer.
- **Read-only-with-a-note instead of a fake edit form**: `SettingsPanel.tsx` shows
  every identity field as `readOnly` with an explicit "profile editing isn't
  available yet" line. Honest about the contract (there's no identity mutation
  route) rather than building a form that silently does nothing on submit.

## Useful status/health information

- The three-level body health model (`body_attached` → `running` → `degraded: []`)
  recurs across Control, Services (for the `vision` id), and Core Engine's badge
  logic. It's the right level of granularity for this backend and should carry
  forward as a shared concept in V2's domain layer, not be re-derived per screen.
- `degraded` is a list of **component names only**, deliberately never reasons/config
  (see the contract's own note) — the old UI respects that boundary everywhere it
  surfaces `degraded`, never inventing an explanation for *why* something is
  degraded. Worth keeping as a hard rule.

## Useful navigation concepts

- **Single always-visible workspace, contextual detail via modal-on-demand** — no
  persistent sidebar nav once Phase 1 trimmed it down; instead a grid of cards each
  opens its own detail overlay and closes back to the same grid. Low navigational
  overhead, matches "lawn-mower simplicity": one surface, tap in, tap out.
- Chat is *always present* (`RightPanel`) rather than a separate destination —
  talking to MAT is never more than the input box already on screen.

## Obsolete or overly complex UI patterns

- **Two parallel "Services" concepts on one screen.** `ControlMain.tsx` renders a
  `SERVICES` section at the top driven by `useLauncher()` (Launcher's own
  `core`/`engine`/`dashboard`/`mk1`/`mobile`/`mk1_mobile` set, port 8050) *and* a
  `Services` card in the Core Engine grid driven by the real VISION API's
  `/services` (`vision`/`strategy_engine`/`engine_dashboard`/`os_ui_mobile`/`mk1`/`mk1_mobile`).
  Two different id sets, two different backends, one visual language ("Services"),
  on the same screen. A V2 rebuild should either pick one clear source of truth per
  concept or visually separate "OS-level process supervisor" from "VISION's own
  service control" — never blur them the way this screen does.
- **Brain View's "Knowledge" mode is dead weight.** It calls `GET /knowledge` and
  `GET /knowledge/{id}`, neither of which exist in this API (see contract). It fails
  silently (catches, falls back to an empty graph) — a user clicking "Knowledge"
  today gets a blank sphere with no explanation. Either the route needs to exist
  before this ships in V2, or the toggle shouldn't.
- **Skills Library shows fixture data, not real skills.** `SkillsLibrary.tsx`
  (rendered live, via `ControlMain`) is built entirely from a static `data/domains.ts`
  fixture — hardcoded skill name lists per domain, never touching `/skills`. It sits
  right next to `SkillsExpand` (inside the Core Engine grid), which *does* use real
  `useBackend().skillsByDomain` data. Same concept, same screen, two components, only
  one of them real. This is the single clearest "don't carry this forward" case in
  the whole codebase — a user has no way to tell which "Skills" view is live.
- **Chat carries a whole unused type system for a feature that doesn't exist here.**
  `ChatPanel.tsx`'s `CollaborationData`/`ExecutionPath`/multi-agent rendering branch
  is V1 Orchestrator-specific; the file's own comment says these fields "stay
  permanently unpopulated" against `/think`. It's honestly commented, but it's still
  real branching logic (a whole `collab-*` rendering path) maintained for a shape
  that can never arrive from this backend.
- **`/feedback` (thumbs up/down) and `/goals` (GoalsPanel) point at routes that don't
  exist.** Both fail silently. `GoalsPanel.tsx` additionally isn't reachable from the
  app at all (see below) — it's speculative UI for a feature with no backend and no
  way to open it.
- **A `status` badge that can never render.** `AgentsExpand` shows
  `agent.status === 'active' ? 'live' : 'soon'` — but the real `/agents` response
  never includes `status` (see contract). This has silently been a permanently-unlit
  badge, not a real live indicator.

## Architecture we should explicitly avoid carrying forward

- **Dead/orphaned code left in the tree with no marker that it's dead.** Confirmed by
  import-graph, not guesswork: `CreatorContext`/`CreatorProvider`, `DevContext`/
  `DevProvider`, the entire `components/creator/` and `components/dev/` trees,
  `hooks/useSocket.ts`, `hooks/useMcpApprovals.ts`, `hooks/useGovernanceLifecycle.ts`,
  `components/GoalsPanel.tsx`, and `components/MemorySystem.tsx` are none of them
  imported anywhere `App.tsx` can reach. They still build, still typecheck, still
  look like real features when opened individually — but none of them render. A V2
  codebase should delete a feature when it's cut, not leave a plausible-looking
  ghost of it sitting in the source tree for the next person to trust by accident.
  This is the single biggest lesson from this audit: **file existence is not evidence
  of a live feature in this codebase — always check the render tree.**
- **A flat `components/` + `context/` split with no boundary between "talks to the
  network" and "renders."** Nearly every component in this old UI calls `fetch`
  directly against `API_BASE_URL` inline (`LeftPanel.tsx`, `ControlMain.tsx`,
  `BrainView.tsx`, `GoalsPanel.tsx`, `MemorySystem.tsx` all do their own
  fetch/poll/error-handling). There's no adapter seam — swapping or mocking the
  backend means editing every component. `MAT-AI-OS-UI-V2`'s `adapters/` +
  `domain/` split exists specifically to avoid re-deriving this problem.
- **Duplicated fetch/poll/error boilerplate per component**, not shared: every
  `*Expand` component in `LeftPanel.tsx` re-implements its own `useState` for
  loading/data/error and its own `useEffect` polling loop, with copy-pasted
  try/catch-and-swallow error handling. A shared adapter + a couple of generic hooks
  would have collapsed most of this into one pattern.
- **Type definitions that don't match the real payload and nobody notices**, because
  there's no shared source of truth between backend and frontend types (see the
  `Agent.status`, `LoopInfo` missing `pipeline`/`done_when`, `SoulInfo` missing
  `identity`, `IdentityProfile` missing `persona` drifts documented in the contract).
  These aren't hypothetical — they're first-hand findings from this audit. V2's
  domain types should be derived from and checked against the real contract
  (ideally with a test or generation step), not hand-typed once and left to drift.
- **Two unrelated backends addressed through one context-provider naming
  convention** (`useBackend()` for VISION, `useLauncher()` for the Launcher service)
  makes it easy to reach for the wrong one without noticing, as `ControlMain.tsx`'s
  services duplication shows. If V2 needs the Launcher service at all, it should be
  a clearly separate adapter, not visually merged into "the same kind of thing" as
  VISION API data.
