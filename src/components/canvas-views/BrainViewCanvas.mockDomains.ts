import type { BrainViewDomain } from '@mat-ai-os/brain-view'

/**
 * TEMPORARY fixture data — no real OS/skills/knowledge source exists yet.
 * Exists only to verify `BrainView` renders correctly inside Active Canvas.
 * Replace with real domain data (skills registry, knowledge base) once that
 * exists; nothing outside this file should need to change when it does,
 * since `BrainViewCanvas` only depends on the `BrainViewDomain[]` shape.
 */
export const MOCK_BRAIN_DOMAINS: BrainViewDomain[] = [
  {
    id: 'trading',
    name: 'Trading',
    icon: '↗',
    accent: '#9b6cff',
    highlight: true,
    skills: [
      { id: 'trading-entry-validation', label: 'Entry Validation', details: [{ id: 'trading-weak-confirmation', label: 'Weak Confirmation' }] },
      { id: 'trading-market-structure', label: 'Market Structure' },
    ],
    knowledge: [{ id: 'trading-knowledge-market-memory', label: 'Market memory' }],
  },
  {
    id: 'automation',
    name: 'Automation',
    icon: '⚙',
    accent: '#5cc8ff',
    skills: [
      { id: 'automation-task-routing', label: 'Task Routing' },
      { id: 'automation-scheduling', label: 'Scheduling' },
    ],
    knowledge: [{ id: 'automation-knowledge-workflows', label: 'Workflow patterns' }],
  },
  {
    id: 'vision',
    name: 'Vision',
    icon: '◎',
    accent: '#4de3a8',
    skills: [{ id: 'vision-object-tracking', label: 'Object Tracking' }],
    knowledge: [{ id: 'vision-knowledge-calibration', label: 'Calibration notes' }],
  },
]
