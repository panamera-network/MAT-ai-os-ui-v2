import { useState } from 'react'
import type { CSSProperties } from 'react'
import { hasMemoryStats, isServiceOn } from '../domain/vision'
import type { ServiceStatus } from '../domain/vision'
import { useServices } from '../hooks/useServices'
import { useMemoryStats } from '../hooks/useMemoryStats'
import { useBodyControl } from '../hooks/useBodyControl'
import { useServiceControl } from '../hooks/useServiceControl'
import { describeResourceStatus } from '../hooks/useVisionResource'
import type { AddHudEvent, HudEvent, HudEventTone } from './hudEvents'
import './HudRightPanel.css'

/** The four primary service controls surfaced in the command-center HUD. */
const PRIMARY_SERVICES = [
  { id: 'strategy_engine', label: 'Strategy Engine' },
  { id: 'engine_dashboard', label: 'Engine Dashboard' },
  { id: 'os_ui_mobile', label: 'OS UI Mobile' },
  { id: 'mk1_x', label: 'MK1-X' },
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

function formatEventTime(timestamp: number): string {
  return new Intl.DateTimeFormat(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(new Date(timestamp))
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

function RecentEvents({ events }: { events: HudEvent[] }) {
  const [expanded, setExpanded] = useState(false)
  const visibleEvents = expanded ? events : events.slice(0, 5)

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
            <span className="hud-right-panel__events-empty">Actions in this session will appear here.</span>
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
  const [showAllServices, setShowAllServices] = useState(false)

  const allServices = services.data?.services ?? []
  const primaryServiceSlots = PRIMARY_SERVICES.map((target) => ({
    ...target,
    service: allServices.find((service) => service.id === target.id),
  }))
  const otherServices = allServices.filter((service) => !DEFAULT_SERVICE_IDS.includes(service.id))
  const servicesStatus = describeResourceStatus(services)
  const memoryStats = memory.data && hasMemoryStats(memory.data.tiers) ? memory.data.tiers : null
  const memoryLoading = memory.loading && !memory.data
  const qdrantState = memoryStats
    ? 'online'
    : memory.data?.body_attached
      ? 'degraded'
      : memory.error && !memory.error.unreachable
        ? 'degraded'
        : memoryLoading
          ? 'checking'
          : 'offline'
  const memoryModuleState = memoryStats ? 'ready' : 'unavailable'
  const vectorStoreState = memoryStats ? 'connected' : 'disconnected'
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

  const runControl = (label: string, tone: HudEventTone, action: () => void) => {
    onEvent(`${label} requested`, tone)
    action()
  }

  const renderServiceRow = (service: ServiceStatus) => (
    <ServiceRow
      key={service.id}
      service={service}
      pending={serviceControl.pendingId === service.id}
      onToggle={() => {
        const stopping = isServiceOn(service.state)
        onEvent(`${stopping ? 'Stop' : 'Start'} ${service.display_name} requested`, stopping ? 'warning' : 'success')
        serviceControl.toggle(service, services.refetch)
      }}
      onRestart={() => {
        onEvent(`${service.display_name} restart requested`, 'warning')
        serviceControl.restart(service, services.refetch)
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
            onClick={() => runControl('Start OS', 'success', control.start)}
            disabled={control.pending}
          >
            <PlayIcon />
            Start OS
          </button>
          <button
            type="button"
            className="hud-control-button hud-control-button--red"
            onClick={() => runControl('Stop OS', 'danger', control.stop)}
            disabled={control.pending}
          >
            <StopIcon />
            Stop OS
          </button>
          <button
            type="button"
            className="hud-control-button hud-control-button--amber"
            onClick={() => runControl('Restart OS', 'warning', control.restart)}
            disabled={control.pending}
          >
            <RestartIcon />
            Restart
          </button>
          <button
            type="button"
            className="hud-control-button hud-control-button--blue"
            onClick={() => runControl('Watchdog check', 'info', control.watchdog)}
            disabled={control.pending}
          >
            <ShieldIcon />
            Watchdog
          </button>
          <button
            type="button"
            className="hud-control-button hud-control-button--red hud-control-button--full"
            onClick={() => runControl('Force kill', 'danger', control.kill)}
            disabled={control.pending}
          >
            <KillIcon />
            Force Kill
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

      <RecentEvents events={events} />
    </div>
  )
}
