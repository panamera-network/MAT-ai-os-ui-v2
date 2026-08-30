import { useEffect, useMemo, useState } from 'react'
import type { CSSProperties } from 'react'
import { hasMemoryStats, isServiceOn } from '../domain/vision'
import type { LearnSuggestionDetail, LearnSuggestionSummary, ServiceStatus, VisionEventEntry } from '../domain/vision'
import { useServices } from '../hooks/useServices'
import { useMemoryStats } from '../hooks/useMemoryStats'
import { useBodyControl } from '../hooks/useBodyControl'
import { useServiceControl } from '../hooks/useServiceControl'
import { useEvents } from '../hooks/useEvents'
import { usePendingLearn } from '../hooks/usePendingLearn'
import { describeResourceStatus } from '../hooks/useVisionResource'
import type { AddHudEvent, HudEvent, HudEventTone } from './hudEvents'
import './HudRightPanel.css'

/** The four primary service controls surfaced in the command-center HUD. */
const PRIMARY_SERVICES = [
  { id: 'strategy_engine', label: 'Strategy Engine' },
  { id: 'engine_dashboard', label: 'Engine Dashboard' },
  { id: 'os_ui_mobile', label: 'OS UI Mobile' },
  { id: 'mk1', label: 'MK1' },
  { id: 'mk1_mobile', label: 'MK1 Mobile' },
]

const DEFAULT_SERVICE_IDS = PRIMARY_SERVICES.map((service) => service.id)

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function GearIcon() {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" fill="none" aria-hidden="true">
      <circle cx="8" cy="8" r="2.4" stroke="currentColor" strokeWidth="1.4" />
      <path
        stroke="currentColor"
        strokeWidth="1.4"
        d="M8 1.6v1.6M8 12.8v1.6M14.4 8h-1.6M3.2 8H1.6M12.2 3.8l-1.1 1.1M4.9 11.1l-1.1 1.1M12.2 12.2l-1.1-1.1M4.9 4.9 3.8 3.8"
      />
    </svg>
  )
}

function PlayIcon() {
  return (
    <svg viewBox="0 0 16 16" width="12" height="12" fill="none" aria-hidden="true">
      <path d="M4.5 2.8v10.4l9-5.2-9-5.2Z" fill="currentColor" />
    </svg>
  )
}

function StopIcon() {
  return (
    <svg viewBox="0 0 16 16" width="12" height="12" fill="none" aria-hidden="true">
      <rect x="3.5" y="3.5" width="9" height="9" rx="1" fill="currentColor" />
    </svg>
  )
}

function RestartIcon() {
  return (
    <svg viewBox="0 0 16 16" width="12" height="12" fill="none" aria-hidden="true">
      <path
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        d="M13 8A5 5 0 1 1 11.2 4.2M13 2.4v3.2h-3.2"
      />
    </svg>
  )
}

function ShieldIcon() {
  return (
    <svg viewBox="0 0 16 16" width="12" height="12" fill="none" aria-hidden="true">
      <path
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
        d="M8 1.6 13.2 3.4v3.9c0 3.4-2.2 5.9-5.2 7.1-3-1.2-5.2-3.7-5.2-7.1V3.4L8 1.6Z"
      />
    </svg>
  )
}

function KillIcon() {
  return (
    <svg viewBox="0 0 16 16" width="12" height="12" fill="none" aria-hidden="true">
      <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.4" />
      <path stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" d="M5.5 5.5l5 5M10.5 5.5l-5 5" />
    </svg>
  )
}

function ChevronIcon() {
  return (
    <svg viewBox="0 0 16 16" width="11" height="11" fill="none" aria-hidden="true">
      <path stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" d="m6 3.5 5 4.5-5 4.5" />
    </svg>
  )
}

function DriveIcon() {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" fill="none" aria-hidden="true">
      <rect x="1.8" y="2.5" width="12.4" height="11" rx="1.4" stroke="currentColor" strokeWidth="1.3" />
      <path stroke="currentColor" strokeWidth="1.3" d="M1.8 7.2h12.4" />
      <circle cx="4" cy="10" r="0.9" fill="currentColor" />
    </svg>
  )
}

function MemoryStackIcon() {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" fill="none" aria-hidden="true">
      <path d="m4 8 8-4 8 4-8 4-8-4Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
      <path d="m4 12 8 4 8-4M4 16l8 4 8-4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function ServiceIcon() {
  return (
    <svg viewBox="0 0 16 16" width="13" height="13" fill="none" aria-hidden="true">
      <rect x="2" y="4.5" width="12" height="7" rx="1.4" stroke="currentColor" strokeWidth="1.3" />
      <circle cx="5.2" cy="8" r="0.9" fill="currentColor" />
    </svg>
  )
}

function EventsIcon() {
  return (
    <svg viewBox="0 0 16 16" width="13" height="13" fill="none" aria-hidden="true">
      <path stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" d="M3 3.5h10M3 8h10M3 12.5h10" />
      <circle cx="3" cy="3.5" r="1.2" fill="currentColor" />
      <circle cx="3" cy="8" r="1.2" fill="currentColor" />
      <circle cx="3" cy="12.5" r="1.2" fill="currentColor" />
    </svg>
  )
}

/** Recent Events audit: this used to be time-only, always -- ambiguous for
 * anything not from today (the backend half of the merged feed can be
 * hours/days old, see `useEvents`'s own doc comment). Same clock-time
 * format for today's events (unchanged, the common case); a short date is
 * prefixed only for an event from an earlier day. */
function formatEventTime(timestamp: number): string {
  const date = new Date(timestamp)
  const time = new Intl.DateTimeFormat(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(date)
  if (date.toDateString() === new Date().toDateString()) return time
  const day = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(date)
  return `${day} ${time}`
}

/** Recent Events audit: the collapsed view's own "which N to show" pick was
 * pure recency (`events.slice(0, limit)`) -- a burst of routine successes
 * could silently push a recent failure out of view. `danger` candidates are
 * now chosen first, then `warning`, then everything else -- `Array.sort` is
 * stable, so ties keep their original (already newest-first) relative
 * order, and the final selection is re-sorted back to newest-first for
 * display, since this stays a chronological log, never a priority queue.
 * A no-op (returns `events` as-is) once there are `limit` or fewer. */
const EVENT_TONE_PRIORITY: Record<HudEventTone, number> = { danger: 0, warning: 1, success: 2, info: 2 }

function selectVisibleEvents(events: HudEvent[], limit: number): HudEvent[] {
  if (events.length <= limit) return events
  const prioritized = [...events].sort((a, b) => EVENT_TONE_PRIORITY[a.tone] - EVENT_TONE_PRIORITY[b.tone])
  const selected = new Set(prioritized.slice(0, limit))
  return events.filter((event) => selected.has(event))
}

/** Real backend activity (`GET /events`) into the same `HudEvent` shape the
 * session-local click log already uses — one merged, chronological feed,
 * same row rendering either way. `severity`/`tone` share their exact union
 * type already (`api/schemas.py::EventEntry` <-> `hudEvents.ts`), so this is
 * a reshape, never a remapping. */
function toHudEvent(entry: VisionEventEntry): HudEvent {
  return {
    id: `backend-${entry.id}`,
    timestamp: new Date(entry.timestamp).getTime(),
    message: entry.message,
    tone: entry.severity,
  }
}

/** `unconfigured`/`unknown_service` can't be toggled at all: there's nothing
 * real to start. */
function isServiceToggleable(state: ServiceStatus['state']): boolean {
  return state === 'running' || state === 'degraded' || state === 'stopped'
}

function ServiceRow({
  service,
  pending,
  onToggle,
  onRestart,
}: {
  service: ServiceStatus
  pending: boolean
  onToggle: () => void
  onRestart: () => void
}) {
  const on = isServiceOn(service.state)
  const toggleable = isServiceToggleable(service.state)

  return (
    <div className="hud-service-row">
      <span className="hud-service-row__icon">
        <ServiceIcon />
      </span>
      <span className="hud-service-row__name">{service.display_name}</span>
      <span className={`hud-service-row__state hud-service-row__state--${service.state}`}>{service.state}</span>
      <button
        type="button"
        className="hud-service-row__restart"
        aria-label={`Restart ${service.display_name}`}
        disabled={!toggleable || pending}
        onClick={onRestart}
      >
        <RestartIcon />
      </button>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label={`${on ? 'Stop' : 'Start'} ${service.display_name}`}
        className={`hud-service-power hud-service-power--${on ? 'stop' : 'start'}`}
        data-state={service.state}
        disabled={!toggleable || pending}
        onClick={onToggle}
      >
        {on ? <StopIcon /> : <PlayIcon />}
      </button>
    </div>
  )
}

function UnavailableServiceRow({ label, status }: { label: string; status: string }) {
  return (
    <div className="hud-service-row">
      <span className="hud-service-row__icon"><ServiceIcon /></span>
      <span className="hud-service-row__name">{label}</span>
      <span className="hud-service-row__state">{status}</span>
      <button type="button" className="hud-service-row__restart" aria-label={`Restart ${label}`} disabled>
        <RestartIcon />
      </button>
      <button type="button" className="hud-service-power hud-service-power--start" aria-label={`Start ${label}`} disabled>
        <PlayIcon />
      </button>
    </div>
  )
}

function LearnApprovalIcon() {
  return (
    <svg viewBox="0 0 16 16" width="13" height="13" fill="none" aria-hidden="true">
      <path d="M8 1.6 13.2 3.4v3.9c0 3.4-2.2 5.9-5.2 7.1-3-1.2-5.2-3.7-5.2-7.1V3.4L8 1.6Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
      <path d="M5.6 8.1 7.3 9.8l3.1-3.6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function formatSuggestionTime(iso: string): string {
  const parsed = new Date(iso)
  if (Number.isNaN(parsed.getTime())) return iso
  return new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit', hour12: false }).format(parsed)
}

interface PendingLearnRowProps {
  suggestion: LearnSuggestionSummary
  busy: boolean
  lastResult: { suggestionId: string; status: string; reason: string } | null
  fetchDetail: (suggestionId: string) => Promise<LearnSuggestionDetail>
  onResolve: (suggestionId: string, action: 'approve' | 'reject') => void
}

/** One pending `new_domain` suggestion — a real `LearnSuggestionManager`
 * record, never fabricated. Collapsed shows just enough to recognize it
 * (domain + reason); expanding fetches the real `GET /learn/pending/{id}`
 * detail (the proposed skill's own name/description/prompt fragment) so an
 * operator can actually judge WHY MAT wants to learn this before acting. */
function PendingLearnRow({ suggestion, busy, lastResult, fetchDetail, onResolve }: PendingLearnRowProps) {
  const [expanded, setExpanded] = useState(false)
  const [detail, setDetail] = useState<LearnSuggestionDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  const toggle = () => {
    const next = !expanded
    setExpanded(next)
    if (next && !detail) {
      setDetailLoading(true)
      fetchDetail(suggestion.id)
        .then(setDetail)
        .catch(() => {
          // A failed detail fetch just means the row stays collapsed-ish
          // (no proposed name/description/prompt) — the summary fields
          // already shown are still real and still enough to Approve/Reject.
        })
        .finally(() => setDetailLoading(false))
    }
  }

  const result = lastResult?.suggestionId === suggestion.id ? lastResult : null

  const isDeferred = suggestion.status === 'deferred'

  return (
    <div className={`hud-pending-learn-row${isDeferred ? ' is-deferred' : ''}`}>
      <button type="button" className="hud-pending-learn-row__summary" onClick={toggle} aria-expanded={expanded}>
        <span className="hud-pending-learn-row__dot" aria-hidden="true" />
        {isDeferred && <span className="hud-pending-learn-row__badge">Deferred</span>}
        <span className="hud-pending-learn-row__domain">{suggestion.domain ?? suggestion.operation}</span>
        <span className="hud-pending-learn-row__reason">{suggestion.reason}</span>
        <time>{formatSuggestionTime(suggestion.created_at)}</time>
      </button>
      {expanded && (
        <div className="hud-pending-learn-row__detail">
          {detailLoading && <span className="hud-pending-learn-row__loading">Loading detail…</span>}
          {detail && (
            <>
              <div className="hud-pending-learn-row__field">
                <span>Proposed skill</span>
                <strong>{detail.proposed.name ?? suggestion.target_skill_id ?? '—'}</strong>
              </div>
              {detail.proposed.description && <p className="hud-pending-learn-row__description">{detail.proposed.description}</p>}
              {detail.proposed.prompt_fragment && (
                <p className="hud-pending-learn-row__fragment">{detail.proposed.prompt_fragment}</p>
              )}
            </>
          )}
          {result ? (
            <span className={`hud-pending-learn-row__result hud-pending-learn-row__result--${result.status}`}>
              {result.status === 'reviewed' ? 'Reviewed — pending promotion.' : result.status === 'rejected' ? 'Rejected.' : `Failed — ${result.reason}`}
            </span>
          ) : (
            <div className="hud-pending-learn-row__actions">
              <button type="button" className="hud-pending-learn-row__approve" disabled={busy} onClick={() => onResolve(suggestion.id, 'approve')}>
                Approve
              </button>
              <button type="button" className="hud-pending-learn-row__reject" disabled={busy} onClick={() => onResolve(suggestion.id, 'reject')}>
                Reject
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/** `resolve`'s real result, one HUD event per resolution — 'reviewed' (the
 * approved decision's Knowledge Note cleared the mandatory gate — NOT yet a
 * written skill) reads as success, 'rejected' as a deliberate (not
 * alarming) warning, anything else (a real failure) as danger. Never
 * fabricated: the message names the exact real status `usePendingLearn`
 * returned. */
function resultEventTone(status: string): HudEventTone {
  if (status === 'reviewed') return 'success'
  if (status === 'rejected') return 'warning'
  return 'danger'
}

/** Real `GET /learn/pending` queue — the operator-review half of the
 * new-domain Learn flow (`/learn` itself auto-confirms create/improve;
 * only a brand-new domain ever lands here). Never mixed with MCP's own
 * pending-approvals count in the left panel — a different approval
 * concept entirely, no shared abstraction exists to fold them into.
 *
 * Batch A: every real approve/reject result now also lands in Recent
 * Events (`onEvent`), not just the row's own inline result text — fires
 * exactly once per resolution, keyed on `lastResult`'s own object identity
 * (a fresh object every real resolve, never on an unrelated re-render). */
function PendingLearnCard({ onEvent }: { onEvent: AddHudEvent }) {
  const { suggestions, loading, pendingId, lastResult, resolve, fetchDetail } = usePendingLearn()

  useEffect(() => {
    if (!lastResult) return
    const message = lastResult.status === 'reviewed'
      ? 'Learn suggestion approved'
      : lastResult.status === 'rejected'
        ? 'Learn suggestion rejected'
        : `Learn suggestion failed — ${lastResult.reason}`
    onEvent(message, resultEventTone(lastResult.status))
  }, [lastResult, onEvent])

  if (!loading && suggestions.length === 0) return null

  return (
    <section className="hud-right-panel__card hud-pending-learn-card">
      <header className="hud-right-panel__card-header">
        <LearnApprovalIcon />
        <span>Learn Approvals</span>
        {suggestions.length > 0 && <span className="hud-pending-learn-card__count">{suggestions.length}</span>}
      </header>
      <div className="hud-pending-learn-card__list">
        {loading && suggestions.length === 0 ? (
          <span className="hud-right-panel__events-empty">Loading…</span>
        ) : (
          suggestions.map((suggestion) => (
            <PendingLearnRow
              key={suggestion.id}
              suggestion={suggestion}
              busy={pendingId === suggestion.id}
              lastResult={lastResult}
              fetchDetail={fetchDetail}
              onResolve={resolve}
            />
          ))
        )}
      </div>
    </section>
  )
}

function RecentEvents({ events }: { events: HudEvent[] }) {
  const [expanded, setExpanded] = useState(false)
  // "View all" shows the complete chronological log, unchanged -- priority
  // selection only matters for the collapsed view, where something has to
  // be left out.
  const visibleEvents = expanded ? events : selectVisibleEvents(events, 5)

  return (
    <div className="hud-right-panel__events-slot">
      <section className={`hud-right-panel__card hud-right-panel__events-card${expanded ? ' is-expanded' : ''}`}>
        <header className="hud-right-panel__card-header hud-right-panel__events-header">
          <span className="hud-right-panel__events-title">
            <EventsIcon />
            Recent Events
          </span>
          <button
            type="button"
            className="hud-right-panel__events-header-toggle"
            onClick={() => setExpanded((current) => !current)}
            aria-expanded={expanded}
          >
            {expanded ? 'Collapse' : 'View all'}
          </button>
        </header>
        <div className="hud-right-panel__events-list">
          {visibleEvents.length > 0 ? visibleEvents.map((event) => (
            <div key={event.id} className="hud-event-row">
              <span className={`hud-event-row__dot hud-event-row__dot--${event.tone}`} aria-hidden="true" />
              <time dateTime={new Date(event.timestamp).toISOString()}>{formatEventTime(event.timestamp)}</time>
              <span className="hud-event-row__message">{event.message}</span>
            </div>
          )) : (
            <span className="hud-right-panel__events-empty">MAT activity and session actions will appear here.</span>
          )}
        </div>
      </section>
    </div>
  )
}

interface HudRightPanelProps {
  events: HudEvent[]
  onEvent: AddHudEvent
}

/** Right-side controls, memory health, and honest session-local actions. */
export function HudRightPanel({ events, onEvent }: HudRightPanelProps) {
  const services = useServices()
  const memory = useMemoryStats()
  const control = useBodyControl()
  const serviceControl = useServiceControl()
  const backendEvents = useEvents()
  const [showAllServices, setShowAllServices] = useState(false)

  // Real MAT activity (error log + learning analytics, merged server-side)
  // alongside this session's own UI-action markers — two genuinely different
  // kinds of "what happened", shown in one chronological feed rather than
  // replacing one with the other.
  const mergedEvents = useMemo(() => {
    const fromBackend = (backendEvents.data?.events ?? []).map(toHudEvent)
    return [...events, ...fromBackend].sort((a, b) => b.timestamp - a.timestamp)
  }, [events, backendEvents.data])

  const allServices = services.data?.services ?? []
  const primaryServiceSlots = PRIMARY_SERVICES.map((target) => ({
    ...target,
    service: allServices.find((service) => service.id === target.id),
  }))
  const otherServices = allServices.filter((service) => !DEFAULT_SERVICE_IDS.includes(service.id))
  const servicesStatus = describeResourceStatus(services)
  const memoryStats = memory.data && hasMemoryStats(memory.data.tiers) ? memory.data.tiers : null
  const memoryLoading = memory.loading && !memory.data
  const health = memory.data?.health
  /** `GET /memory`'s `health` field carries three independently-grounded
   * signals (see docs/VISION_API_CONTRACT.md's Memory section) — each row
   * below reflects its own real field, never one shared bit relabeled three
   * ways. Before a response exists at all (still loading, or the request
   * failed outright) there's no per-row signal yet to disagree over, so all
   * three share one fallback severity in row-appropriate wording; once
   * `health` exists, each row is independent and can genuinely disagree
   * with the others (e.g. Qdrant back online while this manager instance
   * hasn't reconnected yet). */
  const fallbackSeverity: 'checking' | 'degraded' | 'offline' = memoryLoading
    ? 'checking'
    : memory.error && !memory.error.unreachable
      ? 'degraded'
      : 'offline'
  const qdrantState = !health
    ? fallbackSeverity
    : health.qdrant === 'unknown'
      ? 'checking'
      : health.qdrant
  const memoryModuleState = !health
    ? fallbackSeverity === 'offline'
      ? 'unavailable'
      : fallbackSeverity
    : health.module_ready
      ? 'ready'
      : 'unavailable'
  const vectorStoreState = !health
    ? fallbackSeverity === 'offline'
      ? 'disconnected'
      : fallbackSeverity
    : health.vector_store_connected
      ? 'connected'
      : 'disconnected'
  const tierMetrics = [
    { label: 'Hot', value: memoryStats?.counts.hot ?? 0 },
    { label: 'Warm', value: memoryStats?.counts.warm ?? 0 },
    { label: 'Cold', value: memoryStats?.counts.cold ?? 0 },
    { label: 'Archive', value: memoryStats?.counts.archive ?? 0 },
  ]
  const maxTierCount = Math.max(1, ...tierMetrics.map((tierMetric) => tierMetric.value))
  const activeShare = memoryStats && memoryStats.total_memories > 0
    ? Math.round(((memoryStats.counts.hot + memoryStats.counts.warm) / memoryStats.total_memories) * 100)
    : 0
  const memoryNote = memory.error?.detail
    ?? (memory.data?.body_attached && !memoryStats ? 'Memory backend returned no statistics.' : null)

  // Service Controls audit: this used to log "X requested" at CLICK time,
  // before the result was known -- Recent Events never actually reflected
  // what happened, success or failure. Now logs the real, already-honest
  // `control.lastResult` once it's known, tagged by what actually happened
  // (`lastOk`) rather than a guess made before the request even ran.
  useEffect(() => {
    if (control.lastResult === null) return
    onEvent(control.lastResult, control.lastOk ? 'success' : 'danger')
  }, [control.lastResult, control.lastOk, onEvent])

  const renderServiceRow = (service: ServiceStatus) => (
    <ServiceRow
      key={service.id}
      service={service}
      pending={serviceControl.pendingId === service.id}
      onToggle={() => {
        const stopping = isServiceOn(service.state)
        const verb = stopping ? 'Stop' : 'Start'
        serviceControl.toggle(service, (result) => {
          onEvent(
            result.ok ? `${verb} ${service.display_name} succeeded` : `${verb} ${service.display_name} failed: ${result.detail}`,
            result.ok ? 'success' : 'danger',
          )
          services.refetch()
        })
      }}
      onRestart={() => {
        serviceControl.restart(service, (result) => {
          onEvent(
            result.ok ? `${service.display_name} restart succeeded` : `${service.display_name} restart failed: ${result.detail}`,
            result.ok ? 'success' : 'danger',
          )
          services.refetch()
        })
      }}
    />
  )

  return (
    <div className="hud-right-panel">
      <section className="hud-right-panel__card hud-right-panel__card--controls">
        <header className="hud-right-panel__card-header">
          <GearIcon />
          <span>Controls</span>
        </header>
        <div className="hud-right-panel__control-grid">
          <button
            type="button"
            className="hud-control-button hud-control-button--blue"
            onClick={control.start}
            disabled={control.pending}
          >
            <PlayIcon />
            {control.pendingLabel === 'Start' ? 'Starting…' : 'Start OS'}
          </button>
          <button
            type="button"
            className="hud-control-button hud-control-button--red"
            onClick={control.stop}
            disabled={control.pending}
          >
            <StopIcon />
            {control.pendingLabel === 'Stop' ? 'Stopping…' : 'Stop OS'}
          </button>
          <button
            type="button"
            className="hud-control-button hud-control-button--amber"
            onClick={control.restart}
            disabled={control.pending}
          >
            <RestartIcon />
            {control.pendingLabel === 'Restart' ? 'Restarting…' : 'Restart'}
          </button>
          <button
            type="button"
            className="hud-control-button hud-control-button--blue"
            onClick={control.watchdog}
            disabled={control.pending}
          >
            <ShieldIcon />
            {control.pendingLabel === 'Watchdog' ? 'Checking…' : 'Watchdog'}
          </button>
          <button
            type="button"
            className="hud-control-button hud-control-button--red hud-control-button--full"
            onClick={control.kill}
            disabled={control.pending}
          >
            <KillIcon />
            {control.pendingLabel === 'Kill' ? 'Killing…' : 'Force Kill'}
          </button>
        </div>
        {control.lastResult && <span className="hud-right-panel__note">{control.lastResult}</span>}
        <div className="hud-right-panel__subsection">
          <header className="hud-right-panel__subsection-header">
            <ServiceIcon />
            <span>Service Controls</span>
          </header>
          <div className="hud-right-panel__service-list">
            {primaryServiceSlots.map(({ id, label, service }) => (
              service
                ? renderServiceRow(service)
                : <UnavailableServiceRow key={id} label={label} status={servicesStatus ?? 'Unavailable'} />
            ))}
            {showAllServices && otherServices.map(renderServiceRow)}
          </div>
          {!servicesStatus && otherServices.length > 0 && (
            <button type="button" className="hud-right-panel__view-all" onClick={() => setShowAllServices((prev) => !prev)}>
              <span>{showAllServices ? 'Hide services' : 'View all services'}</span>
              <span style={{ '--chevron-rotate': showAllServices ? '90deg' : '0deg' } as CSSProperties} className="hud-right-panel__chevron">
                <ChevronIcon />
              </span>
            </button>
          )}
        </div>
      </section>

      <PendingLearnCard onEvent={onEvent} />

      <section className="hud-right-panel__card hud-right-panel__memory-card">
        <header className="hud-right-panel__card-header hud-memory__header">
          <span className="hud-memory__title"><DriveIcon />Memory</span>
          <span className={`hud-memory__headline hud-memory__headline--${qdrantState}`}>
            {memoryStats ? `${memoryStats.total_memories.toLocaleString()} memories` : qdrantState}
          </span>
        </header>
        <div className="hud-memory__main">
          <div className="hud-memory__emblem"><MemoryStackIcon /></div>
          <div className="hud-memory__metrics">
            <div className="hud-memory__summary">
              <span>Estimated size</span>
              <strong>{memoryStats ? formatBytes(memoryStats.estimated_size_bytes) : '—'}</strong>
            </div>
            <div className="hud-memory__tier-grid">
              {tierMetrics.map((tierMetric) => (
                <div key={tierMetric.label} className="hud-memory__tier">
                  <span>{tierMetric.label}</span>
                  <strong>{tierMetric.value.toLocaleString()}</strong>
                  <span className="hud-memory__tier-track">
                    <span style={{ '--memory-tier-fill': `${(tierMetric.value / maxTierCount) * 100}%` } as CSSProperties} />
                  </span>
                </div>
              ))}
            </div>
          </div>
          <div
            className="hud-memory__ring"
            style={{ '--memory-active-share': `${activeShare * 3.6}deg` } as CSSProperties}
            aria-label={`Active tier share ${activeShare}%`}
          >
            <span><strong>{activeShare}%</strong>active</span>
          </div>
        </div>
        <div className="hud-memory__status-grid">
          <div><span>Qdrant</span><strong className={`is-${qdrantState}`}>{qdrantState}</strong></div>
          <div><span>Memory module</span><strong className={`is-${memoryModuleState}`}>{memoryModuleState}</strong></div>
          <div><span>Vector store</span><strong className={`is-${vectorStoreState}`}>{vectorStoreState}</strong></div>
        </div>
        {memoryNote && <div className="hud-memory__error"><span>Last state</span>{memoryNote}</div>}
      </section>

      <RecentEvents events={mergedEvents} />
    </div>
  )
}
