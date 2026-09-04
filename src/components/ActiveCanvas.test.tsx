import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { VisionApiProvider } from '../app/VisionApiProvider'
import { createFakeVisionApi } from '../test/fakeVisionApi'
import type { UseHealthResult } from '../hooks/useHealth'
import { ActiveCanvas } from './ActiveCanvas'

// `MatPresenceView` renders a real Three.js scene via this package -- no
// test in this codebase has ever mounted it (jsdom has no ResizeObserver
// out of the box, a pre-existing environment limitation, not something
// this task changed). Stubbed here only so `ActiveCanvas`'s own dispatch
// logic (which view mounts) is verifiable without a real 3D canvas.
vi.mock('@panamera-network/mat-presence-orb', () => ({
  MatPresence: () => null,
}))

function healthResource(overrides: Partial<UseHealthResult> = {}): UseHealthResult {
  return { health: null, connection: 'checking', error: null, ...overrides }
}

function renderView(view: 'presence' | 'brain' | 'iammat', api = createFakeVisionApi()) {
  return render(
    <VisionApiProvider adapter={api}>
      <ActiveCanvas view={view} health={healthResource()} />
    </VisionApiProvider>,
  )
}

describe('ActiveCanvas', () => {
  it('mounts Presence by default without rendering the I AM MAT canvas', () => {
    renderView('presence')
    expect(screen.queryByText('I AM MAT')).not.toBeInTheDocument()
  })

  it('mounts Brain View without rendering the I AM MAT canvas', () => {
    const api = createFakeVisionApi()
    api.getAgents.mockResolvedValue({ body_attached: true, agents: [], active_agent_ids: [], unresolved_cases: [] })
    api.getSkills.mockResolvedValue({ body_attached: true, skills: [], upgraded_count: 0, recent_upgrades: [] })
    api.getKnowledge.mockResolvedValue({ body_attached: true, knowledge: [] })
    renderView('brain', api)
    expect(screen.queryByText('I AM MAT')).not.toBeInTheDocument()
  })

  it('mounts the I AM MAT canvas and passes the real health resource through, never a second poll', () => {
    const api = createFakeVisionApi()
    api.getSoul.mockResolvedValue({
      soul: {
        soul_prompt: '',
        response_styles: {},
        safety_rules: '',
        active_style: 'balanced',
        identity: {
          name: 'MAT',
          nickname: '',
          language: 'en',
          profession: [],
          active_projects: [],
          goals: { short_term: [], long_term: [] },
          preferences: { communication_style: '', work_hours: '' },
          timezone: 'UTC',
          active_mode: 'default',
          persona: 'trader',
        },
      },
    })
    render(
      <VisionApiProvider adapter={api}>
        <ActiveCanvas view="iammat" health={healthResource({ connection: 'online', health: { status: 'ok', is_running: true, active_model: { provider: 'openai', model: 'gpt-4o-mini' }, faculties: { soul: true, intelligence: true, reasoning: true, vision: true, voice: true }, degraded: { llm_provider_configured: true, stt_configured: true, tts_configured: true, vision_configured: true }, body: { body_attached: true } as never } })} />
      </VisionApiProvider>,
    )
    expect(screen.getByText('I AM MAT')).toBeInTheDocument()
    // The health passed in is already 'online' with real data -- if
    // ActiveCanvas opened a second poll instead of reusing the prop, this
    // would still show "Loading…"/"Offline" first.
    expect(screen.getByText('openai')).toBeInTheDocument()
  })
})
