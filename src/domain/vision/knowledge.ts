import type { BodyScoped } from './shared'

/** One version of a `KnowledgeEngine` item — the commonly-populated subset. */
export interface KnowledgeVersion {
  version: number
  statement: string
  confidence: number
  status: 'candidate' | 'active' | 'deprecated' | 'rejected'
  created_at: string
}

/**
 * A real `KnowledgeEngine` item (Batch D) — versioned knowledge claims, NOT
 * a Skill and NOT the (unrelated, unexposed) `KnowledgeGraph` relation
 * module — see `GET /knowledge`'s own comment in api/app.py. No ownership
 * concept exists in this engine at all: every item is global.
 */
export interface KnowledgeItem {
  id: string
  topic: string
  domain: string | null
  tags: string[]
  active_version: number | null
  versions: KnowledgeVersion[]
}

export type KnowledgeResult = BodyScoped<{ knowledge: KnowledgeItem[] }>
