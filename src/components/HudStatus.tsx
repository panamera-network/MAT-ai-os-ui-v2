import type { ReactNode } from 'react'
import type { ConnectionState } from '../hooks/useHealth'
import type { Health } from '../domain/vision'
import './HudStatus.css'

interface HudStatusProps {
  connection: ConnectionState
  health: Health | null
}

interface StatusFieldProps {
  className?: string
  label: string
  value: ReactNode
}

function StatusField({ className = '', label, value }: StatusFieldProps) {
  return (
    <div className={`hud-status__field${className ? ` ${className}` : ''}`}>
      <span className="hud-status__field-label">{label}</span>
      <span className="hud-status__field-value">{value}</span>
    </div>
  )
}

/** Compact header telemetry. `Active Model` uses the real health response;
 * every other reference-inspired placement deliberately stays as an em dash
 * until a genuine API field exists. */
export function HudStatus({ connection, health }: HudStatusProps) {
  const ready = connection === 'online' ? health : null

  return (
    <div className="hud-status">
      <StatusField label="System Uptime" value="—" />
      <StatusField label="Core Temp" value="—" />
      <StatusField label="Power Draw" value="—" />
      <StatusField label="Network" value="—" />
      <StatusField
        className="hud-status__field--model"
        label="Active Model"
        value={ready ? `${ready.active_model.provider} · ${ready.active_model.model}` : '—'}
      />
      <StatusField label="Operator" value="—" />
    </div>
  )
}
