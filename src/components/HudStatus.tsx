import type { ReactNode } from 'react'
import type { ConnectionState } from '../hooks/useHealth'
import type { Health } from '../domain/vision'
import { useRuntime } from '../hooks/useRuntime'
import { useTelemetry } from '../hooks/useTelemetry'
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

/** Compact byte formatting for the narrow header slots — no fractional
 * digits below GB, matching the header's single-line space budget. */
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes.toFixed(0)}B`
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(0)}KB`
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(0)}MB`
  return `${(bytes / 1024 ** 3).toFixed(1)}GB`
}

function formatRate(bytesPerSec: number): string {
  return `${formatBytes(bytesPerSec)}/s`
}

/** Compact header telemetry. MAT Core and Active Model use the real health
 * response. CPU/RAM/GPU/Network read from `useTelemetry` — real host-machine
 * readings pushed from the Electron main process (see `telemetry/service.
 * ts`), '—' until the first reading arrives or outside the Electron shell.
 * GPU reports 'Unavailable' rather than a placeholder dash when the host has
 * no queryable controller/VRAM, since that's a genuine machine limitation
 * rather than "still loading". Operator/Status is the Electron runtime
 * supervisor's own status (see useRuntime) — '—' outside the Electron
 * shell, where there's no process to supervise. */
export function HudStatus({ connection, health }: HudStatusProps) {
  const ready = connection === 'online' ? health : null
  const runtime = useRuntime()
  const telemetry = useTelemetry()

  const cpuValue = telemetry ? `${telemetry.cpu.usagePercent.toFixed(0)}%` : '—'
  const ramValue = telemetry
    ? `${telemetry.ram.usagePercent.toFixed(0)}% · ${formatBytes(telemetry.ram.usedBytes)}/${formatBytes(telemetry.ram.totalBytes)}`
    : '—'
  const gpuValue = !telemetry
    ? '—'
    : telemetry.gpu.usagePercent === null
      ? 'Unavailable'
      : telemetry.gpu.vramUsedBytes !== null && telemetry.gpu.vramTotalBytes !== null
        ? `${telemetry.gpu.usagePercent.toFixed(0)}% · ${formatBytes(telemetry.gpu.vramUsedBytes)}/${formatBytes(telemetry.gpu.vramTotalBytes)}`
        : `${telemetry.gpu.usagePercent.toFixed(0)}%`
  const networkValue = telemetry
    ? `↓${formatRate(telemetry.network.rxBytesPerSec)} ↑${formatRate(telemetry.network.txBytesPerSec)}`
    : '—'

  return (
    <div className="hud-status">
      <StatusField
        className={`hud-status__field--connection is-${connection}`}
        label="MAT Core"
        value={CORE_STATUS[connection]}
      />
      <StatusField chart label="CPU" value={cpuValue} />
      <StatusField chart label="RAM" value={ramValue} />
      <StatusField chart label="GPU" value={gpuValue} />
      <StatusField chart label="Network" value={networkValue} />
      <StatusField
        className="hud-status__field--model"
        label="Active Model"
        value={ready ? `${ready.active_model.provider} · ${ready.active_model.model}` : '—'}
      />
      <StatusField label="Operator / Status" value={runtime.status?.message ?? '—'} />
    </div>
  )
}
