# V2 Data Surface

What `MAT-AI-OS-UI-V2` can display and control **today**, grouped by concept, derived
strictly from [VISION_API_CONTRACT.md](./VISION_API_CONTRACT.md) — no endpoint here is
invented or planned. This is an inventory, not a screen design: grouping data doesn't
imply one screen per group, a shared screen, or any layout — that's a later,
separately-reviewed decision.

Every group except MAT/System is gated by `body_attached` — if no `V2Body` is
attached (`MAT_BODY_ENABLED=false`), that group's data is empty/default, not an
error. "Read" means a `GET`; "Act" means a `POST`/`DELETE` that changes real state.

## MAT

The MAT process itself — always available, no body required.

- **Read**: `GET /health` — run state, active model, faculty presence flags, config
  presence flags (`degraded`), body summary.
- **Read**: `GET /soul` — soul prompt, response styles, safety rules, active style
  (identity is embedded in this response too, but redundant with Identity below).
- **Read**: `GET /identity` — name, nickname, language, profession, active projects,
  goals (short/long term), preferences, timezone, active mode, persona.
- **Act**: `POST /think` — send text, get a reply.
- **Act**: `POST /see` — send an image + prompt, get a reply.
- **Act**: `POST /listen` — send audio, get transcript + reply (+ optional spoken
  audio back). A streaming variant (`WS /listen/stream`) also exists server-side —
  not adopted by this UI yet.
- **Act**: `POST /speak` — send text, get spoken audio back.
- `GET /soul`/`GET /identity` exist in the adapter but are not yet wired into any
  screen (Implement #13A audit finding — tracked, not fixed by this pass). No
  mutation route for Soul or Identity exists either way — both are display-only.

## System

Process lifecycle for the MAT/Body runtime itself.

- **Read**: `GET /control/status` — body attached / running / degraded components.
- **Act**: `POST /control/start`, `/control/stop`, `/control/restart`,
  `/control/kill`, `/control/watchdog-check`. The UI confirms with the operator
  before firing Restart or Force Kill — the request itself is unconditional either
  way, the confirmation is UI-side only.

Not the same thing as **Services** below, even though `vision`'s service status is
just this same data reflected through a different route — see Services.

## Agents

- **Read**: `GET /agents` — id, name, domain, skill ids, owner, global flag.
- No create/update/delete route exists — read-only surface today.

## Activity

Scheduled/recurring work MAT runs on its own.

- **Read**: `GET /loops` — id, name, description, trigger type, schedule, task,
  domain, pipeline, done-when condition, status, last/next run, run count, created
  at.
- **Read**: `GET /loops/{id}` — the same real record, one at a time.
- **Act**: `POST /loops/{id}/pause`, `/start`, `/run-now` — operate one of the
  existing default loops. `run-now`'s real outcome (`executed` /
  `skipped_not_active` / `skipped_already_running`) is shown verbatim, never
  collapsed to a bare success/fail.
- No create/delete route exists, even though the underlying engine supports both
  internally — only operating an *existing* loop is exposed.

## Memory

- **Read**: `GET /memory` — counts per tier (hot/warm/cold/archive), total memory
  count, estimated size in bytes, plus a `health` object with three independently
  -grounded signals (`module_ready`, `qdrant`, `vector_store_connected` — see
  docs/VISION_API_CONTRACT.md's Memory section).
- **Read**: `GET /memory/user` — the caller's own durable memories, individually.
- **Act**: `DELETE /memory/user/{id}` — erase one of them.
- **Read**: `GET /memory/profile` — the caller's own learned Conversation Profile
  (communication-style dimensions, never a fact about them).
- **Act**: `DELETE /memory/profile` — reset it. The UI confirms before either
  delete/reset.
- Can legitimately return an empty stats object even when a body is attached (memory
  backend unreachable) — a real, non-error state to design for. `health` is always
  present regardless, since it's computed independently of whether tier stats
  themselves succeeded.

## Events

- **Read**: `GET /events?limit=50` — real MAT activity, merged server-side from the
  error log and learning analytics into one chronological, severity-tagged feed.
- No route to resolve/dismiss an event — read-only, same as every other Body-scoped
  route here.
- The HUD merges this with its own session-local click log client-side (two genuinely
  different kinds of "what happened"), not a replacement of one by the other.

## Skills

- **Read**: `GET /skills` — id, name, domain, description, tools required, prompt
  fragment, optional source/learned-at/auto-generated/mcp-servers/ownership fields.
- **Read**: `GET /skills/{id}/versions` — one skill's real upgrade history.
- **Act**: `POST /skills/{id}/rollback` — restore the most recent approved-then-
  superseded version (one step back only, never an arbitrary historical one). The
  UI confirms before rolling back.
- No create/update/delete route beyond that — otherwise read-only.

## MCP

- **Read**: `GET /mcp` — registered servers, pending outbound tool-call approvals,
  per-server call activity (success/failure counts, last activity).
- **Act**: `POST /mcp/approvals/{id}/approve` — the one place a pending outbound
  call actually executes. `POST /mcp/approvals/{id}/deny` — discards it, never
  dispatches. Both owner-gated.
- No server register/remove route wired into this UI yet (the route exists
  server-side; out of scope for this pass — see hard rules in Implement #13A).

## Governed Action Queue

A real `TaskQueue` record that a Law/Contract/Rule verdict deferred to a human —
distinct from Skills' own Learn-suggestion queue (a proposed new skill, not an
action pending execution).

- **Read**: `GET /queue/pending-approval` — every task currently `pending_approval`.
- **Read**: `GET /queue/pending-approval/{id}` — one task's detail, including its
  real `result`/`error` once resolved.
- **Act**: `POST /queue/pending-approval/{id}/approve` — claims and executes the
  task through the real governed spine. `POST /queue/pending-approval/{id}/reject`
  — discards it. Both owner-gated.

## Models

MAT's own LLM routing configuration — distinct from Body, never shared with it.

- **Read**: `GET /models` — the full capability × tier matrix (10 capabilities × 4
  tiers, each slot a `{provider, model}` pair or empty). The 10 capabilities are
  `FAST`, `THINKING`, `EXPERT`, `VISION`, `VOICE`, `VOICE_STT`, `VOICE_TTS`, `VIDEO`,
  `EMBEDDING`, `RERANKER` — `VOICE_STT`/`VOICE_TTS` are the ones Voice actually
  resolves for STT/TTS dispatch; the combined `VOICE` slot is a separate capability
  (Implement #13A: the UI's own capability list previously hardcoded only 8 of the
  10, silently hiding the STT/TTS rows — fixed).
- **Act**: `POST /models/select` — set or clear one capability's one tier.
- No discovery/catalog route wired into this UI (`GET /models/catalog` exists
  server-side; out of scope for this pass) — this is a fixed matrix the caller
  edits by hand, not yet a list to browse from.

## Services

External process supervision for the MAT.ai ecosystem, config-driven and fixed:
`vision` (MAT/Body itself), `strategy_engine`, `engine_dashboard`, `os_ui_mobile`,
`mk1`, `mk1_mobile`.

- **Read**: `GET /services` (all), `GET /services/{id}` (one) — configured flag,
  state (`running`/`degraded`/`stopped`/`unconfigured`/`unknown_service`), and a
  detail payload whose shape varies by service.
- **Act**: `POST /services/{id}/start`, `/stop`, `/restart`.
- A service can be `configured: false` (its repo/interpreter wasn't found on this
  machine) — a real, displayable state, not an error to hide.

## Governance

- **Read**: `GET /governance` — law counts (total/active/inactive) + the active law
  list (id, action, rule), plus lifecycle case counts by state.
- No mutation route (law updates, case resolution) — read-only from this API.

## Controls

Not a separate data domain — this is the cross-cutting set of every write action
above, called out once so it isn't missed when only "read" groups get screen time:

- MAT: `/think`, `/see`, `/listen`, `/speak`
- System: `/control/start|stop|restart|kill|watchdog-check`
- Activity: `/loops/{id}/pause|start|run-now`
- Memory: `DELETE /memory/user/{id}`, `DELETE /memory/profile`
- Skills: `/skills/{id}/rollback`
- MCP: `/mcp/approvals/{id}/approve|deny`
- Governed Action Queue: `/queue/pending-approval/{id}/approve|reject`
- Models: `/models/select`
- Services: `/services/{id}/start|stop|restart`

Every one of these is a real, callable action against the live backend — none are
speculative. Still not writable from this UI: creating/editing a loop, an MCP
server, or a skill/agent from scratch; editing identity/soul; law/case mutation
in Governance.

## Not included above (present in the contract, not part of a clean group)

- Nothing currently — MCP and the Governed Action Queue (previously the only two
  gaps here) now have their own sections above.
