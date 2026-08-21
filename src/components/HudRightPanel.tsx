import { useState } from 'react'
import type { CSSProperties, FormEvent } from 'react'
import { CAPABILITIES, TIERS, hasMemoryStats } from '../domain/vision'
import type { Capability, ServiceStatus, Tier } from '../domain/vision'
import { useServices } from '../hooks/useServices'
import { useMemoryStats } from '../hooks/useMemoryStats'
import { useModels } from '../hooks/useModels'
import { useBodyControl } from '../hooks/useBodyControl'
import { useServiceControl } from '../hooks/useServiceControl'
import { useModelSelect } from '../hooks/useModelSelect'
import { describeResourceStatus } from '../hooks/useVisionResource'
import './HudRightPanel.css'

/** The two services shown by default — `vision` is the MAT/Body process
 * everything else depends on; the rest live behind "View all services". */
const DEFAULT_SERVICE_IDS = ['vision', 'strategy_engine']

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

function CpuIcon() {
  return (
    <svg viewBox="0 0 16 16" width="13" height="13" fill="none" aria-hidden="true">
      <rect x="4.5" y="4.5" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.3" />
      <circle cx="8" cy="8" r="1.6" stroke="currentColor" strokeWidth="1.1" />
      <path stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" d="M8 1.6v2M8 12.4v2M1.6 8h2M12.4 8h2M3.4 3.4l1.4 1.4M11.2 11.2l1.4 1.4M12.6 3.4l-1.4 1.4M4.8 11.2l-1.4 1.4" />
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

function ServiceIcon() {
  return (
    <svg viewBox="0 0 16 16" width="13" height="13" fill="none" aria-hidden="true">
      <rect x="2" y="4.5" width="12" height="7" rx="1.4" stroke="currentColor" strokeWidth="1.3" />
      <circle cx="5.2" cy="8" r="0.9" fill="currentColor" />
    </svg>
  )
}

/** Toggle "on" position for `running`/`degraded` (the service is up, even
 * if unhealthy) — only `stopped` reads as fully off. `unconfigured`/
 * `unknown_service` can't be toggled at all: there's nothing real to start. */
function isServiceOn(state: ServiceStatus['state']): boolean {
  return state === 'running' || state === 'degraded'
}

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
        className="hud-service-toggle"
        data-state={service.state}
        disabled={!toggleable || pending}
        onClick={onToggle}
      />
    </div>
  )
}

function ModelRoutingCard() {
  const models = useModels()
  const modelSelect = useModelSelect()
  const [capability, setCapability] = useState<Capability>(CAPABILITIES[0])
  const [tier, setTier] = useState<Tier>(TIERS[0])
  const [provider, setProvider] = useState('')
  const [model, setModel] = useState('')

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    modelSelect.select({ capability, tier, provider: provider.trim() || null, model: model.trim() || null }, models.refetch)
  }

  return (
    <section className="hud-right-panel__card">
      <header className="hud-right-panel__card-header">
        <CpuIcon />
        <span>Model Routing</span>
      </header>
      <form className="hud-right-panel__model-form" onSubmit={handleSubmit}>
        <select
          className="hud-right-panel__model-select"
          value={capability}
          onChange={(event) => setCapability(event.target.value as Capability)}
          aria-label="Capability"
        >
          {CAPABILITIES.map((capabilityOption) => (
            <option key={capabilityOption} value={capabilityOption}>
              {capabilityOption}
            </option>
          ))}
        </select>
        <select className="hud-right-panel__model-select" value={tier} onChange={(event) => setTier(event.target.value as Tier)} aria-label="Tier">
          {TIERS.map((tierOption) => (
            <option key={tierOption} value={tierOption}>
              {tierOption}
            </option>
          ))}
        </select>
        <input
          type="text"
          className="hud-right-panel__model-input"
          placeholder="provider"
          value={provider}
          onChange={(event) => setProvider(event.target.value)}
        />
        <input
          type="text"
          className="hud-right-panel__model-input"
          placeholder="model (empty clears slot)"
          value={model}
          onChange={(event) => setModel(event.target.value)}
        />
        <button type="submit" className="hud-control-button hud-control-button--blue hud-control-button--full" disabled={modelSelect.pending}>
          Set
        </button>
      </form>
      {modelSelect.lastResult && <span className="hud-right-panel__note">{modelSelect.lastResult}</span>}
    </section>
  )
}

/**
 * Right control zone — real OS controls (`/control/*`), model routing
 * (`/models/select`), real per-service start/stop/restart
 * (`/services/{id}/start|stop|restart`) with an expand toggle for the rest,
 * and memory usage (`/memory`). No System Metrics or Recent Events section:
 * no throughput/error-rate telemetry or event-log endpoint exists in the
 * VISION API today (see docs/VISION_API_CONTRACT.md) — those would be
 * fabricated, so they're left out rather than faked.
 */
export function HudRightPanel() {
  const services = useServices()
  const memory = useMemoryStats()
  const control = useBodyControl()
  const serviceControl = useServiceControl()
  const [showAllServices, setShowAllServices] = useState(false)

  const allServices = services.data?.services ?? []
  const defaultServices = allServices.filter((service) => DEFAULT_SERVICE_IDS.includes(service.id))
  const otherServices = allServices.filter((service) => !DEFAULT_SERVICE_IDS.includes(service.id))
  const servicesStatus = describeResourceStatus(services)
  const memoryStatus = describeResourceStatus(memory)

  const renderServiceRow = (service: ServiceStatus) => (
    <ServiceRow
      key={service.id}
      service={service}
      pending={serviceControl.pendingId === service.id}
      onToggle={() => serviceControl.toggle(service, services.refetch)}
      onRestart={() => serviceControl.restart(service, services.refetch)}
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
            Start OS
          </button>
          <button
            type="button"
            className="hud-control-button hud-control-button--red"
            onClick={control.stop}
            disabled={control.pending}
          >
            <StopIcon />
            Stop OS
          </button>
          <button
            type="button"
            className="hud-control-button hud-control-button--amber"
            onClick={control.restart}
            disabled={control.pending}
          >
            <RestartIcon />
            Restart
          </button>
          <button
            type="button"
            className="hud-control-button hud-control-button--blue"
            onClick={control.watchdog}
            disabled={control.pending}
          >
            <ShieldIcon />
            Watchdog
          </button>
          <button
            type="button"
            className="hud-control-button hud-control-button--red hud-control-button--full"
            onClick={control.kill}
            disabled={control.pending}
          >
            <KillIcon />
            Force Kill
          </button>
        </div>
        {control.lastResult && <span className="hud-right-panel__note">{control.lastResult}</span>}
      </section>

      <ModelRoutingCard />

      <section className="hud-right-panel__card">
        <header className="hud-right-panel__card-header">
          <span>Service Controls</span>
        </header>
        <div className="hud-right-panel__service-list">
          {servicesStatus ? (
            <span className="hud-right-panel__note">{servicesStatus}</span>
          ) : (
            <>
              {defaultServices.map(renderServiceRow)}
              {showAllServices && otherServices.map(renderServiceRow)}
            </>
          )}
        </div>
        {!servicesStatus && otherServices.length > 0 && (
          <button type="button" className="hud-right-panel__view-all" onClick={() => setShowAllServices((prev) => !prev)}>
            <span>{showAllServices ? 'Hide services' : 'View all services'}</span>
            <span style={{ '--chevron-rotate': showAllServices ? '90deg' : '0deg' } as CSSProperties} className="hud-right-panel__chevron">
              <ChevronIcon />
            </span>
          </button>
        )}
      </section>

      <section className="hud-right-panel__card">
        <header className="hud-right-panel__card-header">
          <DriveIcon />
          <span>Memory Health</span>
        </header>
        {memoryStatus ? (
          <span className="hud-right-panel__note">{memoryStatus}</span>
        ) : memory.data && hasMemoryStats(memory.data.tiers) ? (
          <div className="hud-right-panel__service-list">
            <div className="hud-right-panel__stat-row">
              <span>Total memories</span>
              <span>{memory.data.tiers.total_memories}</span>
            </div>
            <div className="hud-right-panel__stat-row">
              <span>Estimated size</span>
              <span>{formatBytes(memory.data.tiers.estimated_size_bytes)}</span>
            </div>
          </div>
        ) : (
          <span className="hud-right-panel__note">No memory data</span>
        )}
      </section>
    </div>
  )
}
