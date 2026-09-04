import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { VisionApiProvider } from '../../app/VisionApiProvider'
import { VisionApiError } from '../../adapters/vision'
import { createFakeVisionApi } from '../../test/fakeVisionApi'
import type { UseHealthResult } from '../../hooks/useHealth'
import type { Health, IdentityProfile, SoulInfo } from '../../domain/vision'
import { IAmMatCanvas } from './IAmMatCanvas'

function health(overrides: Partial<Health> = {}): Health {
  return {
    status: 'ok',
    is_running: true,
    active_model: { provider: 'openai', model: 'gpt-4o-mini' },
    faculties: { soul: true, intelligence: true, reasoning: true, vision: true, voice: true },
    degraded: { llm_provider_configured: true, stt_configured: true, tts_configured: true, vision_configured: true },
    body: { body_attached: true } as Health['body'],
    ...overrides,
  }
}

function healthResource(overrides: Partial<UseHealthResult> = {}): UseHealthResult {
  return { health: health(), connection: 'online', error: null, ...overrides }
}

function identity(overrides: Partial<IdentityProfile> = {}): IdentityProfile {
  return {
    name: 'MAT',
    nickname: 'Mat',
    language: 'en',
    profession: [],
    active_projects: [],
    goals: { short_term: [], long_term: [] },
    preferences: { communication_style: 'direct', work_hours: '09:00-18:00' },
    timezone: 'Asia/Kuala_Lumpur',
    active_mode: 'trader',
    persona: 'trader',
    ...overrides,
  }
}

function soulInfo(overrides: Partial<SoulInfo> = {}): SoulInfo {
  return {
    soul_prompt: 'You are MAT, an operator-facing AI system.',
    response_styles: { default: 'concise and numeric' },
    safety_rules: 'Never fabricate financial advice.',
    active_style: 'balanced',
    identity: identity(),
    ...overrides,
  }
}

function renderCanvas(healthRes: UseHealthResult, api = createFakeVisionApi()) {
  return render(
    <VisionApiProvider adapter={api}>
      <IAmMatCanvas healthResource={healthRes} />
    </VisionApiProvider>,
  )
}

describe('IAmMatCanvas', () => {
  it('renders real identity fields from GET /soul', async () => {
    const api = createFakeVisionApi()
    api.getSoul.mockResolvedValue({ soul: soulInfo({ identity: identity({ persona: 'trader', active_mode: 'focus', timezone: 'Asia/Kuala_Lumpur' }) }) })
    renderCanvas(healthResource(), api)

    expect(await screen.findByText('Name')).toBeInTheDocument()
    expect(screen.getByText('focus')).toBeInTheDocument()
    expect(screen.getByText('Asia/Kuala_Lumpur')).toBeInTheDocument()
    expect(screen.getByText('direct')).toBeInTheDocument()
  })

  it('omits empty optional identity fields cleanly instead of showing a placeholder', async () => {
    const api = createFakeVisionApi()
    api.getSoul.mockResolvedValue({ soul: soulInfo({ identity: identity({ profession: [], active_projects: [] }) }) })
    renderCanvas(healthResource(), api)

    await screen.findByText('Name')
    expect(screen.queryByText('Profession')).not.toBeInTheDocument()
    expect(screen.queryByText('Active projects')).not.toBeInTheDocument()
  })

  it('shows real profession/goals only when the backend actually returns them', async () => {
    const api = createFakeVisionApi()
    api.getSoul.mockResolvedValue({
      soul: soulInfo({ identity: identity({ profession: ['engineer'], goals: { short_term: ['ship v2'], long_term: [] } }) }),
    })
    renderCanvas(healthResource(), api)

    expect(await screen.findByText('engineer')).toBeInTheDocument()
    expect(screen.getByText('ship v2')).toBeInTheDocument()
    expect(screen.queryByText('Long-term goals')).not.toBeInTheDocument()
  })

  it('renders faculties with real ready/unavailable state, never fabricated', async () => {
    const api = createFakeVisionApi()
    api.getSoul.mockResolvedValue({ soul: soulInfo() })
    renderCanvas(
      healthResource({ health: health({ faculties: { soul: true, intelligence: true, reasoning: true, vision: false, voice: true } }) }),
      api,
    )

    await screen.findByText('Name')
    expect(screen.getAllByText('Ready')).toHaveLength(4)
    expect(screen.getByText('Unavailable')).toBeInTheDocument()
  })

  it('surfaces a degraded configuration flag clearly', async () => {
    const api = createFakeVisionApi()
    api.getSoul.mockResolvedValue({ soul: soulInfo() })
    renderCanvas(
      healthResource({ health: health({ degraded: { llm_provider_configured: true, stt_configured: false, tts_configured: true, vision_configured: true } }) }),
      api,
    )

    await screen.findByText('Name')
    expect(screen.getByText('STT configured: no')).toBeInTheDocument()
    expect(screen.getByText('TTS configured: yes')).toBeInTheDocument()
  })

  it('shows the real active model as a read-only glance', async () => {
    const api = createFakeVisionApi()
    api.getSoul.mockResolvedValue({ soul: soulInfo() })
    renderCanvas(healthResource({ health: health({ active_model: { provider: 'anthropic', model: 'claude-sonnet-4-6' } }) }), api)

    await screen.findByText('Name')
    expect(screen.getByText('anthropic')).toBeInTheDocument()
    expect(screen.getByText('claude-sonnet-4-6')).toBeInTheDocument()
  })

  it('never shows model-assignment controls (that stays in the Models modal)', async () => {
    const api = createFakeVisionApi()
    api.getSoul.mockResolvedValue({ soul: soulInfo() })
    renderCanvas(healthResource(), api)

    await screen.findByText('Name')
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
    expect(screen.queryByText(/apply/i)).not.toBeInTheDocument()
  })

  it('soul prompt and safety rules stay hidden until explicitly expanded', async () => {
    const api = createFakeVisionApi()
    api.getSoul.mockResolvedValue({ soul: soulInfo() })
    renderCanvas(healthResource(), api)

    await screen.findByText('Name')
    expect(screen.queryByText('You are MAT, an operator-facing AI system.')).not.toBeInTheDocument()
    fireEvent.click(screen.getByText('View soul prompt'))
    expect(screen.getByText('You are MAT, an operator-facing AI system.')).toBeInTheDocument()
  })

  it('shows a loading state while health is still being fetched, never fake data', () => {
    const api = createFakeVisionApi()
    api.getSoul.mockResolvedValue({ soul: soulInfo() })
    renderCanvas({ health: null, connection: 'checking', error: null }, api)
    // The Faculties/Active Model panel (health-driven) shows it; Identity/
    // Soul (soul-driven, mocked to resolve) don't -- at least one real
    // "still loading" note, never a fabricated faculty/model value.
    expect(screen.getAllByText('Loading…').length).toBeGreaterThanOrEqual(1)
    expect(screen.queryByText('Ready')).not.toBeInTheDocument()
  })

  it('shows the existing offline treatment when MAT is unreachable', () => {
    const api = createFakeVisionApi()
    api.getSoul.mockResolvedValue({ soul: soulInfo() })
    renderCanvas({ health: null, connection: 'offline', error: new VisionApiError('boom', { status: 0, detail: 'unreachable' }) }, api)
    expect(screen.getAllByText('Offline').length).toBeGreaterThanOrEqual(1)
  })

  it('shows the existing error treatment when the soul fetch fails', async () => {
    const api = createFakeVisionApi()
    api.getSoul.mockRejectedValue(new VisionApiError('boom', { status: 500, detail: 'nope' }))
    renderCanvas(healthResource(), api)

    // Identity and Soul are two independently-status'd panels, both driven
    // by the same failed `soul` resource -- both legitimately show it.
    const errors = await screen.findAllByText('Error loading data')
    expect(errors).toHaveLength(2)
  })
})
