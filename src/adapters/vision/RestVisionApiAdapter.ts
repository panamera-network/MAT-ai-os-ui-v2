import type {
  AgentsResult,
  ControlActionResult,
  ControlStatusResult,
  EventsResult,
  GovernanceResult,
  Health,
  IdentityResult,
  KillResult,
  ListenRequest,
  ListenResult,
  LoopsResult,
  McpResult,
  MemoryResult,
  ModelSelectRequest,
  ModelsResult,
  RestartResult,
  SeeRequest,
  SeeResult,
  ServiceActionResult,
  ServiceRestartResult,
  ServiceStartStopResult,
  ServicesResult,
  ServiceStatus,
  SkillsResult,
  SoulResult,
  SpeakRequest,
  SpeakResult,
  StartResult,
  StopResult,
  ThinkRequest,
  ThinkResult,
  WatchdogResult,
} from '../../domain/vision'
import { DEFAULT_VISION_API_CONFIG, type VisionApiConfig } from './config'
import { VisionApiError } from './errors'
import type { VisionApiAdapter } from './VisionApiAdapter'

/**
 * The one implementation of `VisionApiAdapter` that actually talks to the
 * network — every `fetch()` call in this app lives here (see adapters/
 * README.md's "screens depend on the interface, never on `fetch` directly").
 * Endpoints, payloads, auth, and error shapes below all come from
 * docs/VISION_API_CONTRACT.md; nothing here is invented.
 */
export class RestVisionApiAdapter implements VisionApiAdapter {
  private readonly config: VisionApiConfig

  constructor(config: Partial<VisionApiConfig> = {}) {
    this.config = { ...DEFAULT_VISION_API_CONFIG, ...config }
  }

  // ------------------------------------------------------------------
  // Transport — every public method below goes through one of these two.
  // ------------------------------------------------------------------

  private headers(extra?: HeadersInit): Headers {
    const headers = new Headers(extra)
    // Sent on every request, including /health — harmless when auth is
    // disabled server-side (today's default), required once it's turned on
    // for everything except /health (see docs/VISION_API_CONTRACT.md).
    if (this.config.apiKey) headers.set('X-API-Key', this.config.apiKey)
    return headers
  }

  private signal(caller?: AbortSignal): AbortSignal {
    return caller ?? AbortSignal.timeout(this.config.timeoutMs)
  }

  /** Same "caller override wins" rule as `signal()`, but defaulting to the
   * longer reasoning budget — for `think`/`see`/`listen`/`speak` only. */
  private reasoningSignal(caller?: AbortSignal): AbortSignal {
    return caller ?? AbortSignal.timeout(this.config.reasoningTimeoutMs)
  }

  private async errorFor(response: Response): Promise<VisionApiError> {
    let detail = response.statusText || `Request failed: ${response.status}`
    let body: unknown
    try {
      body = await response.json()
      if (body && typeof body === 'object' && 'detail' in body && typeof (body as { detail: unknown }).detail === 'string') {
        detail = (body as { detail: string }).detail
      }
    } catch {
      // Response wasn't JSON (or had no body) — keep the statusText fallback.
      // Every documented error response in the contract is JSON, so this is
      // a defensive fallback, not the expected path.
    }
    return new VisionApiError(`VISION API error ${response.status}: ${detail}`, { status: response.status, detail, body })
  }

  /** GET/POST with a JSON (or empty) body, JSON response. Every VISION route
   * except /see, /listen (multipart) and /speak (binary response) goes
   * through this one path. */
  private async requestJson<T>(path: string, init: RequestInit = {}): Promise<T> {
    const url = `${this.config.baseUrl}${path}`
    let response: Response
    try {
      response = await fetch(url, { ...init, headers: this.headers(init.headers), signal: this.signal(init.signal ?? undefined) })
    } catch (cause) {
      throw new VisionApiError(`Could not reach MAT at ${url} — is the backend running?`, {
        status: 0,
        detail: cause instanceof Error ? cause.message : String(cause),
        cause,
      })
    }
    if (!response.ok) throw await this.errorFor(response)
    return (await response.json()) as T
  }

  private jsonInit(body: unknown): RequestInit {
    return { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
  }

  // ------------------------------------------------------------------
  // MAT — health, soul/identity, think/see/listen/speak
  // ------------------------------------------------------------------

  getHealth(signal?: AbortSignal): Promise<Health> {
    return this.requestJson<Health>('/health', { signal })
  }

  think(request: ThinkRequest, signal?: AbortSignal): Promise<ThinkResult> {
    return this.requestJson<ThinkResult>('/think', { ...this.jsonInit(request), signal: this.reasoningSignal(signal) })
  }

  see(request: SeeRequest, signal?: AbortSignal): Promise<SeeResult> {
    const form = new FormData()
    form.set('prompt', request.prompt)
    for (const image of request.images) form.append('images', image)
    // No Content-Type set here on purpose — fetch derives the correct
    // `multipart/form-data; boundary=...` from the FormData body itself;
    // setting it manually would break the boundary.
    return this.requestJson<SeeResult>('/see', { method: 'POST', body: form, signal: this.reasoningSignal(signal) })
  }

  listen(request: ListenRequest, signal?: AbortSignal): Promise<ListenResult> {
    const form = new FormData()
    form.set('audio', request.audio, request.filename ?? 'audio.webm')
    if (request.session_id) form.set('session_id', request.session_id)
    return this.requestJson<ListenResult>('/listen', { method: 'POST', body: form, signal: this.reasoningSignal(signal) })
  }

  async speak(request: SpeakRequest, signal?: AbortSignal): Promise<SpeakResult> {
    const url = `${this.config.baseUrl}/speak`
    let response: Response
    try {
      response = await fetch(url, { ...this.jsonInit(request), headers: this.headers({ 'Content-Type': 'application/json' }), signal: this.reasoningSignal(signal) })
    } catch (cause) {
      throw new VisionApiError(`Could not reach MAT at ${url} — is the backend running?`, {
        status: 0,
        detail: cause instanceof Error ? cause.message : String(cause),
        cause,
      })
    }
    if (!response.ok) throw await this.errorFor(response)
    const audio = await response.blob()
    return { audio, contentType: response.headers.get('content-type') ?? 'application/octet-stream' }
  }

  getSoul(signal?: AbortSignal): Promise<SoulResult> {
    return this.requestJson<SoulResult>('/soul', { signal })
  }

  getIdentity(signal?: AbortSignal): Promise<IdentityResult> {
    return this.requestJson<IdentityResult>('/identity', { signal })
  }

  // ------------------------------------------------------------------
  // System — Control/Watchdog over the attached body
  // ------------------------------------------------------------------

  getControlStatus(signal?: AbortSignal): Promise<ControlStatusResult> {
    return this.requestJson<ControlStatusResult>('/control/status', { signal })
  }

  startBody(signal?: AbortSignal): Promise<ControlActionResult<StartResult>> {
    return this.requestJson<ControlActionResult<StartResult>>('/control/start', { method: 'POST', signal })
  }

  stopBody(signal?: AbortSignal): Promise<ControlActionResult<StopResult>> {
    return this.requestJson<ControlActionResult<StopResult>>('/control/stop', { method: 'POST', signal })
  }

  restartBody(signal?: AbortSignal): Promise<ControlActionResult<RestartResult>> {
    return this.requestJson<ControlActionResult<RestartResult>>('/control/restart', { method: 'POST', signal })
  }

  killBody(signal?: AbortSignal): Promise<ControlActionResult<KillResult>> {
    return this.requestJson<ControlActionResult<KillResult>>('/control/kill', { method: 'POST', signal })
  }

  checkWatchdog(signal?: AbortSignal): Promise<ControlActionResult<WatchdogResult>> {
    return this.requestJson<ControlActionResult<WatchdogResult>>('/control/watchdog-check', { method: 'POST', signal })
  }

  // ------------------------------------------------------------------
  // Agents / Activity / Memory / Governance / MCP / Skills — all read-only
  // ------------------------------------------------------------------

  getAgents(signal?: AbortSignal): Promise<AgentsResult> {
    return this.requestJson<AgentsResult>('/agents', { signal })
  }

  getLoops(signal?: AbortSignal): Promise<LoopsResult> {
    return this.requestJson<LoopsResult>('/loops', { signal })
  }

  getEvents(limit?: number, signal?: AbortSignal): Promise<EventsResult> {
    const query = limit !== undefined ? `?limit=${encodeURIComponent(limit)}` : ''
    return this.requestJson<EventsResult>(`/events${query}`, { signal })
  }

  getMemory(signal?: AbortSignal): Promise<MemoryResult> {
    return this.requestJson<MemoryResult>('/memory', { signal })
  }

  getGovernance(signal?: AbortSignal): Promise<GovernanceResult> {
    return this.requestJson<GovernanceResult>('/governance', { signal })
  }

  getMcp(signal?: AbortSignal): Promise<McpResult> {
    return this.requestJson<McpResult>('/mcp', { signal })
  }

  getSkills(signal?: AbortSignal): Promise<SkillsResult> {
    return this.requestJson<SkillsResult>('/skills', { signal })
  }

  // ------------------------------------------------------------------
  // Models — MAT's own registry, a fixed matrix, never a discovery catalog
  // ------------------------------------------------------------------

  getModels(signal?: AbortSignal): Promise<ModelsResult> {
    return this.requestJson<ModelsResult>('/models', { signal })
  }

  selectModel(request: ModelSelectRequest, signal?: AbortSignal): Promise<ModelsResult> {
    return this.requestJson<ModelsResult>('/models/select', { ...this.jsonInit(request), signal })
  }

  // ------------------------------------------------------------------
  // Services — fixed, config-driven set; never confuse with the old UI's
  // separate Launcher service (see docs/VISION_API_CONTRACT.md)
  // ------------------------------------------------------------------

  getServices(signal?: AbortSignal): Promise<ServicesResult> {
    return this.requestJson<ServicesResult>('/services', { signal })
  }

  getService(serviceId: string, signal?: AbortSignal): Promise<ServiceStatus> {
    return this.requestJson<ServiceStatus>(`/services/${encodeURIComponent(serviceId)}`, { signal })
  }

  startService(serviceId: string, signal?: AbortSignal): Promise<ServiceActionResult<ServiceStartStopResult>> {
    return this.requestJson<ServiceActionResult<ServiceStartStopResult>>(`/services/${encodeURIComponent(serviceId)}/start`, {
      method: 'POST',
      signal,
    })
  }

  stopService(serviceId: string, signal?: AbortSignal): Promise<ServiceActionResult<ServiceStartStopResult>> {
    return this.requestJson<ServiceActionResult<ServiceStartStopResult>>(`/services/${encodeURIComponent(serviceId)}/stop`, {
      method: 'POST',
      signal,
    })
  }

  restartService(serviceId: string, signal?: AbortSignal): Promise<ServiceActionResult<ServiceRestartResult>> {
    return this.requestJson<ServiceActionResult<ServiceRestartResult>>(`/services/${encodeURIComponent(serviceId)}/restart`, {
      method: 'POST',
      signal,
    })
  }
}
