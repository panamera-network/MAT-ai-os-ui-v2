import type { ReactNode } from 'react'
import type { ConnectionState } from '../hooks/useHealth'
import type { Health } from '../domain/vision'
import { useRuntime } from '../hooks/useRuntime'
import './HudStatus.css'

interface HudStatusProps {
  connection: ConnectionState
  health: Health | null
}

const CORE_STATUS: Record<ConnectionState, string> = {
  checking: 'CONNECTING',
  online: 'ONLINE',
  offline: 'OFFLINE',
}

interface StatusFieldProps {
  chart?: boolean
  className?: string
  label: string
  value: ReactNode
}

function StatusField({ chart = false, className = '', label, value }: StatusFieldProps) {
  return (
    <div className={`hud-status__field${className ? ` ${className}` : ''}`}>
      <span className="hud-status__field-label">{label}</span>
      <span className="hud-status__field-readout">
        <span className="hud-status__field-value">{value}</span>
        {chart && <span className="hud-status__chart-slot" aria-hidden="true" />}
      </span>
    </div>
  )
}

/** Compact header telemetry. MAT Core and Active Model use the real health
 * response. CPU/RAM/GPU/Network are deliberately empty chart-ready slots
 * until a genuine PC-health source exists. Operator/Status is the Electron
 * runtime supervisor's own status (see useRuntime) — '—' outside the
 * Electron shell, where there's no process to supervise. */
export function HudStatus({ connection, health }: HudStatusProps) {
  const ready = connection === 'online' ? health : null
  const runtime = useRuntime()

  return (
    <div className="hud-status">
      <StatusField
        className={`hud-status__field--connection is-${connection}`}
        label="MAT Core"
        value={CORE_STATUS[connection]}
      />
      <StatusField chart label="CPU" value="—" />
      <StatusField chart label="RAM" value="—" />
      <StatusField chart label="GPU" value="—" />
      <StatusField chart label="Network" value="—" />
      <StatusField
        className="hud-status__field--model"
        label="Active Model"
        value={ready ? `${ready.active_model.provider} · ${ready.active_model.model}` : '—'}
      />
      <StatusField label="Operator / Status" value={runtime.status?.message ?? '—'} />
    </div>
  )
}
