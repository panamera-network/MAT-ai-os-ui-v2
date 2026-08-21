export type HudEventTone = 'info' | 'success' | 'warning' | 'danger'

export interface HudEvent {
  id: string
  timestamp: number
  message: string
  tone: HudEventTone
}

export type AddHudEvent = (message: string, tone?: HudEventTone) => void
