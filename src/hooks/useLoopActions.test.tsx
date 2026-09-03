import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it } from 'vitest'
import { VisionApiProvider } from '../app/VisionApiProvider'
import { VisionApiError } from '../adapters/vision'
import { createFakeVisionApi } from '../test/fakeVisionApi'
import type { Loop } from '../domain/vision'
import { useLoopActions, type LoopActionOutcome } from './useLoopActions'

function loop(overrides: Partial<Loop> = {}): Loop {
  return {
    id: 'l1',
    name: 'Midnight Maintenance',
    description: '',
    trigger: 'cron',
    schedule: '0 0 * * *',
    task: 'run maintenance',
    domain: null,
    pipeline: 'simple',
    done_when: null,
    status: 'active',
    last_run: null,
    next_run: null,
    run_count: 3,
    created_at: '2026-09-01T00:00:00Z',
    ...overrides,
  }
}

function wrapper(api: ReturnType<typeof createFakeVisionApi>) {
  return ({ children }: { children: ReactNode }) => <VisionApiProvider adapter={api}>{children}</VisionApiProvider>
}

describe('useLoopActions', () => {
  it('pause calls the real pause route and reports the real updated loop', async () => {
    const api = createFakeVisionApi()
    api.pauseLoop.mockResolvedValue({ loop: loop({ status: 'paused' }) })
    const { result } = renderHook(() => useLoopActions(), { wrapper: wrapper(api) })

    let outcome: LoopActionOutcome | undefined
    act(() => result.current.pause('l1', (o) => { outcome = o }))
    await waitFor(() => expect(outcome).toBeDefined())
    expect(api.pauseLoop).toHaveBeenCalledWith('l1')
    expect(outcome?.ok).toBe(true)
  })

  it('start calls the real start route', async () => {
    const api = createFakeVisionApi()
    api.startLoop.mockResolvedValue({ loop: loop({ status: 'active' }) })
    const { result } = renderHook(() => useLoopActions(), { wrapper: wrapper(api) })

    let settled = false
    act(() => result.current.start('l1', () => { settled = true }))
    await waitFor(() => expect(settled).toBe(true))
    expect(api.startLoop).toHaveBeenCalledWith('l1')
  })

  it('runNow reports the real outcome string, not a fabricated boolean', async () => {
    const api = createFakeVisionApi()
    api.runLoopNow.mockResolvedValue({ loop: loop(), outcome: 'skipped_not_active' })
    const { result } = renderHook(() => useLoopActions(), { wrapper: wrapper(api) })

    let detail: string | undefined
    act(() => result.current.runNow('l1', (o) => { detail = o.detail }))
    await waitFor(() => expect(detail).toBe('skipped_not_active'))
  })

  it('a failed action reports ok:false with the real error detail', async () => {
    const api = createFakeVisionApi()
    api.pauseLoop.mockRejectedValue(new VisionApiError('boom', { status: 404, detail: 'No such loop: "l1"' }))
    const { result } = renderHook(() => useLoopActions(), { wrapper: wrapper(api) })

    let outcome: { ok: boolean; detail: string } | undefined
    act(() => result.current.pause('l1', (o) => { outcome = o as never }))
    await waitFor(() => expect(outcome).toBeDefined())
    expect(outcome?.ok).toBe(false)
    expect(outcome?.detail).toBe('No such loop: "l1"')
  })

  it('only the loop mid-request is reported as pending', async () => {
    const api = createFakeVisionApi()
    let resolvePause: (value: { loop: Loop }) => void = () => {}
    api.pauseLoop.mockImplementation(() => new Promise((resolve) => { resolvePause = resolve }))
    const { result } = renderHook(() => useLoopActions(), { wrapper: wrapper(api) })

    act(() => result.current.pause('l1', () => {}))
    await waitFor(() => expect(result.current.pendingId).toBe('l1'))

    act(() => resolvePause({ loop: loop({ status: 'paused' }) }))
    await waitFor(() => expect(result.current.pendingId).toBeNull())
  })
})
