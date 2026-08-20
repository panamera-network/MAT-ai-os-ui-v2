import type { BodyScoped } from './shared'

export interface Law {
  id: string
  action: string
  rule: 'allow' | 'queue' | 'deny'
}

export interface LawStatus {
  total: number
  active_count: number
  inactive_count: number
  active_laws: Law[]
}

export interface LifecycleStatus {
  total_cases: number
  by_state: Record<string, number>
}

export type GovernanceResult = BodyScoped<{ laws: LawStatus; lifecycle: LifecycleStatus }>
