# V2 Data Surface

What `MAT-AI-OS-UI-V2` can display and control **today**, grouped by concept, derived
strictly from [VISION_API_CONTRACT.md](./VISION_API_CONTRACT.md) — no endpoint here is
invented or planned. This is an inventory, not a screen design: grouping data doesn't
imply one screen per group, a shared screen, or any layout — that's a later,
separately-reviewed decision.

Every group except MAT/System is gated by `body_attached` — if no `V2Body` is
attached (`MAT_BODY_ENABLED=false`), that group's data is empty/default, not an
error. "Read" means a `GET`; "Act" means a `POST` that changes real state.

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
  audio back).
- **Act**: `POST /speak` — send text, get spoken audio back.
- No mutation route for Soul or Identity — both are display-only from this API today.

## System

Process lifecycle for the MAT/Body runtime itself.

- **Read**: `GET /control/status` — body attached / running / degraded components.
- **Act**: `POST /control/start`, `/control/stop`, `/control/restart`,
  `/control/kill`, `/control/watchdog-check`.

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
- No create/pause/resume/delete route exists, even though the underlying engine
  supports all four internally — this API only exposes the read today.

## Memory

- **Read**: `GET /memory` — counts per tier (hot/warm/cold/archive), total memory
  count, estimated size in bytes, plus a `health` object with three independently
  -grounded signals (`module_ready`, `qdrant`, `vector_store_connected` — see
  docs/VISION_API_CONTRACT.md's Memory section).
- No route to browse individual memories, search, or delete — tier statistics only.
- Can legitimately return an empty stats object even when a body is attached (memory
  backend unreachable) — a real, non-error state to design for. `health` is always
  present regardless, since it's computed independently of whether tier stats
  themselves succeeded.

## Skills

- **Read**: `GET /skills` — id, name, domain, description, tools required, prompt
  fragment, optional source/learned-at/auto-generated/mcp-servers/ownership fields.
- No create/update/delete route — read-only.

## Models

MAT's own LLM routing configuration — distinct from Body, never shared with it.

- **Read**: `GET /models` — the full capability × tier matrix
  (8 capabilities × 4 tiers, each slot a `{provider, model}` pair or empty).
- **Act**: `POST /models/select` — set or clear one capability's one tier.
- No discovery/catalog route — this is a fixed matrix the caller edits by hand, not
  a list to browse.

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

Not a separate data domain — this is the cross-cutting set of every `POST` action
above, called out once so it isn't missed when only "read" groups get screen time:

- MAT: `/think`, `/see`, `/listen`, `/speak`
- System: `/control/start|stop|restart|kill|watchdog-check`
- Models: `/models/select`
- Services: `/services/{id}/start|stop|restart`

Every one of these is a real, callable action against the live backend — none are
speculative. Nothing else in the API is currently writable (no way to create a loop,
resolve an MCP approval, edit identity/soul, or manage agents/skills from outside).

## Not included above (present in the contract, not part of a clean group)

- **MCP** (`GET /mcp`) — registered servers + pending tool-call approvals. Left out
  of the ten groups above because the task's own grouping list doesn't name it;
  noted here so it isn't lost. Read-only — no approve/deny route exists yet, so a
  V2 screen could observe pending approvals but couldn't act on them.
