/**
 * Vocabulary shared across more than one VISION API route — kept here once so
 * `mat.ts`/`system.ts`/`services.ts` (which all touch the same underlying
 * body lifecycle) don't each redeclare it slightly differently. See
 * docs/VISION_API_CONTRACT.md's "Error conventions" section for the
 * `body_attached: false` degradation this reflects.
 */

/** `Control.status()`'s own shape (iammat/control/supervisor.py) — reused
 * verbatim by `GET /health`'s `body` field, `GET /control/status`'s `result`,
 * and the `vision` service's own `detail` under `GET /services/vision`. */
export interface BodyStatus {
  body_attached: boolean
  running: boolean
  /** Component names only — never a reason or config, by design. */
  degraded: string[]
}

/**
 * The recurring "this route reads from `mat.body`, so it degrades to
 * `body_attached: false` + empty/default data instead of a 500 when no body
 * is attached" envelope — `/agents`, `/loops`, `/memory`, `/governance`,
 * `/mcp`, `/skills` all share exactly this shape around their own payload.
 */
export type BodyScoped<T extends object> = { body_attached: boolean } & T
