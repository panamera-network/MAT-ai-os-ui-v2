import { useState } from 'react'
import { BrainView, type BrainViewTab } from '@mat-ai-os/brain-view'
import '@mat-ai-os/brain-view/style.css'
import { MOCK_BRAIN_DOMAINS } from './BrainViewCanvas.mockDomains'

/**
 * The Brain View canvas view. Owns its own data the same way
 * `MatPresenceView` does — today that's `MOCK_BRAIN_DOMAINS` (see that file)
 * since no real skills/knowledge source exists yet. `BrainView` itself is
 * fully prop-driven and untouched from the standalone package.
 */
export function BrainViewCanvas() {
  const [tab, setTab] = useState<BrainViewTab>('skills')
  const [selectedId, setSelectedId] = useState<string | null>(null)

  return (
    <BrainView
      domains={MOCK_BRAIN_DOMAINS}
      tab={tab}
      onTabChange={setTab}
      selectedId={selectedId}
      onSelect={(selection) => setSelectedId(selection.id)}
      onExplore={() => setSelectedId(null)}
    />
  )
}
