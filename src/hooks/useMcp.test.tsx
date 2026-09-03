import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it } from 'vitest'
import { VisionApiProvider } from '../app/VisionApiProvider'
import { VisionApiError } from '../adapters/vision'
import { createFakeVisionApi } from '../test/fakeVisionApi'
import type { McpApproval } from '../domain/vision'
import { useMcp } from './useMcp'

function approval(overrides: Partial<McpApproval> = {}): McpApproval {
  return {
    id: 'a1',
    status: 'pending',
    agent_id: 'agent-1',
    domain: 'general',
    server: 'whatsapp',
    tool: 'send_message',
    params: {},
    reason: 'send a message',
    user_id: 'farez',
    result: null,
    error: null,
    created_at: '2026-09-01T00:00:00Z',
    resolved_at: null,
    granting_skills: [],
    granting_skills_requested: false,
    ...overrides,
  }
}

function wrapper(api: ReturnType<typeof createFakeVisionApi>) {
  return ({ children }: { children: ReactNode }) => <VisionApiProvider adapter={api}>{children}</VisionApiProvider>
}

describe('useMcp — Implement #13A approval actions', () => {
  it('still loads the real /mcp snapshot unchanged (existing read surface preserved)', async () => {
    const api = createFakeVisionApi()
    api.getMcp.mockResolvedValue({ body_attached: true, servers: [], pending_approvals: [approval()], activity: {} })
    const { result } = renderHook(() => useMcp(), { wrapper: wrapper(api) })

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.data?.pending_approvals).toHaveLength(1)
  })

  it('resolveApproval("approve") calls the real approve route and surfaces its real status', async () => {
    const api = createFakeVisionApi()
    api.getMcp.mockResolvedValue({ body_attached: true, servers: [], pending_approvals: [approval()], activity: {} })
    api.approveMcpApproval.mockResolvedValue({ approval: approval({ status: 'approved', result: 'sent' }) })
    const { result } = renderHook(() => useMcp(), { wrapper: wrapper(api) })
    await waitFor(() => expect(result.current.loading).toBe(false))

    act(() => result.current.resolveApproval('a1', 'approve'))
    await waitFor(() => expect(result.current.approvalResult?.status).toBe('approved'))
    expect(api.approveMcpApproval).toHaveBeenCalledWith('a1')
    expect(api.denyMcpApproval).not.toHaveBeenCalled()
  })

  it('resolveApproval("deny") calls the real deny route', async () => {
    const api = createFakeVisionApi()
    api.getMcp.mockResolvedValue({ body_attached: true, servers: [], pending_approvals: [approval()], activity: {} })
    api.denyMcpApproval.mockResolvedValue({ approval: approval({ status: 'denied' }) })
    const { result } = renderHook(() => useMcp(), { wrapper: wrapper(api) })
    await waitFor(() => expect(result.current.loading).toBe(false))

    act(() => result.current.resolveApproval('a1', 'deny'))
    await waitFor(() => expect(result.current.approvalResult?.status).toBe('denied'))
    expect(api.denyMcpApproval).toHaveBeenCalledWith('a1')
  })

  it('a failed resolve reports status "failed" with the real error, never a fabricated outcome', async () => {
    const api = createFakeVisionApi()
    api.getMcp.mockResolvedValue({ body_attached: true, servers: [], pending_approvals: [approval()], activity: {} })
    api.approveMcpApproval.mockRejectedValue(new VisionApiError('boom', { status: 409, detail: 'This MCP approval has already been resolved.' }))
    const { result } = renderHook(() => useMcp(), { wrapper: wrapper(api) })
    await waitFor(() => expect(result.current.loading).toBe(false))

    act(() => result.current.resolveApproval('a1', 'approve'))
    await waitFor(() => expect(result.current.approvalResult?.status).toBe('failed'))
    expect(result.current.approvalResult?.error).toBe('This MCP approval has already been resolved.')
  })
})
