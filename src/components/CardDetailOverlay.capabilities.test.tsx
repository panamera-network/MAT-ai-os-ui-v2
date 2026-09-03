import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { VisionApiProvider } from '../app/VisionApiProvider'
import { createFakeVisionApi } from '../test/fakeVisionApi'
import { CAPABILITIES } from '../domain/vision'
import type { ModelProfiles } from '../domain/vision'
import { CardDetailOverlay } from './CardDetailOverlay'

/** A `useVisionResource`-shaped fake — every field `CardDetailOverlay`/its
 * per-card Detail components actually read, nothing invented beyond that. */
function resource<T>(data: T | null) {
  return { data, error: null, loading: false, lastUpdated: data ? Date.now() : null, refetch: () => {} }
}

describe('CardDetailOverlay — Models card capability rendering (Implement #13A)', () => {
  it('renders all 10 real backend capabilities, including VOICE_STT and VOICE_TTS', () => {
    expect(CAPABILITIES).toHaveLength(10)
    expect(CAPABILITIES).toContain('VOICE_STT')
    expect(CAPABILITIES).toContain('VOICE_TTS')

    const profiles = Object.fromEntries(
      CAPABILITIES.map((capability) => [capability, { primary: { provider: 'test-provider', model: `${capability.toLowerCase()}-model` } }]),
    ) as ModelProfiles

    render(
      <VisionApiProvider adapter={createFakeVisionApi()}>
        <CardDetailOverlay
          cardId="models"
          agents={resource(null)}
          loops={resource(null)}
          models={resource({ profiles })}
          governance={resource(null)}
          mcp={{ ...resource(null), pendingApprovalId: null, approvalResult: null, resolveApproval: () => {} }}
          skills={resource(null)}
          knowledgeNotes={resource(null)}
          budget={resource(null)}
          health={null}
          onClose={() => {}}
        />
      </VisionApiProvider>,
    )

    // Every real capability tag must actually be on screen — not just present
    // in the underlying `profiles` object a stale hardcoded filter could
    // still silently drop (the exact bug this pass fixed). Each capability
    // legitimately appears twice (the Registry row-tag AND the <select>
    // option) — getAllByText, not getByText, is the honest assertion here.
    for (const capability of CAPABILITIES) {
      expect(screen.getAllByText(capability).length).toBeGreaterThan(0)
    }
  })
})
