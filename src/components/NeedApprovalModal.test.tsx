import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { QueuedActionSummary } from '../domain/vision'
import { NeedApprovalModal } from './NeedApprovalModal'

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

describe('NeedApprovalModal', () => {
  it('shows the real action-kind request, requester, and fields — never a fabricated reason', () => {
    render(
      <NeedApprovalModal
        item={{ kind: 'action', data: task() }}
        busy={false}
        lastActionError={null}
        fetchLearnDetail={vi.fn()}
        onApprove={vi.fn()}
        onReject={vi.fn()}
        onClose={vi.fn()}
      />,
    )

    expect(screen.getByText('Action Approval')).toBeInTheDocument()
    expect(screen.getByText('restart the dashboard service')).toBeInTheDocument()
    expect(screen.getByText('farez')).toBeInTheDocument()
    expect(screen.getByText('restart_service')).toBeInTheDocument()
    expect(screen.getByText('law')).toBeInTheDocument()
    expect(screen.getByText('Blocked pending owner review')).toBeInTheDocument()
  })

  it('shows the real last-action error for this exact item, if one exists', () => {
    render(
      <NeedApprovalModal
        item={{ kind: 'action', data: task() }}
        busy={false}
        lastActionError="This task has already been resolved."
        fetchLearnDetail={vi.fn()}
        onApprove={vi.fn()}
        onReject={vi.fn()}
        onClose={vi.fn()}
      />,
    )
    expect(screen.getByText('This task has already been resolved.')).toBeInTheDocument()
  })

  it('Approve/Reject call the real handlers passed in, disabled while busy', () => {
    const onApprove = vi.fn()
    const onReject = vi.fn()
    render(
      <NeedApprovalModal
        item={{ kind: 'action', data: task() }}
        busy={false}
        lastActionError={null}
        fetchLearnDetail={vi.fn()}
        onApprove={onApprove}
        onReject={onReject}
        onClose={vi.fn()}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Approve' }))
    fireEvent.click(screen.getByRole('button', { name: 'Reject' }))
    expect(onApprove).toHaveBeenCalledTimes(1)
    expect(onReject).toHaveBeenCalledTimes(1)
  })

  it('busy disables both action buttons', () => {
    render(
      <NeedApprovalModal
        item={{ kind: 'action', data: task() }}
        busy
        lastActionError={null}
        fetchLearnDetail={vi.fn()}
        onApprove={vi.fn()}
        onReject={vi.fn()}
        onClose={vi.fn()}
      />,
    )
    const buttons = screen.getAllByRole('button', { name: 'Working…' })
    expect(buttons).toHaveLength(2)
    buttons.forEach((button) => expect(button).toBeDisabled())
  })

  it('closes on Escape', () => {
    const onClose = vi.fn()
    render(
      <NeedApprovalModal
        item={{ kind: 'action', data: task() }}
        busy={false}
        lastActionError={null}
        fetchLearnDetail={vi.fn()}
        onApprove={vi.fn()}
        onReject={vi.fn()}
        onClose={onClose}
      />,
    )
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('closes on backdrop click, but not on a click inside the panel', () => {
    const onClose = vi.fn()
    render(
      <NeedApprovalModal
        item={{ kind: 'action', data: task() }}
        busy={false}
        lastActionError={null}
        fetchLearnDetail={vi.fn()}
        onApprove={vi.fn()}
        onReject={vi.fn()}
        onClose={onClose}
      />,
    )
    fireEvent.click(screen.getByText('Action Approval'))
    expect(onClose).not.toHaveBeenCalled()

    fireEvent.click(document.querySelector('.need-approval-modal-backdrop') as HTMLElement)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('closes via the explicit close button', () => {
    const onClose = vi.fn()
    render(
      <NeedApprovalModal
        item={{ kind: 'action', data: task() }}
        busy={false}
        lastActionError={null}
        fetchLearnDetail={vi.fn()}
        onApprove={vi.fn()}
        onReject={vi.fn()}
        onClose={onClose}
      />,
    )
    fireEvent.click(screen.getByLabelText('Close'))
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
