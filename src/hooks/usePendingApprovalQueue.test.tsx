import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { VisionApiProvider } from '../app/VisionApiProvider'
import { VisionApiError } from '../adapters/vision'
import { createFakeVisionApi } from '../test/fakeVisionApi'
import type { QueuedActionSummary } from '../domain/vision'
import { usePendingApprovalQueue } from './usePendingApprovalQueue'

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

function wrapper(api: ReturnType<typeof createFakeVisionApi>) {
  return ({ children }: { children: ReactNode }) => <VisionApiProvider adapter={api}>{children}</VisionApiProvider>
}

describe('usePendingApprovalQueue', () => {
  it('loads the real pending-approval list', async () => {
    const api = createFakeVisionApi()
    api.getPendingApprovalQueue.mockResolvedValue({ items: [task()] })
    const { result } = renderHook(() => usePendingApprovalQueue(), { wrapper: wrapper(api) })

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.items).toHaveLength(1)
    expect(result.current.items[0].task).toBe('restart the dashboard service')
  })

  it('approve calls the real approve route and surfaces its real result', async () => {
    const api = createFakeVisionApi()
    api.getPendingApprovalQueue.mockResolvedValue({ items: [task()] })
    api.approvePendingApprovalTask.mockResolvedValue({ ...task(), status: 'completed', result: 'restarted', error: null })
    const { result } = renderHook(() => usePendingApprovalQueue(), { wrapper: wrapper(api) })
    await waitFor(() => expect(result.current.loading).toBe(false))

    act(() => result.current.resolve('t1', 'approve'))
    await waitFor(() => expect(result.current.lastResult?.status).toBe('completed'))
    expect(api.approvePendingApprovalTask).toHaveBeenCalledWith('t1')
    expect(result.current.lastResult).toEqual({ taskId: 't1', status: 'completed', result: 'restarted', error: null })
  })

  it('reject calls the real reject route', async () => {
    const api = createFakeVisionApi()
    api.getPendingApprovalQueue.mockResolvedValue({ items: [task()] })
    api.rejectPendingApprovalTask.mockResolvedValue({ ...task(), status: 'rejected', result: null, error: null })
    const { result } = renderHook(() => usePendingApprovalQueue(), { wrapper: wrapper(api) })
    await waitFor(() => expect(result.current.loading).toBe(false))

    act(() => result.current.resolve('t1', 'reject'))
    await waitFor(() => expect(result.current.lastResult?.status).toBe('rejected'))
    expect(api.rejectPendingApprovalTask).toHaveBeenCalledWith('t1')
    expect(api.approvePendingApprovalTask).not.toHaveBeenCalled()
  })

  it('a failed resolve reports the real error, never a fabricated success', async () => {
    const api = createFakeVisionApi()
    api.getPendingApprovalQueue.mockResolvedValue({ items: [task()] })
    api.approvePendingApprovalTask.mockRejectedValue(new VisionApiError('boom', { status: 409, detail: 'This task has already been resolved.' }))
    const { result } = renderHook(() => usePendingApprovalQueue(), { wrapper: wrapper(api) })
    await waitFor(() => expect(result.current.loading).toBe(false))

    act(() => result.current.resolve('t1', 'approve'))
    await waitFor(() => expect(result.current.lastResult?.status).toBe('failed'))
  })

  it('surfaces the real fetch error instead of reading as an empty list', async () => {
    const api = createFakeVisionApi()
    api.getPendingApprovalQueue.mockRejectedValue(new VisionApiError('boom', { status: 500, detail: 'Queue backend unreachable.' }))
    const { result } = renderHook(() => usePendingApprovalQueue(), { wrapper: wrapper(api) })

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.items).toEqual([])
    expect(result.current.error).toBeInstanceOf(VisionApiError)
    expect(result.current.error?.detail).toBe('Queue backend unreachable.')
  })

  it('refetches the list after a resolve settles (action refresh behavior)', async () => {
    vi.useFakeTimers()
    const api = createFakeVisionApi()
    api.getPendingApprovalQueue.mockResolvedValue({ items: [task()] })
    api.approvePendingApprovalTask.mockResolvedValue({ ...task(), status: 'completed', result: 'ok', error: null })
    const { result } = renderHook(() => usePendingApprovalQueue(), { wrapper: wrapper(api) })
    await vi.waitFor(() => expect(result.current.loading).toBe(false))

    const callsBefore = api.getPendingApprovalQueue.mock.calls.length
    await act(async () => {
      result.current.resolve('t1', 'approve')
      await vi.advanceTimersByTimeAsync(0)
    })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1500)
    })
    expect(api.getPendingApprovalQueue.mock.calls.length).toBeGreaterThan(callsBefore)
    vi.useRealTimers()
  })
})
