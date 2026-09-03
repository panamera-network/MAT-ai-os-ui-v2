# VISION API Contract

Traced directly from the running implementation — not from any client's assumptions
about it. Source: `D:\MAT-AI-OS-V2\api\app.py` + `api/schemas.py`, with nested shapes
followed down into `iammat/` and `src/mat_core_lib/` where a route returns
`dict[str, Any]`/`list[dict[str, Any]]` and the real fields matter. Verified against
`D:\MAT-AI-OS-V2\ops\startup.py` and `ops/config.py` for how the server actually boots.

This is the one backend both the old `MAT-AI-OS-ui` and the new `MAT-AI-OS-UI-V2`
target. Nothing below is proposed or planned — every field is what the code on disk
does today (2026-08-20).

## Transport

- Base URL: `http://127.0.0.1:8000` by default (`MAT_HOST` / `MAT_PORT` env vars).
  The old UI's `config.ts` hardcodes `http://localhost:8000`, which matches.
- CORS: wide open (`allow_origins: ["*"]`, all methods, all headers) — by design, not
  an oversight (see `app.py`'s own comment: no cookie-based auth exists for CORS to
  protect against).
- Content type: JSON for every route except `/see` (multipart form), `/listen`
  (multipart form), and `/speak` (JSON in, raw audio bytes out with the TTS
  provider's own `content_type`).
- **One WebSocket route exists**: `WS /listen/stream` (Streaming Voice, added after
  this document's original "no WebSocket" survey) — half-duplex, turn-based audio
  in / transcript+response+audio out over one connection. Not adopted by this UI
  yet (out of scope for Implement #13A) — every other route stays single bounded
  request/response, and the old UI's `config.ts`/`useSocket` remain vestigial
  either way; see [OLD_UI_REFERENCE.md](./OLD_UI_REFERENCE.md).

## Authentication

Header: `X-API-Key`. Gating is opt-in — `create_app(principal_resolver=...)` is only
wired with a real resolver when the `MAT_API_KEY` env var is set
(`ops/startup.py::_build_principal_resolver`). Unset (today's default in dev), every
route is open.

- `GET /health` is **always** open, authenticated or not — an unauthenticated
  liveness probe, deliberately carved out.
- Every other route in this document requires the header once auth is turned on.
  Missing/invalid key → `401 {"detail": "Missing or invalid X-API-Key."}`.

## Error conventions

There is no custom exception handler and `schemas.ErrorResponse` (`{error, detail}`)
is defined but **never actually used** by any route — dead schema. What callers
really get:

| Status | When | Body shape |
|---|---|---|
| `401` | Missing/invalid `X-API-Key` when auth is enabled | `{"detail": "Missing or invalid X-API-Key."}` |
| `422` | FastAPI request validation (e.g. missing required field); `/see` with zero images; `/models/select` with an unknown capability/tier | `{"detail": "..."}` (FastAPI's own validation shape for auto-validation, plain string for hand-raised `HTTPException`) |
| `503` | `/think`, `/see`, `/listen` when the underlying call raises `RuntimeError` (e.g. no LLM configured); `/speak` when TTS isn't configured/reachable | `{"detail": "<message>"}` |
| `500` | Any unhandled exception | FastAPI's default — no custom shape |

There is **no 404 for an unknown service id.** `GET /services/{service_id}` and the
start/stop/restart actions all return `200` with a body that says the id wasn't
recognized (see Services below) — the route never raises.

Every route that reads from `mat.body` degrades to a `body_attached: false` response
with empty/default data instead of a 500 when no body is attached — never an
exception. This is the single most important shape fact in this document: **most
list/dict fields below can legitimately be empty**, and that's a normal state
(`MAT_BODY_ENABLED=false`), not an error.

## Core faculties

### `GET /health` — open, no auth

```ts
{
  status: "ok",              // always "ok" if the process is answering at all
  is_running: boolean,
  active_model: { provider: string, model: string },
  faculties: { soul: bool, intelligence: bool, reasoning: bool, vision: bool, voice: bool },
  degraded: {                 // best-effort config presence checks, never a live network call
    llm_provider_configured: bool,
    stt_configured: bool,
    tts_configured: bool,
  },
  body: { body_attached: bool, running: bool, degraded: string[] },  // component names only
}
```

### `POST /think` — auth required

Request: `{ text: string (min 1 char), tier?: string, style?: string, context?: string }`
Response: `{ response: string }`
Errors: `503` if the underlying call raises `RuntimeError` (no model configured/reachable).

No collaboration/orchestration envelope — a single text in, single text out. The old
UI's `ChatPanel.tsx` still carries `CollaborationData`/`ExecutionPath` TypeScript
shapes for a V1-only multi-agent orchestration concept; those fields are permanently
unpopulated against this route (the old UI's own comment says so).

### `POST /see` — auth required, `multipart/form-data`

Request: `prompt: string` (form field) + `images: File[]` (at least one required).
Response: `{ response: string }`
Errors: `422` if `images` is empty, `503` on `RuntimeError`.

### `POST /listen` — auth required, `multipart/form-data`

Request: `audio: File` + `session_id?: string` (form field).
Response:
```ts
{
  transcribed_text: string,
  response_text: string,
  audio_base64: string | null,   // present only if TTS produced a spoken reply
  session_id: string | null,
  blocked: boolean,               // true if governance blocked the request
  stage: string | null,
  detail: string | null,          // human-readable reason when blocked
}
```
Errors: `503` on `RuntimeError`.

### `POST /speak` — auth required

Request: `{ text: string (min 1 char) }`
Response: raw audio bytes, `Content-Type` from the configured TTS provider (not JSON).
Errors: `503 {"detail": "Text-to-speech is not configured/reachable."}` if `m.speak()`
returns `None`.

## Control (`/control/*`) — auth required

Thin wrapper over `iammat/control/supervisor.py::Control` and
`iammat/control/watchdog.py::Watchdog`. Every action degrades to
`{"...": "no_body_attached", ...}` rather than erroring when `mat.body is None`.

| Route | Method | Result shape |
|---|---|---|
| `/control/status` | GET | `{ result: { body_attached: bool, running: bool, degraded: string[] } }` |
| `/control/start` | POST | `{ result: { action: "start", status: "started" \| "already_running" \| "no_body_attached" } }` |
| `/control/stop` | POST | `{ result: { action: "stop", status: "stopped" \| "already_stopped" \| "no_body_attached" } }` |
| `/control/restart` | POST | `{ result: { action: "restart", stop: <stop result>, start: <start result> } }` |
| `/control/kill` | POST | `{ result: { action: "kill", status: "stopped" \| "no_body_attached", forced: bool, reason?: string } }` — `kill` never raises; `forced: true` + `reason` means the underlying shutdown itself failed/timed out but was force-reported as stopped anyway |
| `/control/watchdog-check` | POST | `{ result: WatchdogResult }` (below) |

`WatchdogResult` (one bounded recovery pass, never raises):
```ts
{ healthy: true, action: "none", reason: "no_body_attached" }                // no body
| { healthy: true, action: "none" }                                          // already healthy
| { healthy: true, action: "recovered", attempts: RestartResult[] }          // recovered within budget
| { healthy: false, action: "recovery_failed", attempts: RestartResult[], kill: KillResult }  // gave up, killed
```

## Governed Action Queue (`/queue/pending-approval*`) — owner required

A real `TaskQueue` record that a Law/Contract/Rule verdict deferred to a human —
distinct from Skills' Learn-suggestion queue (a proposed new skill, not an action
pending execution).

```ts
interface QueuedActionSummary {
  id: string
  status: "pending_approval" | "running" | "completed" | "failed" | "blocked" | "timed_out" | "rejected"
  task: string              // the raw request text — the thing actually being approved
  stage: string | null
  action: string | null
  detail: string | null
  user_id: string            // who originally triggered the action — the identity it still executes AS
  created_at: string
  resolved_by: string | null // the approver; null until a human acts
  resolved_at: string | null
}
interface QueuedActionDetail extends QueuedActionSummary {
  result: string | null       // populated only once resolved
  error: string | null
}
```

| Route | Method | Result shape |
|---|---|---|
| `/queue/pending-approval` | GET | `{ items: QueuedActionSummary[] }` |
| `/queue/pending-approval/{id}` | GET | `QueuedActionDetail` directly |
| `/queue/pending-approval/{id}/approve` | POST | `QueuedActionDetail` — claims the record exactly once (atomic CAS) then runs it through the real governed spine |
| `/queue/pending-approval/{id}/reject` | POST | `QueuedActionDetail` — atomic CAS straight to `"rejected"`; the governed spine is never invoked |

`404` for an unknown/non-existent task id or one no longer `pending_approval`
(shown as `404` from the detail route once it's moved past that status);
approve/reject both return `409` if a concurrent call already resolved the record.

## Agents — `GET /agents`, auth required

```ts
{ body_attached: bool, agents: Agent[] }

interface Agent {
  agent_id: string
  name: string
  domain: string
  skill_ids: string[]
  user_id: string | null      // owner_user_id; null/absent = global agent
  is_global: boolean
}
```
**Drift from the old UI's type:** the old UI's `Agent` interface has an optional
`status?: 'active' | 'idle'` field it uses for a live/idle badge
(`CoreEngineGrid`/`AgentsExpand`). The real API **never returns `status`** —
`base_agent.py::to_dict()` doesn't have that field. That badge in the old UI is
always rendering `undefined`.

## Loops — `GET /loops`, auth required

```ts
{ body_attached: bool, loops: Loop[] }

interface Loop {
  id: string
  name: string
  description: string
  trigger: "cron" | "interval" | "event"
  schedule: string
  task: string
  domain: string | null
  pipeline: "simple" | "full"      // NOT in the old UI's LoopInfo type
  done_when: string | null          // NOT in the old UI's LoopInfo type
  status: "active" | "paused" | string
  last_run: string | null           // ISO timestamp
  next_run: string | null
  run_count: number
  created_at: string
}
```
Sorted newest-first by `created_at`. `GET /loops/{id}` returns `{ loop: Loop }` (the
same real record, one at a time). Operator control over an *existing* loop is real:

| Route | Method | Result shape |
|---|---|---|
| `/loops/{id}/pause` | POST | `{ loop: Loop }` — stops firing, keeps the definition |
| `/loops/{id}/start` | POST | `{ loop: Loop }` — (re)activates a paused loop; does not itself execute anything |
| `/loops/{id}/run-now` | POST | `{ loop: Loop, outcome: string }` — `outcome` is the engine's own real string: `"executed"`, `"skipped_not_active"` (paused — never silently reactivated), or `"skipped_already_running"` (overlap guard: a concurrent scheduled fire or another run-now already has this loop mid-run) |

Still no create/delete route — only the three existing default loops (Midnight
Maintenance / Overnight Knowledge Practice / Proactive Suggestion Sweep) can be
operated, never a new one seeded. All three action routes are owner-gated
(`_require_owner`, not just `_require_principal`).

## Memory — `GET /memory`, auth required

```ts
{ body_attached: bool, tiers: MemoryStats, health: MemoryHealth }
// "tiers" is a misleading field name — it's one stats object, not a per-tier map

interface MemoryStats {
  counts: { hot: number, warm: number, cold: number, archive: number }
  total_memories: number
  estimated_size_bytes: number
}

interface MemoryHealth {
  module_ready: boolean               // did MemoryManager construct at all
  qdrant: "online" | "offline" | "unknown"   // live network probe of the Qdrant
                                              // server; "unknown" only when no body
                                              // is attached to check it through
  vector_store_connected: boolean     // THIS manager instance's own current
                                       // connection state — can lag "qdrant: online"
                                       // right after Qdrant restarts, until this
                                       // instance's own lazy reconnect has run
}
```
`tiers`: stale-while-revalidate on the server — first call after startup blocks;
subsequent calls return a cached value refreshed in the background (TTL-based). Also
degrades to `{}` (empty dict, not the shape above) if the memory backend (Qdrant) is
attached but unreachable — logged as a warning server-side, not an error to the
caller. **A consumer must handle `tiers` being `{}`.**

`health`: three independently-grounded signals, never derived from one another or
from `tiers` — see `MemoryHealth` in `api/schemas.py` and `Body.check_memory_health`
(MAT-AI-OS-V2) for the exact composition. Always present, even when `tiers` is `{}`
or `body_attached` is `false`.

### `GET /memory/user`, `DELETE /memory/user/{id}` — auth required

```ts
{ body_attached: bool, memories: UserMemoryEntry[] }

interface UserMemoryEntry {
  id: string
  content: string
  metadata: Record<string, unknown>
  created_at: string | null
}
```
The caller's own durable (`MemoryType.USER`) memories, individually — mem0's own
`user_id` filter makes a cross-user result structurally impossible. Excludes the
caller's own Conversation Profile record (same memory_type, a different category —
see below). `DELETE /memory/user/{id}` returns `204 No Content`; a memory that
doesn't exist, or belongs to someone else, both return `404` (never a `403` that
would leak which case it was).

### `GET /memory/profile`, `DELETE /memory/profile` — auth required

```ts
{ body_attached: bool, exists: bool, dimensions: Record<string, ConversationProfileDimension> }

interface ConversationProfileDimension {
  value: string
  confidence: number
  evidence_count: number
  source: "explicit" | "inferred"
  last_updated: string
}
```
A single point lookup at a fixed, per-user deterministic id — never a listing/search.
`exists: false` with empty `dimensions` is a real, non-error state (no profile
learned yet). Only TRUSTED dimensions are ever exposed — one still accumulating
evidence is never shown here, same as it's never injected into `/think`'s own
context. `DELETE /memory/profile` returns `204 No Content`.

## Events — `GET /events?limit=50`, auth required

```ts
{ body_attached: bool, events: EventEntry[] }

interface EventEntry {
  id: string            // globally unique — "error-<id>" or "learning-<index>-<timestamp>"
  timestamp: string      // ISO 8601, not epoch millis
  source: "error" | "learning"
  type: string            // e.g. "error_logged", "learned", "improved", "rejected", ...
  message: string
  severity: "info" | "success" | "warning" | "danger"
}
```
Real MAT activity, merged server-side from two independent, already-persisted logs —
`ErrorLogManager` (every ERROR+ log anywhere in the process) and `LearningAnalytics`
(governance/learning decisions) — sorted newest-first, never a new log of its own.
Each source degrades independently: one being unavailable never takes the other down
with it. `limit` is clamped to 200 server-side. This is distinct from the HUD's
session-local click log (`hudEvents.ts`) — the two are merged client-side into one
Recent Events feed (`HudRightPanel.tsx`), not a replacement of one by the other.

## Governance — `GET /governance`, auth required

```ts
{ body_attached: bool, laws: LawStatus, lifecycle: LifecycleStatus }

interface LawStatus {
  total: number
  active_count: number
  inactive_count: number
  active_laws: { id: string, action: string, rule: "allow" | "queue" | "deny" }[]
}

interface LifecycleStatus {
  total_cases: number
  by_state: Record<string, number>   // e.g. {"suggested": 2, "awaiting_approval": 1}
}
```
Read-only from this route — no `/governance/*` mutation route exists in this API
(law updates, case resolution, etc. are internal-only right now).

## MCP — `GET /mcp`, auth required

```ts
{ body_attached: bool, servers: McpServer[], pending_approvals: McpApproval[] }

interface McpServer {
  name: string
  url: string
  description: string
  registered_at: string   // ISO timestamp
}

interface McpApproval {
  id: string
  status: "pending" | "denied" | string
  agent_id: string
  domain: string
  server: string
  tool: string
  params: Record<string, unknown>
  reason: string
  user_id: string
  result: unknown | null
  error: string | null
  created_at: string
  resolved_at: string | null
  granting_skills: { skill_id: string, fingerprint: string }[]
  granting_skills_requested: boolean
}
```
`McpApproval` above is the commonly-populated subset of a much larger internal
record — `mcp_approvals.py` is 3000+ lines with additional bookkeeping fields for
retries/outbox delivery that aren't relevant to a UI consumer.

### `POST /mcp/approvals/{id}/approve|deny` — owner required

```ts
{ approval: McpApproval }   // the resolved record, verbatim
```
`approve` is the ONE place a pending outbound MCP tool call actually executes —
routes through `body.mcp.dispatcher` (never the bare manager), so a
`server="whatsapp"`/`"email"` approval reaches its own real sender. `deny` (optional
`?reason=` query param) only discards the pending call, never dispatches. Both
enforce ownership (a different user's approval can never be resolved through this
route — `403` on mismatch) and reject an already-resolved approval with `409`.

## Skills — `GET /skills`, auth required

```ts
{ body_attached: bool, skills: Skill[] }

interface Skill {
  id: string
  name: string
  domain: string
  description: string
  tools_required: string[]
  prompt_fragment: string
  source?: string
  learned_at?: string
  auto_generated?: boolean
  mcp_servers?: string[]        // MCP server names this skill grants access to
  owner_user_id?: string        // present only for a personal (non-global) learned skill
  is_global?: boolean
}
```
No `kind: 'ability' | 'content'` field server-side — the old UI's own comment in
`BackendContext.tsx` already documents this as a client-only computed field that
V2 doesn't provide yet. Keep that honest in V2 rather than inventing a fake value.

### `GET /skills/{id}/versions`, `POST /skills/{id}/rollback` — auth required

```ts
// GET /skills/{id}/versions:
{ body_attached: bool, skill_id: string, versions: SkillVersion[] }

interface SkillVersion {
  version_id: string
  skill_id: string
  owner_user_id: string | null
  provenance: string
  reason: string
  created_at: string
  data: Record<string, unknown>   // the skill-dict snapshot BEFORE the update this record was saved for
}

// POST /skills/{id}/rollback:
{ skill: Record<string, unknown> }   // the restored candidate record, verbatim
```
`rollback` exposes the existing, unmodified `LearningPipelineEngine.rollback_skill`
— one step back only (the most recent approved-then-superseded version), never an
arbitrary historical one, never auto-triggered. `404` for an unknown skill, `403`
for the wrong owner, `400` for a legacy global/builtin lineage, `409` for no prior
version to roll back to (or a genuine concurrent conflict).

## Models — `GET /models`, `POST /models/select`, auth required

MAT's **own** model registry only — never Body's. Ten fixed capabilities
(`model_registry.py::CAPABILITIES`, verbatim order), four fixed tiers each:

```ts
type Capability = "FAST" | "THINKING" | "EXPERT" | "VISION" | "VOICE" | "VOICE_STT" | "VOICE_TTS" | "VIDEO" | "EMBEDDING" | "RERANKER"
type Tier = "primary" | "fallback_local" | "fallback_cloud" | "fallback_api"

// GET /models and POST /models/select both respond:
{ profiles: Record<Capability, Partial<Record<Tier, { provider: string, model: string } | null>>> }
```
`VOICE_STT`/`VOICE_TTS` are the capabilities `Voice` actually resolves for STT/TTS
dispatch (`_resolve_voice_slot_kwargs`) — the combined `VOICE` slot is a separate,
third capability, not an alias for either.

`POST /models/select` body: `{ capability: string, tier?: string (default "primary"),
provider?: string | null, model?: string | null }` — passing both `provider` and
`model` as `null`/omitted **clears** that tier's slot. `422` for an unknown
capability/tier. There is no "discover available models" endpoint — this is a fixed
matrix the caller sets by hand, not a catalog to browse.

## Soul — `GET /soul`, auth required

```ts
{ soul: SoulInfo }

interface SoulInfo {
  soul_prompt: string
  response_styles: Record<string, string>
  safety_rules: string
  active_style: string
  identity: IdentityProfile     // NOT in the old UI's SoulInfo type — it's actually
}                                // embedded in every /soul response and currently unused there
```
Read-only — no `/soul` mutation route exists in this API (the underlying
`update_soul_prompt`/`set_active_style` methods exist server-side but aren't wired
to a route).

## Identity — `GET /identity`, auth required

```ts
{ identity: IdentityProfile }

interface IdentityProfile {
  name: string
  nickname: string
  language: string
  profession: string[]
  active_projects: string[]
  goals: { short_term: string[], long_term: string[] }
  preferences: { communication_style: string, work_hours: string }
  timezone: string
  active_mode: string            // e.g. "work" — free text, not a fixed enum server-side
  persona: "trader" | "creator" | "sme" | "student"   // NOT in the old UI's IdentityProfile type
}
```
Read-only from this API — no `/identity` mutation route exists (the old UI's
`SettingsPanel.tsx` already shows every field as `readOnly` with a "profile editing
isn't available yet" note, which matches reality exactly).

## Services — `/services*`, auth required

Config-driven, fixed set of external processes MAT supervises directly (never a
shell string — argv lists only). One instance of this set exists per machine, built
from what's actually installed (`service_supervisor.py::_build_definitions`):
`vision` (thin pass-through to Control, not a real subprocess), `strategy_engine`,
`engine_dashboard`, `os_ui_mobile`, `mk1`, `mk1_mobile`.

```ts
interface ServiceStatus {
  id: string
  display_name: string
  configured: boolean            // false if the repo/interpreter wasn't found on this machine
  state: "running" | "degraded" | "stopped" | "unconfigured" | "unknown_service"
  detail: Record<string, unknown>  // shape varies by service — see below
}
```

- `GET /services` → `{ services: ServiceStatus[] }`
- `GET /services/{id}` → `ServiceStatus` directly (an unknown id returns `200` with
  `state: "unknown_service"`, never `404`)
- `POST /services/{id}/start|stop|restart` → `{ result: ServiceActionResult }`

```ts
// start/stop:
{ id: string, action: "start" | "stop", status: string, detail?: Record<string, unknown> }
// restart:
{ id: string, action: "restart", stop: <stop result>, start: <start result> }
```
`status` values seen: `started`, `already_running`, `stopped`, `already_stopped`,
`unconfigured`, `failed_to_start`, `unknown_service`. For the `vision` service id,
`detail` is literally `body_status()`'s own shape (same as `/control/status`) — the
two are the same underlying lifecycle, exposed through two different route families.

**Do not confuse this with the old UI's `LauncherContext`.** That talks to a
completely separate process (`launcher_server.py`, port 8050, its own
`/launcher/health` and `/launcher/services/{id}/{action}` routes, a different
`ServiceId` set: `core`/`engine`/`dashboard`/`mk1`/`mobile`/`mk1_mobile`) that isn't
part of the VISION API at all. See [OLD_UI_REFERENCE.md](./OLD_UI_REFERENCE.md) for
why the old UI's simultaneous use of both under one "Services" umbrella is confusing.

## Routes referenced by the old UI that do not exist in this API

Confirmed absent from `api/app.py` (verified by reading the full route list, not by
absence of a grep hit alone):

- `POST /feedback` — `ChatPanel.tsx` posts a thumbs up/down rating here; no-op against
  a real backend.
- `GET/POST /goals` — `GoalsPanel.tsx`'s entire data source; the component is also
  not reachable from the app's render tree (see OLD_UI_REFERENCE.md).
- `GET /knowledge`, `GET /knowledge/{id}` — `BrainView.tsx`'s "Knowledge" mode.
- Any `ws://.../ws` — see "No WebSocket" above.
- `/creator/*`, `/dev/*`, `/errors` — the old UI's own comment in `App.tsx` already
  states these have "no V2 equivalent yet."
