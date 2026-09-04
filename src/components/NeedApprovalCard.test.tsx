import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { VisionApiProvider } from '../app/VisionApiProvider'
import { VisionApiError } from '../adapters/vision'
import { createFakeVisionApi } from '../test/fakeVisionApi'
import type { LearnSuggestionSummary, QueuedActionSummary } from '../domain/vision'
import { NeedApprovalCard } from './HudRightPanel'

function task(overrides: Partial<QueuedActionSummary> = {}): QueuedActionSummary {
  return {
    id: 't1',
    status: 'pending_approval',
    task: 'restart the dashboard service',
    stage: 'law',
    action: 'restart_service',
    detail: 'Blocked pending owner review',
    user_id: 'farez',
    created_at: '2026-09-01T00:00:00Z',
    resolved_by: null,
    resolved_at: null,
    ...overrides,
  }
}

function suggestion(overrides: Partial<LearnSuggestionSummary> = {}): LearnSuggestionSummary {
  return {
    id: 's1',
    status: 'pending',
    operation: 'new_domain',
    target_skill_id: null,
    domain: 'trading_analytics',
    reason: 'No existing skill covers this operation.',
    source: 'chat',
    requested_by: 'farez',
    created_at: '2026-09-01T01:00:00Z',
    expires_at: '2026-09-01T01:15:00Z',
    ...overrides,
  }
}

function emptyApi() {
  const api = createFakeVisionApi()
  api.getPendingApprovalQueue.mockResolvedValue({ items: [] })
  api.getPendingLearnSuggestions.mockResolvedValue({ suggestions: [] })
  return api
}

function renderCard(api: ReturnType<typeof createFakeVisionApi>) {
  return render(
    <VisionApiProvider adapter={api}>
      <NeedApprovalCard onEvent={() => {}} />
    </VisionApiProvider>,
  )
}

describe('NeedApprovalCard', () => {
  it('1. stays visible and shows the fixed empty state when there are zero approvals', async () => {
    renderCard(emptyApi())
    await waitFor(() => expect(screen.getByText('No approvals needed')).toBeInTheDocument())
    expect(screen.getByText('Need Approval')).toBeInTheDocument()
  })

  it('2. one approval shows the correct compact count and row', async () => {
    const api = emptyApi()
    api.getPendingApprovalQueue.mockResolvedValue({ items: [task()] })
    renderCard(api)

    await waitFor(() => expect(screen.getByText('1 need approval')).toBeInTheDocument())
    expect(screen.getByText('restart the dashboard service')).toBeInTheDocument()
    // Reason text must never appear in the compact card.
    expect(screen.queryByText('Blocked pending owner review')).not.toBeInTheDocument()
  })

  it('3. multiple approvals (>5) show only 5 rows plus a View All control that expands', async () => {
    const api = emptyApi()
    const items = Array.from({ length: 4 }, (_, i) => task({ id: `t${i}`, task: `action ${i}`, created_at: `2026-09-01T00:0${i}:00Z` }))
    const suggestions = Array.from({ length: 3 }, (_, i) => suggestion({ id: `s${i}`, domain: `domain-${i}`, created_at: `2026-09-01T01:0${i}:00Z` }))
    api.getPendingApprovalQueue.mockResolvedValue({ items })
    api.getPendingLearnSuggestions.mockResolvedValue({ suggestions })
    renderCard(api)

    await waitFor(() => expect(screen.getByText('7 need approval')).toBeInTheDocument())
    const list = document.querySelector('.hud-need-approval-card__list') as HTMLElement
    expect(within(list).getAllByRole('button')).toHaveLength(5)

    fireEvent.click(screen.getByText('View All'))
    await waitFor(() => expect(within(list).getAllByRole('button')).toHaveLength(7))
  })

  it('4. clicking an approval opens a modal with the real request/action, requester, and reason', async () => {
    const api = emptyApi()
    api.getPendingLearnSuggestions.mockResolvedValue({ suggestions: [suggestion()] })
    api.getLearnSuggestion.mockResolvedValue({
      ...suggestion(),
      proposed: { name: 'trading_analytics_reporter', description: 'Summarizes trade performance.' },
    })
    renderCard(api)

    await waitFor(() => expect(screen.getByText('trading_analytics')).toBeInTheDocument())
    fireEvent.click(screen.getByText('trading_analytics'))

    expect(screen.getByText('Learn Approval')).toBeInTheDocument()
    expect(screen.getByText('No existing skill covers this operation.')).toBeInTheDocument()
    expect(screen.getByText('farez')).toBeInTheDocument()
    await waitFor(() => expect(screen.getByText('trading_analytics_reporter')).toBeInTheDocument())
    expect(screen.getByText('Summarizes trade performance.')).toBeInTheDocument()
  })

  it('5. Approve calls the real approve route; the item disappears and the count updates', async () => {
    vi.useFakeTimers()
    const api = emptyApi()
    api.getPendingApprovalQueue.mockResolvedValueOnce({ items: [task()] })
    api.approvePendingApprovalTask.mockResolvedValue({ ...task(), status: 'completed', result: 'ok', error: null })
    renderCard(api)

    await vi.waitFor(() => expect(screen.getByText('1 need approval')).toBeInTheDocument())
    fireEvent.click(screen.getByText('restart the dashboard service'))
    expect(screen.getByText('Action Approval')).toBeInTheDocument()

    api.getPendingApprovalQueue.mockResolvedValueOnce({ items: [] })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Approve' }))
    })
    expect(api.approvePendingApprovalTask).toHaveBeenCalledWith('t1')

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1500)
    })
    await vi.waitFor(() => expect(screen.getByText('No approvals needed')).toBeInTheDocument())
    expect(screen.queryByText('Action Approval')).not.toBeInTheDocument()
    vi.useRealTimers()
  })

  it('6. Reject calls the real reject route; the item disappears and the count updates', async () => {
    vi.useFakeTimers()
    const api = emptyApi()
    api.getPendingLearnSuggestions.mockResolvedValueOnce({ suggestions: [suggestion()] })
    api.getLearnSuggestion.mockResolvedValue({ ...suggestion(), proposed: {} })
    api.rejectLearnSuggestion.mockResolvedValue({
      status: 'rejected',
      reason: 'Not needed.',
      suggestion_id: 's1',
      skill_id: null,
      domain: 'trading_analytics',
      knowledge_id: null,
      receipt: null,
    })
    renderCard(api)

    await vi.waitFor(() => expect(screen.getByText('1 need approval')).toBeInTheDocument())
    fireEvent.click(screen.getByText('trading_analytics'))

    api.getPendingLearnSuggestions.mockResolvedValueOnce({ suggestions: [] })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Reject' }))
    })
    expect(api.rejectLearnSuggestion).toHaveBeenCalledWith('s1')

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1500)
    })
    await vi.waitFor(() => expect(screen.getByText('No approvals needed')).toBeInTheDocument())
    vi.useRealTimers()
  })

  it('7. a backend error leaves the card stable and shows the existing error treatment', async () => {
    const api = createFakeVisionApi()
    api.getPendingApprovalQueue.mockRejectedValue(new VisionApiError('boom', { status: 500, detail: 'nope' }))
    api.getPendingLearnSuggestions.mockRejectedValue(new VisionApiError('boom', { status: 500, detail: 'nope' }))
    renderCard(api)

    await waitFor(() => expect(screen.getByText('Error loading data')).toBeInTheDocument())
    expect(screen.getByText('Need Approval')).toBeInTheDocument()
    expect(screen.queryByText('No approvals needed')).not.toBeInTheDocument()
  })

  it('a real error on one source never hides real items already loaded from the other', async () => {
    const api = createFakeVisionApi()
    api.getPendingApprovalQueue.mockResolvedValue({ items: [task()] })
    api.getPendingLearnSuggestions.mockRejectedValue(new VisionApiError('boom', { status: 500, detail: 'nope' }))
    renderCard(api)

    await waitFor(() => expect(screen.getByText('1 need approval')).toBeInTheDocument())
    expect(screen.queryByText('Error loading data')).not.toBeInTheDocument()
  })
})
