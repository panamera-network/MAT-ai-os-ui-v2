import type {
  AgentsResult,
  ControlActionResult,
  ControlStatusResult,
  DocumentReadResult,
  EventsResult,
  GovernanceResult,
  Health,
  IdentityResult,
  KillResult,
  LearnRequest,
  LearnResult,
  LearnSuggestionDetail,
  ListenRequest,
  ListenResult,
  LoopsResult,
  McpResult,
  MemoryResult,
  ModelSelectRequest,
  ModelsResult,
  PendingLearnSuggestionsResult,
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

/**
 * Everything a screen can ask VISION for, expressed as one interface so a
 * screen depends on this shape, never on `fetch` or a base URL. `rest/`
 * (not built yet at the time this was written, see adapters/README.md) is
 * the only implementation today; a future `mock/` implementation for
 * fixture-driven UI work implements the exact same interface.
 *
 * Every method throws `VisionApiError` (see errors.ts) on failure — network-
 * unreachable and a real HTTP error status are both represented there, never
 * as a return value a caller could forget to check.
 */
export interface VisionApiAdapter {
  getHealth(signal?: AbortSignal): Promise<Health>

  think(request: ThinkRequest, signal?: AbortSignal): Promise<ThinkResult>
  see(request: SeeRequest, signal?: AbortSignal): Promise<SeeResult>
  readDocument(file: File, signal?: AbortSignal): Promise<DocumentReadResult>
  listen(request: ListenRequest, signal?: AbortSignal): Promise<ListenResult>
  speak(request: SpeakRequest, signal?: AbortSignal): Promise<SpeakResult>
  learn(request: LearnRequest, signal?: AbortSignal): Promise<LearnResult>
  getPendingLearnSuggestions(signal?: AbortSignal): Promise<PendingLearnSuggestionsResult>
  getLearnSuggestion(suggestionId: string, signal?: AbortSignal): Promise<LearnSuggestionDetail>
  approveLearnSuggestion(suggestionId: string, signal?: AbortSignal): Promise<LearnResult>
  rejectLearnSuggestion(suggestionId: string, signal?: AbortSignal): Promise<LearnResult>

  getSoul(signal?: AbortSignal): Promise<SoulResult>
  getIdentity(signal?: AbortSignal): Promise<IdentityResult>

  getControlStatus(signal?: AbortSignal): Promise<ControlStatusResult>
  startBody(signal?: AbortSignal): Promise<ControlActionResult<StartResult>>
  stopBody(signal?: AbortSignal): Promise<ControlActionResult<StopResult>>
  restartBody(signal?: AbortSignal): Promise<ControlActionResult<RestartResult>>
  killBody(signal?: AbortSignal): Promise<ControlActionResult<KillResult>>
  checkWatchdog(signal?: AbortSignal): Promise<ControlActionResult<WatchdogResult>>

  getAgents(signal?: AbortSignal): Promise<AgentsResult>
  getLoops(signal?: AbortSignal): Promise<LoopsResult>
  getEvents(limit?: number, signal?: AbortSignal): Promise<EventsResult>
  getMemory(signal?: AbortSignal): Promise<MemoryResult>
  getGovernance(signal?: AbortSignal): Promise<GovernanceResult>
  getMcp(signal?: AbortSignal): Promise<McpResult>
  getSkills(signal?: AbortSignal): Promise<SkillsResult>

  getModels(signal?: AbortSignal): Promise<ModelsResult>
  selectModel(request: ModelSelectRequest, signal?: AbortSignal): Promise<ModelsResult>

  getServices(signal?: AbortSignal): Promise<ServicesResult>
  getService(serviceId: string, signal?: AbortSignal): Promise<ServiceStatus>
  startService(serviceId: string, signal?: AbortSignal): Promise<ServiceActionResult<ServiceStartStopResult>>
  stopService(serviceId: string, signal?: AbortSignal): Promise<ServiceActionResult<ServiceStartStopResult>>
  restartService(serviceId: string, signal?: AbortSignal): Promise<ServiceActionResult<ServiceRestartResult>>
}
